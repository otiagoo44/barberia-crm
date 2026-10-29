import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

for (const width of [390, 1440]) {
  test(`Calendar personal connection and launch checklist distinguish configured from pending at ${width}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let configured = false,
      connected = false;
    const writes: string[] = [];
    await page.route("**/api/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.pathname === "/api/calendar/status")
        return route.fulfill({
          json: {
            configured,
            people: [
              {
                staff_id: "staff-own",
                name: "Profesional propio",
                own: true,
                status: connected ? "connected" : "disconnected",
                email: connected ? "owner@fixture.invalid" : null,
                pending: connected ? 1 : 0,
                failed: 0,
                last_error: null,
                last_synced_at: null,
              },
              {
                staff_id: "staff-other",
                name: "Otro profesional",
                own: false,
                status: "disconnected",
                email: null,
                pending: 0,
                failed: 0,
                last_error: null,
                last_synced_at: null,
              },
            ],
          },
        });
      if (url.pathname === "/api/calendar/disconnect") {
        writes.push(url.pathname);
        expect(request.postDataJSON()).toEqual({
          org: "org-qa",
          staff: "staff-own",
        });
        connected = false;
        return route.fulfill({ json: { ok: true } });
      }
      if (url.pathname.endsWith("/live"))
        return route.fulfill({
          contentType: "text/event-stream",
          body: 'retry: 60000\ndata: {"type":"connected"}\n\n',
        });
      if (url.pathname.endsWith("/setup"))
        return route.fulfill({
          json: {
            checked_at: new Date().toISOString(),
            day: "2026-10-29",
            checks: [
              {
                key: "professionals",
                label: "Profesionales",
                status: "ready",
                detail: "Equipo asignado y servicios habilitados.",
                module: "equipo",
              },
              {
                key: "team_access",
                label: "Acceso personal del equipo",
                status: "pending",
                detail: "Un integrante debe confirmar su acceso.",
                module: "equipo",
              },
              {
                key: "booking",
                label: "Reservas públicas",
                status: "ready",
                detail:
                  "Catálogo y disponibilidad comprobados; reserva pública registrada.",
                module: "sucursales",
              },
              {
                key: "external",
                label: "Controles externos",
                status: "manual",
                detail: "Respaldo externo por comprobar.",
                module: "configuracion",
              },
            ],
          },
        });
      return route.fulfill({ json: { items: [], has_more: false } });
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/fixture-a/equipo");
    await expect(
      page.getByRole("button", { name: "Conectar Google Calendar" }),
    ).toBeDisabled();
    await expect(
      page.getByText(
        "Este profesional debe conectar Google desde su propia sesión.",
      ),
    ).toBeVisible();
    configured = true;
    connected = true;
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Volver a autorizar" }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Desconectar", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Conectar Google Calendar" }),
    ).toBeEnabled();
    expect(writes).toEqual(["/api/calendar/disconnect"]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await mkdir("docs/verification/calendar-setup-20261029", {
      recursive: true,
    });
    await page.screenshot({
      path: `docs/verification/calendar-setup-20261029/calendar-${width}.png`,
      fullPage: true,
    });
    await page.goto("/fixture-a/configuracion");
    await expect(
      page.getByText("2 comprobadas · 1 pendiente · 1 manual"),
    ).toBeVisible();
    const booking = page
      .locator(".launch-checklist > li")
      .filter({ hasText: "Reservas públicas" });
    await expect(booking).toContainText("Comprobado");
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({
      path: `docs/verification/calendar-setup-20261029/setup-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}

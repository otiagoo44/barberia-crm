import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("cash distributions explain missing schema and show the frozen components and independent approvals", async ({
  page,
}) => {
  let upgraded = false;
  await page.route("**/api/finance/partners?**", (route) =>
    route.fulfill({
      json: upgraded
        ? {
            cash_schema_version: 1,
            cash_policy: {
              recognition: "settled_collections_including_advances",
            },
            policy: {
              enabled: true,
              periodicity: "monthly",
              approval_role: "owner",
              withdrawals_mode: "explicit_advance",
            },
            periods: [
              {
                id: "period-qa",
                period_start: "2026-01-01",
                period_end: "2026-01-31",
                status: "draft",
                result_minor: "200000",
                snapshot_hash: "a".repeat(64),
                snapshot: {
                  gross_collections_minor: "300600",
                  net_settled_minor: "300000",
                  paid_expenses_minor: "0",
                  losses_opening_minor: "100000",
                  losses_recovered_minor: "100000",
                  losses_remaining_minor: "0",
                },
                approvals: [
                  {
                    approver_id: "user-qa",
                    snapshot_hash: "a".repeat(64),
                    approved_at: "2026-02-01",
                  },
                ],
                allocations: [
                  {
                    id: "allocation-qa",
                    name: "Socio QA",
                    amount_minor: "100000",
                    balance_minor: "100000",
                    payments: [],
                  },
                ],
              },
            ],
          }
        : { policy: null, periods: [] },
    }),
  );
  await page.route("**/api/finance/cash?**", (route) =>
    route.fulfill({ json: { session: null } }),
  );
  await page.goto("/fixture-a/cash-distributions");
  await expect(
    page.getByText(/actualización financiera de la base está pendiente/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar reglas" }),
  ).toBeDisabled();
  upgraded = true;
  await page.reload();
  await expect(page.getByText(/Aprobaciones registradas: 1\/2/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Revisar y aprobar" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Registrar pago" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Neto acreditado", { exact: true }),
  ).toBeVisible();
  await mkdir("docs/verification/1717-20261024", { recursive: true });
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(width);
    await page.screenshot({
      path: `docs/verification/1717-20261024/cash-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Conciliar cobro o devolución" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByLabel("Comisión real del procesador", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Neto acreditado (negativo para devolución)", {
      exact: true,
    }),
  ).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

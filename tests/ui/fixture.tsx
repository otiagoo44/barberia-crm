import { createRoot } from "react-dom/client";
import { WorkspaceProvider } from "../../src/features/organizations/context";
import { Shell } from "../../src/components/shell";
import { Agenda } from "../../src/features/appointments/agenda";
import { Customers } from "../../src/features/customers/customers";
import { DayOverview } from "../../src/features/analytics/day-overview";
import { CheckoutDialog } from "../../src/features/finance/checkout";
import { FinancialDashboard } from "../../src/features/finance/dashboard";
import { Goals } from "../../src/features/goals/goals";
import { Configuration } from "../../src/features/configuration/configuration";
import { usePathname } from "./navigation";
import type { Workspace } from "../../src/lib/types";
const workspace: Workspace = {
  organization: {
    id: "org-qa",
    name: "Barbería · QA aislado",
    slug: "fixture-a",
    timezone: "Etc/UTC",
    currency: "PYG",
    brand_color: "#D7B56D",
    logo_url: null,
  },
  branches: [
    {
      id: "branch-qa",
      name: "Centro · QA",
      slug: "centro",
      timezone: "Etc/UTC",
      active: true,
    },
  ],
  role: "organization_owner",
  profileId: "user-qa",
  fullName: "Operador QA",
  platformAdmin: false,
  staffId: null,
};
function Screen() {
  const path = usePathname();
  if (path.endsWith("/agenda")) return <Agenda />;
  if (path.endsWith("/clientes")) return <Customers />;
  if (path.endsWith("/metas")) return <Goals />;
  if (path.endsWith("/finanzas")) return <FinancialDashboard />;
  if (path.endsWith("/configuracion"))
    return <Configuration module="configuracion" />;
  if (path.endsWith("/checkout"))
    return (
      <>
        <h1>Cobro · QA aislado</h1>
        <CheckoutDialog
          checkoutId="checkout-qa"
          branchId="branch-qa"
          onClose={() => {}}
        />
      </>
    );
  return (
    <section>
      <h1>Inicio · QA aislado</h1>
      <DayOverview />
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <WorkspaceProvider workspace={workspace}>
    <Shell>
      <Screen />
    </Shell>
  </WorkspaceProvider>,
);

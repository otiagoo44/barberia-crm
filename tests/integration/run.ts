import { isolatedDatabase } from "./database";
import { contracts } from "../security/contracts";
import { financeContracts } from "./finance";
import { onboardingContracts } from "./onboarding";
import { hardeningContracts } from "./hardening";
import { productContracts } from "./product-release";
import { migrationUpgradeContracts } from "./migration-upgrade";
import { dashboardUpgradeContracts } from "./dashboard-upgrade";
import { confirmed1717Contracts } from "./confirmed-1717";
import { cashDistributionContracts } from "./cash-distributions";
import { weeklyScheduleContracts } from "./weekly-schedule";
import { pilotUpgradeContracts } from "./pilot-upgrade";
import { notificationEncodingContracts } from "./notification-encoding";
import { initialPasswordContracts } from "./initial-password";
const passwordDb = await isolatedDatabase();
try {
  await initialPasswordContracts(passwordDb.pool);
} finally {
  await passwordDb.stop();
}
await notificationEncodingContracts();
await pilotUpgradeContracts();
const weeklyDb = await isolatedDatabase();
try {
  await weeklyScheduleContracts(weeklyDb.pool);
} finally {
  await weeklyDb.stop();
}
await migrationUpgradeContracts();
await dashboardUpgradeContracts();
const cashPolicyDb = await isolatedDatabase();
try {
  console.log(
    JSON.stringify({
      suite: "collected-partner-distributions",
      ...(await cashDistributionContracts(cashPolicyDb.pool)),
    }),
  );
} finally {
  await cashPolicyDb.stop();
}
const db = await isolatedDatabase();
try {
  const result = await contracts(db.pool);
  console.log(
    JSON.stringify({
      suite: "postgres-security-and-operations",
      passed: result.passed,
      auth_boundary:
        "PostgreSQL roles and fixture auth.users; real Supabase Auth not exercised",
    }),
  );
  await onboardingContracts(db.pool);
} finally {
  await db.stop();
}
const confirmedDb = await isolatedDatabase();
try {
  await confirmed1717Contracts(confirmedDb.pool);
} finally {
  await confirmedDb.stop();
}
const financeDb = await isolatedDatabase();
try {
  console.log(
    JSON.stringify({
      suite: "operational-finance",
      ...(await financeContracts(financeDb.pool, 200)),
    }),
  );
} finally {
  await financeDb.stop();
}
const hardeningDb = await isolatedDatabase();
try {
  console.log(
    JSON.stringify({
      suite: "final-hardening",
      ...(await hardeningContracts(hardeningDb.pool)),
    }),
  );
} finally {
  await hardeningDb.stop();
}
const productDb = await isolatedDatabase();
try {
  console.log(
    JSON.stringify({
      suite: "product-release",
      ...(await productContracts(productDb.pool)),
    }),
  );
} finally {
  await productDb.stop();
}

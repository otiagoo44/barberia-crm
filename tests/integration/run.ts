import { isolatedDatabase } from "./database";
import { contracts } from "../security/contracts";
import { financeContracts } from "./finance";
import { onboardingContracts } from "./onboarding";
import { hardeningContracts } from "./hardening";
import { productContracts } from "./product-release";
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
const financeDb = await isolatedDatabase();
try {
  console.log(
    JSON.stringify({
      suite: "operational-finance",
      ...(await financeContracts(financeDb.pool)),
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

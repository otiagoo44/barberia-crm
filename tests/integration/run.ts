import { isolatedDatabase } from "./database";
import { contracts } from "../security/contracts";
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
} finally {
  await db.stop();
}

import { isolatedDatabase } from "./database";
import { cashDistributionContracts } from "./cash-distributions";
const db = await isolatedDatabase();
try {
  console.log(await cashDistributionContracts(db.pool));
} finally {
  await db.stop();
}

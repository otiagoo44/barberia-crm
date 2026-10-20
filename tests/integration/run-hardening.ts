import { isolatedDatabase } from "./database";
import { hardeningContracts } from "./hardening";
const db = await isolatedDatabase();
try {
  console.log(
    JSON.stringify({
      suite: "final-hardening",
      ...(await hardeningContracts(db.pool)),
    }),
  );
} finally {
  await db.stop();
}

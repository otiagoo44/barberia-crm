import { isolatedDatabase } from "./database";
import { googleCalendarContracts } from "./google-calendar";
const db = await isolatedDatabase();
try {
  await googleCalendarContracts(db.pool);
} finally {
  await db.stop();
}

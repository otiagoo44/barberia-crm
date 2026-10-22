import { isolatedDatabase } from "./database";
import { productContracts } from "./product-release";
const db = await isolatedDatabase();
try {
  console.log(
    JSON.stringify({
      suite: "product-release",
      ...(await productContracts(db.pool)),
    }),
  );
} finally {
  await db.stop();
}

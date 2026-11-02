import {isolatedDatabase} from "./database";
import {publicConfirmationContracts} from "./public-confirmation";
const db=await isolatedDatabase();
try {await publicConfirmationContracts(db.pool);} finally {await db.stop();}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isolatedDatabase } from "./database";

export async function notificationEncodingContracts() {
  const db = await isolatedDatabase(40);
  try {
    const signature = "app_private.process_job_core(uuid,uuid)";
    const definition = async () =>
      (
        await db.pool.query("select pg_get_functiondef($1::regprocedure) sql", [
          signature,
        ])
      ).rows[0].sql as string;
    const metadata = async () =>
      (
        await db.pool.query(
          "select oid,proowner,prosecdef,proconfig,proacl from pg_proc where oid=$1::regprocedure",
          [signature],
        )
      ).rows[0];
    const clean = await definition();
    const originalMetadata = await metadata();
    const migration = await readFile(
      "supabase/migrations/20261025225428_repair_scheduler_notification_encoding.sql",
      "utf8",
    );
    await db.pool.query(migration);
    assert.equal(await definition(), clean, "clean installs remain unchanged");
    let cloud = clean;
    for (const phrase of [
      "Actividad de la barbería",
      "Revisá la agenda",
      "acciones del día.",
    ]) {
      assert.ok(cloud.includes(phrase));
      cloud = cloud.replace(
        phrase,
        Buffer.from(phrase, "utf8").toString("latin1"),
      );
    }
    await db.pool.query(cloud);
    assert.notEqual(await definition(), clean);
    await db.pool.query(migration);
    assert.equal(
      await definition(),
      clean,
      "repair exactly the observed cloud encoding drift",
    );
    assert.deepEqual(
      await metadata(),
      originalMetadata,
      "owner, ACL and security metadata are preserved",
    );
    await db.pool.query(migration);
    assert.equal(await definition(), clean, "repair is idempotent");
    console.log(
      "PASS Scheduler notification encoding: observed cloud drift repaired; clean installs, owner, ACL and security unchanged",
    );
  } finally {
    await db.stop();
  }
}

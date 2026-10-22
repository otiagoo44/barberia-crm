import assert from "node:assert/strict";
import { isolatedDatabase, asUser } from "./database";
import { fixtures } from "./fixtures";
/** Preserve every projection and deny boundary across the measured optimization. */
export async function dashboardUpgradeContracts() {
  const db = await isolatedDatabase(35);
  try {
    const f = await fixtures(db.pool);
    const day = new Date().toISOString().slice(0, 10);
    await db.pool.query(
      "insert into public.customers(organization_id,name,normalized_phone,home_branch_id,expected_return_at) select $1,'Dashboard QA '||n,'+1202777'||lpad(n::text,4,'0'),$2,now()-interval '2 days' from generate_series(1,150)n",
      [f.orgA, f.branches.a1],
    );
    const cases = [
      [f.users.ownerA, null, null],
      [f.users.ownerA, f.branches.a1, null],
      [f.users.ownerA, f.branches.a2, null],
      [f.users.managerA1, f.branches.a1, null],
      [f.users.barberA, f.branches.a1, f.staff.a1],
    ] as const;
    async function snapshots() {
      const results = [];
      for (const [user, branch, staff] of cases) {
        const value = (
          await asUser<{ r: Record<string, unknown> }>(
            db.pool,
            user,
            "select public.dashboard($1,$2,$3,$4,$4) r",
            [f.orgA, branch, staff, day],
          )
        )[0].r;
        const retention = value.retention_now as Record<string, unknown>;
        delete retention.as_of;
        results.push(value);
      }
      return results;
    }
    const previous = await snapshots();
    await db.migrate();
    assert.deepEqual(await snapshots(), previous);
    for (const user of [f.users.ownerB, f.users.receptionA])
      await assert.rejects(
        asUser(db.pool, user, "select public.dashboard($1,$2,null,$3,$3)", [
          f.orgA,
          f.branches.a1,
          day,
        ]),
        { code: "42501" },
      );
    await db.pool.query(
      "update public.organization_memberships set active=false where organization_id=$1 and profile_id=$2",
      [f.orgA, f.users.ownerA],
    );
    await assert.rejects(
      asUser(
        db.pool,
        f.users.ownerA,
        "select public.dashboard($1,$2,null,$3,$3)",
        [f.orgA, f.branches.a1, day],
      ),
      { code: "42501" },
    );
    console.log(
      "PASS Dashboard upgrade: exact owner/manager/barber projections, tenant and reception denies, live owner revocation preserved",
    );
  } finally {
    await db.stop();
  }
}

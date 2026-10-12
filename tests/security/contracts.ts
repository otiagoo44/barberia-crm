import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import type { Pool } from "pg";
import { asUser } from "../integration/database";
import { fixtures } from "../integration/fixtures";
export async function contracts(pool: Pool) {
  const f = await fixtures(pool);
  let passed = 0;
  const timings: number[] = [];
  async function check(name: string, run: () => Promise<void>) {
    const start = performance.now();
    await run();
    passed++;
    timings.push(performance.now() - start);
    console.log(`PASS ${name}`);
  }
  const user = f.users.ownerA;
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(9, 0, 0, 0);
  const at = (days: number, hour = 9) => {
    const d = new Date(tomorrow);
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const booking = async (
    actor: string,
    staff: string | null,
    start: string,
    key: string = randomUUID(),
    services: string[] = [f.services.cut],
    customer = f.customers.a1,
    branch = f.branches.a1,
  ) => {
    const rows = await asUser<{
      result: { id: string; duration_minutes: number; reference: string };
    }>(
      pool,
      actor,
      "select public.create_booking($1,$2,$3,$4,$5,$6,null,$7,null) result",
      [f.orgA, branch, services, staff, start, customer, key],
    );
    return rows[0].result;
  };
  let first: { id: string; duration_minutes: number; reference: string };
  await check("Tenant A cannot read B and vice versa", async () => {
    for (const [actor, org] of [
      [user, f.orgB],
      [f.users.ownerB, f.orgA],
    ]) {
      const rows = await asUser(
        pool,
        actor,
        "select * from public.customers where organization_id=$1",
        [org],
      );
      assert.equal(rows.length, 0);
    }
  });
  await check("Tenant A cannot modify B through RPC", async () => {
    await assert.rejects(
      asUser(
        pool,
        user,
        "select public.manage_record($1,'customers',$2,$3,$4)",
        [f.orgB, f.customers.b1, f.branches.b1, { name: "spoof" }],
      ),
      { code: "42501" },
    );
  });
  await check("Manager A1 cannot see A2", async () => {
    assert.equal(
      (
        await asUser(
          pool,
          f.users.managerA1,
          "select * from public.branches where id=$1",
          [f.branches.a2],
        )
      ).length,
      0,
    );
    assert.equal(
      (
        await asUser(
          pool,
          f.users.managerA1,
          "select * from public.customers where id=$1",
          [f.customers.a2],
        )
      ).length,
      0,
    );
  });
  await check("Reception cannot alter roles", async () => {
    await assert.rejects(
      asUser(
        pool,
        f.users.receptionA,
        "select public.manage_membership($1,$2,$3,true,array[]::uuid[],true)",
        [f.orgA, "managerA1@fixture.invalid", "organization_owner"],
      ),
      { code: "42501" },
    );
  });
  await check("Inactive membership loses access immediately", async () => {
    await pool.query(
      "update public.organization_memberships set active=false where id=$1",
      [f.memberIds.managerA1],
    );
    assert.equal(
      (await asUser(pool, f.users.managerA1, "select * from public.branches"))
        .length,
      0,
    );
    await pool.query(
      "update public.organization_memberships set active=true where id=$1",
      [f.memberIds.managerA1],
    );
  });
  await check("Inactive profile loses access immediately", async () => {
    await pool.query("update public.profiles set active=false where id=$1", [
      f.users.receptionA,
    ]);
    assert.equal(
      (await asUser(pool, f.users.receptionA, "select * from public.customers"))
        .length,
      0,
    );
    await pool.query("update public.profiles set active=true where id=$1", [
      f.users.receptionA,
    ]);
  });
  await check(
    "Tenant identity cannot mutate even with privileged SQL",
    async () => {
      await assert.rejects(
        pool.query(
          "update public.customers set organization_id=$1 where id=$2",
          [f.orgB, f.customers.a1],
        ),
        { code: "23514" },
      );
      await assert.rejects(
        asUser(
          pool,
          user,
          "select public.manage_record($1,'customers',$2,$3,$4)",
          [f.orgA, f.customers.a1, f.branches.a1, { organization_id: f.orgB }],
        ),
        { code: "22023" },
      );
    },
  );
  await check("Composite FK rejects cross-tenant references", async () => {
    await assert.rejects(
      pool.query(
        "insert into public.customer_notes(organization_id,customer_id,body) values($1,$2,$3)",
        [f.orgA, f.customers.b1, "no"],
      ),
      { code: "23503" },
    );
  });
  await check("Anon cannot read business or private tables", async () => {
    await assert.rejects(asUser(pool, null, "select * from public.customers"), {
      code: "42501",
    });
    await assert.rejects(
      asUser(pool, null, "select * from app_private.platform_admins"),
      { code: "42501" },
    );
  });
  await check("Browser roles have no direct write grants", async () => {
    await assert.rejects(
      asUser(pool, user, "update public.customers set name='bad'"),
      { code: "42501" },
    );
    await assert.rejects(
      asUser(pool, user, "delete from public.appointments"),
      { code: "42501" },
    );
  });
  await check("User-editable metadata grants no authorization", async () => {
    await pool.query(
      "update auth.users set raw_user_meta_data=$1 where id=$2",
      [{ role: "platform_admin", organization_id: f.orgB }, f.users.receptionA],
    );
    await assert.rejects(
      asUser(
        pool,
        f.users.receptionA,
        "select public.create_organization($1,$2,$3,$4,$5)",
        ["Bad", "spoofed-org", "Etc/UTC", "USD", f.users.receptionA],
      ),
      { code: "42501" },
    );
  });
  await check(
    "Every exposed table has RLS; public functions are invoker",
    async () => {
      const { rows } = await pool.query(
        "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
      );
      assert.equal(rows.length, 0);
      assert.equal(
        (
          await pool.query(
            "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef",
          )
        ).rows.length,
        0,
      );
      const privileged = await pool.query(
        "select proname,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.prosecdef",
      );
      assert.ok(
        privileged.rows.every((r) => r.proconfig?.includes('search_path=""')),
      );
    },
  );
  await check("Phone uniqueness is per organization", async () => {
    assert.equal(
      (
        await pool.query(
          "select count(*)::integer count from public.customers where normalized_phone=$1",
          ["+12025550101"],
        )
      ).rows[0].count,
      2,
    );
  });
  await check(
    "Server duration: main 40, included 40, additive 50, override 50, special 120",
    async () => {
      const defs: [
        [string[], number],
        [string[], number],
        [string[], number],
        [string[], number],
        [string[], number],
      ] = [
        [[f.services.cut], 40],
        [[f.services.cut, f.services.design], 40],
        [[f.services.cut, f.services.wash], 50],
        [[f.services.cut, f.services.override], 50],
        [[f.services.curl], 120],
      ];
      let hour = 0;
      for (const [services, duration] of defs) {
        const r = await booking(
          user,
          f.staff.a2,
          at(1, hour++ * 3),
          randomUUID(),
          services,
        );
        assert.equal(r.duration_minutes, duration);
      }
    },
  );
  await check(
    "Create booking, history, event and jobs atomically",
    async () => {
      first = await booking(user, f.staff.a1, at(0));
      assert.equal(
        (
          await pool.query(
            "select count(*)::integer count from public.appointment_status_history where appointment_id=$1",
            [first.id],
          )
        ).rows[0].count,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::integer count from public.domain_events where entity_id=$1 and event_type='appointment.created'",
            [first.id],
          )
        ).rows[0].count,
        1,
      );
    },
  );
  await check(
    "Barber sees own agenda but no owner audit/configuration",
    async () => {
      assert.ok(
        (
          await asUser(
            pool,
            f.users.barberA,
            "select * from public.appointments where id=$1",
            [first.id],
          )
        ).length === 1,
      );
      assert.equal(
        (await asUser(pool, f.users.barberA, "select * from public.audit_logs"))
          .length,
        0,
      );
      await assert.rejects(
        asUser(
          pool,
          f.users.barberA,
          "select public.manage_record($1,'organization_settings',null,null,$2)",
          [f.orgA, { booking_enabled: false }],
        ),
        { code: "42501" },
      );
    },
  );
  await check(
    "RPC rejects spoofed organization even with valid appointment ID",
    async () => {
      await assert.rejects(
        asUser(
          pool,
          f.users.ownerB,
          "select public.cancel_booking($1,$2,$3,null)",
          [f.orgA, first.id, randomUUID()],
        ),
        { code: "42501" },
      );
    },
  );
  await check(
    "SQL EXCLUDE rejects overlap independently of booking RPC",
    async () => {
      await assert.rejects(
        pool.query(
          "insert into public.appointments(organization_id,branch_id,customer_id,staff_id,starts_at,ends_at,duration_minutes,currency) values($1,$2,$3,$4,$5::timestamptz,$5::timestamptz+interval '40 minutes',40,'USD')",
          [
            f.orgA,
            f.branches.a1,
            f.customers.a1,
            f.staff.a1,
            new Date(new Date(at(0)).valueOf() + 20 * 60000).toISOString(),
          ],
        ),
        { code: "23P01" },
      );
    },
  );
  await check("Shared staff is protected across branches", async () => {
    await assert.rejects(
      pool.query(
        "insert into public.appointments(organization_id,branch_id,customer_id,staff_id,starts_at,ends_at,duration_minutes,currency) values($1,$2,$3,$4,$5::timestamptz,$5::timestamptz+interval '40 minutes',40,'USD')",
        [f.orgA, f.branches.a2, f.customers.a1, f.staff.a1, at(0)],
      ),
      { code: "23P01" },
    );
  });
  await check("Adjacent intervals are valid", async () => {
    await booking(
      user,
      f.staff.a1,
      new Date(new Date(at(0)).valueOf() + 40 * 60000).toISOString(),
    );
  });
  await check(
    "100 concurrent requests yield exactly one successful booking",
    async () => {
      const result = await Promise.allSettled(
        Array.from({ length: 100 }, () => booking(user, f.staff.a3, at(3))),
      );
      assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        (
          await pool.query(
            "select count(*)::integer count from public.appointments where staff_id=$1 and starts_at=$2",
            [f.staff.a3, at(3)],
          )
        ).rows[0].count,
        1,
      );
    },
  );
  await check("Two resources permit two simultaneous bookings", async () => {
    const r = await Promise.all([
      booking(user, f.staff.a1, at(4)),
      booking(user, f.staff.a2, at(4)),
    ]);
    assert.equal(r.length, 2);
  });
  await check(
    "Three resources permit three simultaneous bookings",
    async () => {
      const r = await Promise.all([
        booking(user, f.staff.a1, at(5)),
        booking(user, f.staff.a2, at(5)),
        booking(user, f.staff.a3, at(5)),
      ]);
      assert.equal(r.length, 3);
    },
  );
  await check(
    "100 retries with one idempotency key yield one record and event",
    async () => {
      const key = randomUUID();
      const r = await Promise.all(
        Array.from({ length: 100 }, () =>
          booking(user, f.staff.a3, at(6), key),
        ),
      );
      assert.equal(new Set(r.map((x) => x.id)).size, 1);
      assert.equal(
        (
          await pool.query(
            "select count(*)::integer count from public.domain_events where entity_id=$1 and event_type='appointment.created'",
            [r[0].id],
          )
        ).rows[0].count,
        1,
      );
      await assert.rejects(booking(user, f.staff.a3, at(6, 10), key), {
        code: "22023",
      });
    },
  );
  await check(
    "Reschedule and cancellation are idempotent; cancelled releases capacity",
    async () => {
      const key = randomUUID();
      const args = [
        f.orgA,
        first.id,
        f.branches.a1,
        f.staff.a1,
        at(0, 12),
        [f.services.cut],
        key,
      ];
      const a = await asUser(
        pool,
        user,
        "select public.reschedule_booking($1,$2,$3,$4,$5,$6,$7)",
        args,
      );
      const b = await asUser(
        pool,
        user,
        "select public.reschedule_booking($1,$2,$3,$4,$5,$6,$7)",
        args,
      );
      assert.deepEqual(a, b);
      const cancel = [f.orgA, first.id, randomUUID(), "Cambio de planes"];
      await asUser(
        pool,
        user,
        "select public.cancel_booking($1,$2,$3,$4)",
        cancel,
      );
      await asUser(
        pool,
        user,
        "select public.cancel_booking($1,$2,$3,$4)",
        cancel,
      );
      await booking(user, f.staff.a1, at(0, 12));
    },
  );
  await check("Exceptional closure and time off reject booking", async () => {
    const start = at(7, 10),
      end = at(7, 12);
    await asUser(
      pool,
      user,
      "select public.manage_record($1,'staff_time_off',null,$2,$3)",
      [
        f.orgA,
        f.branches.a1,
        {
          staff_id: f.staff.a1,
          starts_at: start,
          ends_at: end,
          reason: "test",
        },
      ],
    );
    await assert.rejects(booking(user, f.staff.a1, start), { code: "23P01" });
    await asUser(
      pool,
      user,
      "select public.manage_record($1,'branch_closures',null,$2,$3)",
      [
        f.orgA,
        f.branches.a1,
        { starts_at: at(7, 14), ends_at: at(7, 16), kind: "closed" },
      ],
    );
    await assert.rejects(booking(user, f.staff.a2, at(7, 14)), {
      code: "23P01",
    });
  });
  await check(
    "Availability edits conflicting with booked appointments roll back",
    async () => {
      await assert.rejects(
        asUser(
          pool,
          user,
          "select public.manage_record($1,'staff_time_off',null,$2,$3)",
          [
            f.orgA,
            f.branches.a1,
            { staff_id: f.staff.a1, starts_at: at(5), ends_at: at(5, 10) },
          ],
        ),
        { code: "23514" },
      );
    },
  );
  await check(
    "Public catalog redacts internal IDs and profile IDs",
    async () => {
      const r = await asUser<{ result: unknown }>(
        pool,
        null,
        "select public.public_catalog($1,$2,null) result",
        [f.bookingSecret, "fixture-a"],
      );
      const text = JSON.stringify(r[0].result);
      assert.ok(!text.includes(f.orgA));
      assert.ok(!text.includes(f.users.barberA));
      assert.ok(!text.includes("profile_id"));
      await assert.rejects(
        asUser(pool, null, "select public.public_catalog($1,$2,null)", [
          "bad",
          "fixture-a",
        ]),
        { code: "42501" },
      );
    },
  );
  await check(
    "Public booking works and deduplicates customer without overwriting contact",
    async () => {
      const key = randomUUID();
      const args = [
        f.bookingSecret,
        "fixture-a",
        "a1",
        ["cut"],
        null,
        at(8),
        { name: "Public customer", normalized_phone: "+12025550101" },
        key,
        "",
      ];
      const a = await asUser<{ result: Record<string, unknown> }>(
        pool,
        null,
        "select public.public_booking($1,$2,$3,$4,$5,$6,$7,$8,$9) result",
        args,
      );
      const b = await asUser(
        pool,
        null,
        "select public.public_booking($1,$2,$3,$4,$5,$6,$7,$8,$9) result",
        args,
      );
      assert.deepEqual(a, b);
      assert.ok(!("id" in a[0].result));
      assert.ok(!("staff_id" in a[0].result));
      assert.equal(
        (
          await pool.query("select name from public.customers where id=$1", [
            f.customers.a1,
          ])
        ).rows[0].name,
        "Customer a1",
      );
    },
  );
  await check(
    "Rate limiter rejects excess attempts after committed checks",
    async () => {
      const hash = createHash("sha256").update("fixture-ip").digest("hex");
      for (let i = 0; i < 12; i++)
        await asUser(
          pool,
          null,
          "select public.public_rate_check($1,$2,true)",
          [f.bookingSecret, hash],
        );
      await assert.rejects(
        asUser(pool, null, "select public.public_rate_check($1,$2,true)", [
          f.bookingSecret,
          hash,
        ]),
        { code: "P0001" },
      );
    },
  );
  await check("Honeypot blocks public booking", async () => {
    await assert.rejects(
      asUser(
        pool,
        null,
        "select public.public_booking($1,$2,$3,$4,null,$5,$6,$7,$8)",
        [
          f.bookingSecret,
          "fixture-a",
          "a1",
          ["cut"],
          at(9),
          { name: "Bot", normalized_phone: "+12025550199" },
          randomUUID(),
          "spam",
        ],
      ),
      { code: "22023" },
    );
  });
  await check(
    "State machine: check-in, start, complete; reverse transition denied",
    async () => {
      const current = await booking(
        user,
        f.staff.a3,
        new Date(Date.now() + 60000).toISOString(),
      );
      for (const status of ["checked_in", "in_service", "completed"]) {
        const params = [f.orgA, current.id, status, randomUUID(), null];
        await asUser(
          pool,
          f.users.receptionA,
          "select public.transition_booking($1,$2,$3,$4,$5)",
          params,
        );
        await asUser(
          pool,
          f.users.receptionA,
          "select public.transition_booking($1,$2,$3,$4,$5)",
          params,
        );
      }
      await assert.rejects(
        asUser(
          pool,
          user,
          "select public.transition_booking($1,$2,$3,$4,null)",
          [f.orgA, current.id, "scheduled", randomUUID()],
        ),
        { code: "23514" },
      );
      const c = (
        await pool.query(
          "select expected_return_at from public.customers where id=$1",
          [f.customers.a1],
        )
      ).rows[0];
      assert.ok(c.expected_return_at > Date.now());
      const next = await asUser(
        pool,
        user,
        "select public.create_booking($1,$2,$3,$4,$5,$6,null,$7,$8)",
        [
          f.orgA,
          f.branches.a1,
          [f.services.cut],
          f.staff.a1,
          at(20),
          f.customers.a1,
          randomUUID(),
          current.id,
        ],
      );
      assert.equal(next.length, 1);
    },
  );
  await check(
    "Walk-in becomes real appointment without duplicate customer",
    async () => {
      const key = randomUUID();
      const args = [
        f.orgA,
        f.branches.a1,
        f.customers.a1,
        null,
        [f.services.cut],
        f.staff.a2,
        key,
      ];
      const created = await asUser<{ result: { id: string } }>(
        pool,
        user,
        "select public.create_walkin($1,$2,$3,$4,$5,$6,$7) result",
        args,
      );
      await asUser(
        pool,
        user,
        "select public.create_walkin($1,$2,$3,$4,$5,$6,$7)",
        args,
      );
      const id = created[0].result.id;
      await asUser(pool, user, "select public.assign_walkin($1,$2,$3,$4,$5)", [
        f.orgA,
        id,
        f.staff.a2,
        new Date(Date.now() + 30000).toISOString(),
        randomUUID(),
      ]);
      const { rows } = await pool.query(
        "select w.customer_id,w.appointment_id,a.customer_id booked_customer from public.walk_in_entries w join public.appointments a on a.id=w.appointment_id where w.id=$1",
        [id],
      );
      assert.equal(rows[0].customer_id, rows[0].booked_customer);
      assert.equal(
        (
          await pool.query(
            "select count(*)::integer count from public.customers where organization_id=$1 and normalized_phone=$2",
            [f.orgA, "+12025550101"],
          )
        ).rows[0].count,
        1,
      );
    },
  );
  await check(
    "Customer pagination, detail and timeline obey branch permissions",
    async () => {
      const page = await asUser<{ result: { items: unknown[] } }>(
        pool,
        f.users.managerA1,
        "select public.list_customers($1,$2,'',null,50,'all') result",
        [f.orgA, f.branches.a1],
      );
      assert.ok(page[0].result.items.length > 0);
      const timeline = await asUser<{ result: { items: unknown[] } }>(
        pool,
        user,
        "select public.customer_timeline($1,$2,null,null,30) result",
        [f.orgA, f.customers.a1],
      );
      assert.ok(timeline[0].result.items.length > 0);
      await assert.rejects(
        asUser(
          pool,
          f.users.managerA1,
          "select public.customer_detail($1,$2)",
          [f.orgA, f.customers.a2],
        ),
        { code: "42501" },
      );
    },
  );
  await check(
    "Daily queue read and agenda return bounded real data",
    async () => {
      assert.equal(
        (
          await asUser(pool, user, "select public.day_status($1,$2)", [
            f.orgA,
            f.branches.a1,
          ])
        ).length,
        1,
      );
      const day = await asUser<{ result: { items: unknown[] } }>(
        pool,
        user,
        "select public.list_agenda($1,$2,null,null,null,$3,$4) result",
        [f.orgA, f.branches.a1, at(5, 0), at(6, 0)],
      );
      assert.equal(day[0].result.items.length, 3);
    },
  );
  await check("Audit history is append-only even for table owner", async () => {
    await assert.rejects(
      pool.query("update public.audit_logs set action='tampered'"),
      { code: "42501" },
    );
    await assert.rejects(pool.query("delete from public.audit_logs"), {
      code: "42501",
    });
  });
  await check(
    "Queue leases, notifications, metrics and provider pending status work",
    async () => {
      for (let batch = 0; batch < 15; batch++) {
        const claimed = await asUser<{
          result: { id: string; lease_token: string }[];
        }>(pool, null, "select public.claim_jobs($1,20) result", [
          f.workerSecret,
        ]);
        if (!claimed[0].result.length) break;
        for (const job of claimed[0].result)
          await asUser(pool, null, "select public.process_job($1,$2,$3)", [
            f.workerSecret,
            job.id,
            job.lease_token,
          ]);
      }
      assert.ok(
        (
          await pool.query(
            "select count(*)::integer count from public.notifications",
          )
        ).rows[0].count > 0,
      );
      assert.ok(
        (
          await pool.query(
            "select count(*)::integer count from public.daily_metrics",
          )
        ).rows[0].count > 0,
      );
      assert.ok(
        (
          await pool.query(
            "select count(*)::integer count from public.automation_jobs where status='awaiting_configuration'",
          )
        ).rows[0].count > 0,
      );
    },
  );
  await check(
    "Dashboard, capacity and goals use authorized dimensions",
    async () => {
      const from = new Date().toISOString().slice(0, 10);
      const dashboard = await asUser<{
        result: { totals: { completed: number } };
      }>(pool, user, "select public.dashboard($1,$2,null,$3,$3) result", [
        f.orgA,
        f.branches.a1,
        from,
      ]);
      assert.ok(dashboard[0].result.totals.completed >= 1);
      await assert.rejects(
        asUser(
          pool,
          f.users.managerA1,
          "select public.dashboard($1,$2,null,$3,$3)",
          [f.orgA, f.branches.a2, from],
        ),
        { code: "42501" },
      );
      const goal = await asUser<{ result: { id: string } }>(
        pool,
        user,
        "select public.manage_record($1,'goals',null,$2,$3) result",
        [
          f.orgA,
          f.branches.a1,
          {
            name: "Fixture goal",
            metric: "appointments_completed",
            period: "day",
            target_value: 2,
            starts_at: from + "T00:00:00Z",
            ends_at: new Date(
              new Date(from + "T00:00:00Z").getTime() + 86400000,
            ).toISOString(),
          },
        ],
      );
      const progress = await asUser<{ result: { value: number } }>(
        pool,
        user,
        "select public.goal_progress($1,$2) result",
        [f.orgA, goal[0].result.id],
      );
      assert.ok(progress[0].result.value >= 1);
    },
  );
  await check(
    "Platform can onboard independent organization; receptionist cannot",
    async () => {
      const result = await asUser(
        pool,
        f.users.platform,
        "select public.create_organization_for_email($1,$2,$3,$4,$5)",
        [
          "Third fixture",
          "fixture-c",
          "America/Asuncion",
          "PYG",
          "ownerA@fixture.invalid",
        ],
      );
      assert.equal(result.length, 1);
      await assert.rejects(
        asUser(
          pool,
          f.users.receptionA,
          "select public.create_organization_for_email($1,$2,$3,$4,$5)",
          [
            "Spoof",
            "fixture-spoof",
            "Etc/UTC",
            "USD",
            "ownerA@fixture.invalid",
          ],
        ),
        { code: "42501" },
      );
    },
  );
  await check(
    "Membership directory only owner; real identities are scoped",
    async () => {
      const rows = await asUser<{ result: { items: { email: string }[] } }>(
        pool,
        user,
        "select public.list_memberships($1,null) result",
        [f.orgA],
      );
      assert.ok(
        rows[0].result.items.some((m) => m.email === "ownerA@fixture.invalid"),
      );
      assert.ok(
        !rows[0].result.items.some((m) => m.email === "ownerB@fixture.invalid"),
      );
      await assert.rejects(
        asUser(
          pool,
          f.users.receptionA,
          "select public.list_memberships($1,null)",
          [f.orgA],
        ),
        { code: "42501" },
      );
    },
  );
  await check(
    "Completed services schedule maintenance and infer configured return",
    async () => {
      await pool.query(
        "update public.services set requires_maintenance=true where id=$1",
        [f.services.cut],
      );
      const appointment = (
        await pool.query(
          "select id from public.appointments where organization_id=$1 and status='completed' limit 1",
          [f.orgA],
        )
      ).rows[0];
      await pool.query("select app_private.refresh_service_returns($1,$2)", [
        f.orgA,
        appointment.id,
      ]);
      assert.ok(
        (
          await pool.query(
            "select count(*)::integer count from public.customer_service_returns where organization_id=$1",
            [f.orgA],
          )
        ).rows[0].count > 0,
      );
      assert.equal(
        (
          await pool.query(
            "select app_private.estimate_return_days($1,$2,$3) days",
            [f.orgA, f.customers.a1, appointment.id],
          )
        ).rows[0].days,
        21,
      );
      await assert.rejects(
        asUser(
          pool,
          f.users.ownerB,
          "select public.maintenance_due($1,null,null)",
          [f.orgA],
        ),
        { code: "42501" },
      );
    },
  );
  await check(
    "Request ID survives booking audit and event correlation",
    async () => {
      const requestId = randomUUID();
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("set local role authenticated");
        await client.query(
          "select set_config('request.jwt.claim.sub',$1,true),set_config('request.headers',$2,true)",
          [user, JSON.stringify({ "x-request-id": requestId })],
        );
        const made = await client.query(
          "select public.create_booking($1,$2,$3,$4,$5,$6,null,$7,null) result",
          [
            f.orgA,
            f.branches.a1,
            [f.services.cut],
            f.staff.a1,
            at(25),
            f.customers.a1,
            randomUUID(),
          ],
        );
        await client.query("commit");
        const logs = await pool.query(
          "select request_id from public.audit_logs where entity_id=$1 and action='appointment.created'",
          [made.rows[0].result.id],
        );
        assert.ok(logs.rows.length);
        assert.equal(logs.rows[0].request_id, requestId);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  );
  await check(
    "Currency cannot change after reliable price history",
    async () => {
      await assert.rejects(
        asUser(pool, user, "select public.update_organization($1,$2)", [
          f.orgA,
          { currency: "PYG" },
        ]),
        { code: "23514" },
      );
    },
  );
  await check("Reception cannot read owner report aggregates", async () => {
    for (const table of [
      "daily_metrics",
      "daily_service_metrics",
      "daily_customer_activity",
      "capacity_snapshots",
    ])
      assert.equal(
        (
          await asUser(
            pool,
            f.users.receptionA,
            `select id from public.${table} where organization_id=$1`,
            [f.orgA],
          )
        ).length,
        0,
      );
  });
  await check(
    "Archiving a branch preserves history and prevents new operations",
    async () => {
      const visit = randomUUID();
      await pool.query(
        "insert into public.appointments(id,organization_id,branch_id,customer_id,staff_id,starts_at,ends_at,duration_minutes,status,currency,completed_at) values($1,$2,$3,$4,$5,now()-interval '1 day',now()-interval '1 day'+interval '40 minutes',40,'completed','USD',now()-interval '1 day'+interval '40 minutes')",
        [visit, f.orgA, f.branches.a2, f.customers.a2, f.staff.a1],
      );
      await asUser(
        pool,
        user,
        "select public.manage_record($1,'branches',$2,null,$3)",
        [f.orgA, f.branches.a2, { active: false }],
      );
      assert.equal(
        (
          await asUser(
            pool,
            user,
            "select id from public.appointments where id=$1",
            [visit],
          )
        ).length,
        1,
      );
      assert.equal(
        (
          await asUser(
            pool,
            f.users.managerA1,
            "select id from public.appointments where id=$1",
            [visit],
          )
        ).length,
        0,
      );
      await assert.rejects(
        booking(
          user,
          f.staff.a1,
          at(27),
          randomUUID(),
          [f.services.cut],
          f.customers.a2,
          f.branches.a2,
        ),
        { code: "42501" },
      );
      await asUser(
        pool,
        user,
        "select public.manage_record($1,'branches',$2,null,$3)",
        [f.orgA, f.branches.a2, { active: true }],
      );
    },
  );
  await check(
    "Platform bootstrap is append-only and hidden from tenant owners",
    async () => {
      const logs = (
        await pool.query(
          "select id from public.audit_logs where organization_id is null and action='platform_admin.insert'",
        )
      ).rows;
      assert.equal(logs.length, 1);
      assert.equal(
        (
          await asUser(
            pool,
            user,
            "select id from public.audit_logs where id=$1",
            [logs[0].id],
          )
        ).length,
        0,
      );
      assert.equal(
        (
          await asUser(
            pool,
            f.users.platform,
            "select id from public.audit_logs where id=$1",
            [logs[0].id],
          )
        ).length,
        1,
      );
    },
  );
  await check(
    "Archived customers stay scoped and can be explicitly restored",
    async () => {
      await asUser(
        pool,
        user,
        "select public.manage_record($1,'customers',$2,$3,$4)",
        [
          f.orgA,
          f.customers.a2,
          f.branches.a2,
          { archived_at: new Date().toISOString() },
        ],
      );
      const archived = await asUser<{ result: { items: { id: string }[] } }>(
        pool,
        user,
        "select public.list_customers($1,null,'',null,50,'archived') result",
        [f.orgA],
      );
      assert.ok(archived[0].result.items.some((c) => c.id === f.customers.a2));
      const active = await asUser<{ result: { items: { id: string }[] } }>(
        pool,
        user,
        "select public.list_customers($1,null,'',null,50,'all') result",
        [f.orgA],
      );
      assert.ok(!active[0].result.items.some((c) => c.id === f.customers.a2));
      await assert.rejects(
        asUser(
          pool,
          f.users.ownerB,
          "select public.list_customers($1,null,'',null,50,'archived')",
          [f.orgA],
        ),
        { code: "42501" },
      );
      await asUser(
        pool,
        user,
        "select public.manage_record($1,'customers',$2,$3,$4)",
        [f.orgA, f.customers.a2, f.branches.a2, { archived_at: null }],
      );
    },
  );

  await check("Website metadata can be configured by owner, not reception", async () => {
    await assert.rejects(asUser(pool, f.users.receptionA, "select public.manage_record($1,'services',$2,null,$3)", [f.orgA,f.services.curl,{website_category:"rulos",consultation_required:true}]), {code:"42501"});
    await asUser(pool, f.users.ownerA, "select public.manage_record($1,'services',$2,null,$3)", [f.orgA,f.services.curl,{website_category:"rulos",consultation_required:true}]);
    await assert.rejects(pool.query("update public.services set consultation_required=false where id=$1",[f.services.curl]),{code:"23514"});
    const r=await asUser<{result: {website_booking_version:number;branches: {services:{slug:string;consultation_required:boolean}[]}[]}}>(pool,null,"select public.public_catalog($1,$2,$3) result",[f.bookingSecret,"fixture-a","a1"]);
    assert.equal(r[0].result.website_booking_version,1);
    assert.equal(r[0].result.branches[0].services.find(s=>s.slug==="cut")?.consultation_required,false);
    assert.equal(r[0].result.branches[0].services.find(s=>s.slug==="curl")?.consultation_required,true);
  });
  await check("Consultation service rejects forged public availability and booking",async()=>{
    await assert.rejects(asUser(pool,null,"select public.public_availability($1,$2,$3,$4,null,current_date+1)",[f.bookingSecret,"fixture-a","a1",["curl"]]),{code:"22023"});
    await assert.rejects(asUser(pool,null,"select public.public_booking($1,$2,$3,$4,null,$5,$6,$7,'',$8)",[f.bookingSecret,"fixture-a","a1",["curl"],at(25),{name:"Consultation fixture",normalized_phone:"+12025550222"},randomUUID(),"website"]),{code:"22023"});
    // Authenticated reception retains the engine for evaluated services.
    const r=await asUser<{result:{id:string}}>(pool,f.users.receptionA,"select public.create_booking($1,$2,$3,$4,$5,$6,null,$7,null) result",[f.orgA,f.branches.a1,[f.services.curl],f.staff.a3,at(25),f.customers.a1,randomUUID()]);
    assert.ok(r[0].result.id);
  });
  await check("Website attribution preserves public rules, tenant isolation and idempotency",async()=>{
    const key=randomUUID();
    const args=[f.bookingSecret,"fixture-a","a1",["cut"],null,at(26),{name:"Website fixture",normalized_phone:"+12025550223"},key,"","website"];
    const sql="select public.public_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result";
    const a=await asUser<{result:{reference:string}}>(pool,null,sql,args);
    assert.deepEqual(await asUser(pool,null,sql,args),a);
    const row=(await pool.query("select id,source,booking_attribution,duration_minutes from public.appointments where public_reference=$1",[a[0].result.reference])).rows[0];
    assert.equal(row.source,"public");assert.equal(row.booking_attribution,"website");assert.equal(row.duration_minutes,40);
    const events=await pool.query("select payload from public.domain_events where entity_id=$1 and event_type='appointment.created'",[row.id]);
    assert.equal(events.rows.length,1);
    const attributionEvents=await pool.query("select payload from public.domain_events where entity_id=$1 and event_type='booking.attributed'",[row.id]);
    assert.equal(attributionEvents.rows.length,1);assert.equal(attributionEvents.rows[0].payload.attribution,"website");
    await assert.rejects(asUser(pool,null,sql,[...args.slice(0,9),null]),{code:"22023"});
    await assert.rejects(asUser(pool,null,sql,[...args.slice(0,9),"internal"]),{code:"22023"});
    await assert.rejects(asUser(pool,null,sql,[f.bookingSecret,"fixture-b","a1",["cut"],null,at(27),args[6],randomUUID(),"","website"]),{code:"P0002"});
    await pool.query("update public.organization_settings set booking_lead_minutes=120 where organization_id=$1",[f.orgA]);
    await assert.rejects(asUser(pool,null,sql,[...args.slice(0,5),new Date(Date.now()+60000).toISOString(),args[6],randomUUID(),"","website"]),{code:"22023"});
    await pool.query("update public.organization_settings set booking_lead_minutes=0 where organization_id=$1",[f.orgA]);
  });
  await check("Anonymous cannot access attribution ledger or unattributed engine",async()=>{
    await assert.rejects(asUser(pool,null,"select * from app_private.booking_attributions"),{code:"42501"});
    await assert.rejects(asUser(pool,null,"select app_private.public_booking_unattributed($1,$2,$3,$4,null,$5,$6,$7,'')",[f.bookingSecret,"fixture-a","a1",["cut"],at(28),{name:"Bypass",normalized_phone:"+12025550224"},randomUUID()]),{code:"42501"});
  });
  return { passed, timings };
}

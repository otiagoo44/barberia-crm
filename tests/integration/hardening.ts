import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { asUser } from "./database";
import { fixtures } from "./fixtures";

export async function hardeningContracts(pool: Pool) {
  const f = await fixtures(pool);
  let passed = 0;
  const check = async (name: string, fn: () => Promise<void>) => {
    await fn();
    passed++;
    console.log(`PASS Hardening: ${name}`);
  };
  const finance = randomUUID();
  await pool.query(
    "insert into auth.users(id,email) values($1,'scoped-finance@fixture.invalid')",
    [finance],
  );
  await asUser(
    pool,
    f.users.ownerA,
    "select public.manage_membership($1,$2,'finance',false,$3,true)",
    [f.orgA, "scoped-finance@fixture.invalid", [f.branches.a1]],
  );
  const command = async (
    action: string,
    data: object,
    actor = f.users.ownerA,
    branch = f.branches.a1,
    key = randomUUID(),
  ) =>
    (
      await asUser<{ result: { id: string } }>(
        pool,
        actor,
        "select public.finance_command($1,$2,$3,$4,$5) result",
        [f.orgA, branch, action, JSON.stringify(data), key],
      )
    )[0].result;
  const read = (
    actor: string,
    view: string,
    branch = f.branches.a1,
    id: string | null = null,
  ) =>
    asUser<{ result: Record<string, unknown> }>(
      pool,
      actor,
      "select public.finance_read($1,$2,$3,current_date,current_date,50,0,'',$4) result",
      [f.orgA, branch, view, id],
    );
  await command("configure_settings", { advances_deductible: false });
  const method = (
    await command("configure", {
      entity: "payment_methods",
      name: "Transfer",
      code: "audit_transfer",
      type: "bank",
    })
  ).id;
  await command("configure", {
    entity: "payment_method_fee_rules",
    payment_method_id: method,
    percentage_bps: 0,
    fixed_amount_minor: 0,
  });
  const category = (
    await command("configure", {
      entity: "expense_categories",
      name: "Rent",
      code: "audit_rent",
      kind: "operating",
    })
  ).id;
  const item = (
    await command("configure", {
      entity: "finance_items",
      name: "Audit product",
      kind: "product",
      price_minor: 1000,
    })
  ).id;
  const expenseData = {
    category_id: category,
    payment_method_id: method,
    amount_minor: 100,
    description: "Audit rent",
  };

  await check(
    "platform flag gives no tenant SELECT, writes, export or business RPC",
    async () => {
      for (const table of [
        "organizations",
        "customers",
        "profiles",
        "audit_logs",
        "finance_settings",
        "checkouts",
      ])
        assert.equal(
          (
            await asUser(
              pool,
              f.users.platform,
              `select id from public.${table} where ${table === "organizations" ? "id" : table === "profiles" ? "id" : "organization_id"}=$1`,
              [table === "profiles" ? f.users.ownerA : f.orgA],
            )
          ).length,
          0,
          table,
        );
      await assert.rejects(
        () => command("create_expense", expenseData, f.users.platform),
        { code: "42501" },
      );
      await assert.rejects(
        () =>
          asUser(
            pool,
            f.users.platform,
            "select public.financial_export($1,$2,'expenses',current_date,current_date)",
            [f.orgA, f.branches.a1],
          ),
        { code: "42501" },
      );
      await assert.rejects(
        () =>
          asUser(
            pool,
            f.users.platform,
            "insert into public.customers(organization_id,home_branch_id,name,normalized_phone) values($1,$2,'malicious','+12025559999')",
            [f.orgA, f.branches.a1],
          ),
        { code: "42501" },
      );
    },
  );
  await check(
    "support requires ticket, exact tenant/branch, platform role and writes audit",
    async () => {
      const q = "select public.platform_support_snapshot($1,$2,$3) result";
      await assert.rejects(
        () => asUser(pool, f.users.ownerA, q, [f.orgA, f.branches.a1, "SUP-1"]),
        { code: "42501" },
      );
      await assert.rejects(
        () => asUser(pool, f.users.platform, q, [f.orgA, f.branches.a1, null]),
        { code: "22023" },
      );
      await assert.rejects(
        () =>
          asUser(pool, f.users.platform, q, [f.orgA, f.branches.b1, "SUP-1"]),
        { code: "P0002" },
      );
      const result = (
        await asUser<{ result: Record<string, unknown> }>(
          pool,
          f.users.platform,
          q,
          [f.orgA, f.branches.a1, "SUP-1"],
        )
      )[0].result;
      assert.deepEqual(
        Object.keys(result).sort(),
        [
          "organization_id",
          "organization_active",
          "branch_id",
          "branch_active",
          "booking_enabled",
          "pending_jobs",
          "dead_jobs",
        ].sort(),
      );
      const logs = await pool.query(
        "select actor_id,metadata from public.audit_logs where organization_id=$1 and action='platform.support_snapshot'",
        [f.orgA],
      );
      assert.equal(logs.rows.length, 1);
      assert.equal(logs.rows[0].actor_id, f.users.platform);
      assert.equal(logs.rows[0].metadata.ticket, "SUP-1");
    },
  );
  await check(
    "platform flag does not elevate an ordinary receptionist membership",
    async () => {
      await pool.query(
        "insert into public.organization_memberships(organization_id,profile_id,role,all_branches) values($1,$2,'receptionist',true)",
        [f.orgA, f.users.platform],
      );
      await read(f.users.platform, "cash");
      await assert.rejects(() => read(f.users.platform, "settlements"), {
        code: "42501",
      });
      await assert.rejects(
        () =>
          command(
            "configure_settings",
            { advances_deductible: true },
            f.users.platform,
          ),
        { code: "42501" },
      );
    },
  );
  const roles = {
    owner: f.users.ownerA,
    manager: f.users.managerA1,
    reception: f.users.receptionA,
    barber: f.users.barberA,
    finance,
    foreignOwner: f.users.ownerB,
  };
  for (const [role, actor] of Object.entries(roles)) {
    await check(
      `${role}: object, row, field and export boundaries`,
      async () => {
        assert.equal(
          (
            await asUser(
              pool,
              actor,
              "select id from public.customers where organization_id=$1",
              [f.orgB],
            )
          ).length,
          role === "foreignOwner" ? 1 : 0,
        );
        const settings = await asUser(
          pool,
          actor,
          "select profit_share_staff_ids from public.finance_settings where organization_id=$1",
          [f.orgA],
        );
        assert.equal(
          settings.length,
          ["owner", "finance"].includes(role) ? 1 : 0,
        );
        if (["reception", "barber", "foreignOwner"].includes(role))
          await assert.rejects(() => read(actor, "settlements"));
        else await read(actor, "settlements");
        if (["owner", "finance"].includes(role))
          await asUser(
            pool,
            actor,
            "select public.financial_export($1,$2,'expenses',current_date,current_date)",
            [f.orgA, f.branches.a1],
          );
        else
          await assert.rejects(
            () =>
              asUser(
                pool,
                actor,
                "select public.financial_export($1,$2,'expenses',current_date,current_date)",
                [f.orgA, f.branches.a1],
              ),
            { code: "42501" },
          );
        if (role !== "owner")
          await assert.rejects(
            () =>
              asUser(
                pool,
                actor,
                "select public.manage_membership($1,'ownerB@fixture.invalid','organization_owner',true,'{}',true)",
                [f.orgA],
              ),
            { code: "42501" },
          );
      },
    );
  }
  await check(
    "finance scopes survive membership provisioning and reject foreign branches",
    async () => {
      await read(finance, "expenses");
      await assert.rejects(() => read(finance, "expenses", f.branches.a2), {
        code: "42501",
      });
      await assert.rejects(
        () => command("create_expense", expenseData, finance, f.branches.a2),
        { code: "42501" },
      );
      await assert.rejects(
        () =>
          command(
            "configure",
            {
              entity: "commission_rules",
              staff_id: f.staff.a1,
              service_id: f.services.cut,
              rate_bps: 100,
            },
            finance,
            f.branches.a2,
          ),
        { code: "42501" },
      );
      assert.equal(
        (
          await asUser(
            pool,
            finance,
            "select id from public.branches where id=$1",
            [f.branches.a2],
          )
        ).length,
        0,
      );
    },
  );
  await check(
    "barber read-model contains only own staff; foreign staff RPC denied",
    async () => {
      const result = (await read(f.users.barberA, "catalog"))[0].result;
      assert.deepEqual(
        (result.staff as { id: string }[]).map((s) => s.id),
        [f.staff.a1],
      );
      assert.equal(result.settings, null);
      assert.deepEqual(result.commission_rules, []);
      await assert.rejects(
        () => read(f.users.barberA, "staff", f.branches.a1, f.staff.a2),
        { code: "42501" },
      );
      await assert.rejects(
        () => read(f.users.barberA, "checkout", f.branches.a1, randomUUID()),
        { code: "42501" },
      );
    },
  );
  await check(
    "revocation denies a previously authorized actor on the next SQL statement",
    async () => {
      await read(finance, "expenses");
      await pool.query(
        "update public.organization_memberships set active=false where organization_id=$1 and profile_id=$2",
        [f.orgA, finance],
      );
      await assert.rejects(
        () => command("create_expense", expenseData, finance),
        { code: "42501" },
      );
      assert.equal(
        (
          await asUser(
            pool,
            finance,
            "select id from public.finance_settings where organization_id=$1",
            [f.orgA],
          )
        ).length,
        0,
      );
      await pool.query(
        "update public.organization_memberships set active=true where organization_id=$1 and profile_id=$2",
        [f.orgA, finance],
      );
    },
  );
  await check(
    "archived branches retain history and reject new financial movements",
    async () => {
      await pool.query("update public.branches set active=false where id=$1", [
        f.branches.a1,
      ]);
      await read(f.users.ownerA, "expenses");
      await assert.rejects(() => command("create_expense", expenseData), {
        code: "23514",
      });
      await pool.query("update public.branches set active=true where id=$1", [
        f.branches.a1,
      ]);
    },
  );
  await check(
    "direct RPC nulls cannot remove limits or date bounds",
    async () => {
      await assert.rejects(
        () =>
          asUser(
            pool,
            f.users.ownerA,
            "select public.finance_read($1,$2,'expenses',current_date,current_date,null,0,'',null)",
            [f.orgA, f.branches.a1],
          ),
        { code: "22023" },
      );
      await assert.rejects(
        () =>
          asUser(
            pool,
            f.users.ownerA,
            "select public.list_customers($1,$2,'',null,null,'all')",
            [f.orgA, f.branches.a1],
          ),
        { code: "22023" },
      );
      await assert.rejects(
        () => pool.query("select app_private.claim_jobs_core(null)"),
        { code: "22023" },
      );
    },
  );
  await check(
    "31-day financial idempotency survives cron and concurrent RPC retries",
    async () => {
      const key = randomUUID();
      const original = await command(
        "create_expense",
        expenseData,
        f.users.ownerA,
        f.branches.a1,
        key,
      );
      await pool.query(
        "update app_private.idempotency_keys set created_at=now()-interval '31 days' where key=$1",
        [key],
      );
      await pool.query("select app_private.worker_tick_core()");
      const retries = await Promise.all(
        Array.from({ length: 8 }, () =>
          command(
            "create_expense",
            expenseData,
            f.users.ownerA,
            f.branches.a1,
            key,
          ),
        ),
      );
      assert.ok(retries.every((r) => r.id === original.id));
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from public.expenses where id=$1",
            [original.id],
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(() =>
        command(
          "create_expense",
          { ...expenseData, amount_minor: 101 },
          f.users.ownerA,
          f.branches.a1,
          key,
        ),
      );
    },
  );
  const importCall = async (action: string, data: object, key = randomUUID()) =>
    (
      await asUser<{
        result: { id: string; preview_hash: string; imported_rows: number };
      }>(
        pool,
        f.users.ownerA,
        "select public.finance_import($1,$2,$3,$4,$5) result",
        [f.orgA, f.branches.a1, action, JSON.stringify(data), key],
      )
    )[0].result;
  const row = (n: number, amount = 100) => ({
    source_sheet: "Registro Diario",
    source_row: n,
    raw_values: [{ value: "audit" }],
    normalized: {
      date: "2026-04-06",
      type: "expense",
      category_id: category,
      category_kind: "operating",
      payment_method_id: method,
      amount_minor: amount,
      concept: "Audit historical rent",
    },
    anomalies: [],
    review_status: "READY",
  });
  await check(
    "revised preview excludes omitted rows and null/stale confirmation hash fails",
    async () => {
      const source = {
        source_file: "audit.csv",
        source_sha256: "c".repeat(64),
      };
      const first = await importCall("preview", {
        ...source,
        rows: [row(2), row(3, 200)],
      });
      const second = await importCall("preview", { ...source, rows: [row(2)] });
      assert.equal(first.id, second.id);
      await assert.rejects(() => importCall("confirm", { id: second.id }), {
        code: "23514",
      });
      await assert.rejects(
        () =>
          importCall("confirm", {
            id: second.id,
            preview_hash: first.preview_hash,
          }),
        { code: "23514" },
      );
      const attempts = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          importCall("confirm", {
            id: second.id,
            preview_hash: second.preview_hash,
          }),
        ),
      );
      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
      const rows = (
        await pool.query(
          "select source_row,review_status,expense_id from public.finance_import_rows where batch_id=$1 order by source_row",
          [second.id],
        )
      ).rows;
      assert.equal(rows[0].review_status, "IMPORTED");
      assert.equal(rows[1].review_status, "EXCLUDED");
      assert.equal(rows[1].expense_id, null);
    },
  );
  await check(
    "failed import rolls back earlier movements, provenance and idempotency together",
    async () => {
      const preview = await importCall("preview", {
        source_file: "bad.csv",
        source_sha256: "d".repeat(64),
        rows: [row(2), row(3, 0)],
      });
      const before = (
        await pool.query("select count(*)::int n from public.expenses")
      ).rows[0].n;
      const key = randomUUID();
      await assert.rejects(() =>
        importCall(
          "confirm",
          { id: preview.id, preview_hash: preview.preview_hash },
          key,
        ),
      );
      assert.equal(
        (await pool.query("select count(*)::int n from public.expenses"))
          .rows[0].n,
        before,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from public.finance_import_rows where batch_id=$1 and review_status='IMPORTED'",
            [preview.id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from app_private.idempotency_keys where key=$1",
            [key],
          )
        ).rows[0].n,
        0,
      );
    },
  );
  await check(
    "concurrent reversal creates exactly one refund and preserves net money",
    async () => {
      const sale = (
        await command("create_checkout", {
          lines: [{ item_id: item, quantity: 1 }],
        })
      ).id;
      await command("post_checkout", {
        id: sale,
        payments: [{ payment_method_id: method, amount_minor: 1000 }],
      });
      const attempts = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          command("reverse_financial_transaction", {
            entity_type: "checkout",
            id: sale,
            reason: "Audit refund",
          }),
        ),
      );
      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
      const ledger = (
        await pool.query(
          "select count(*)::int n,sum(amount_minor*direction)::bigint net from public.payments where checkout_id=$1",
          [sale],
        )
      ).rows[0];
      assert.equal(ledger.n, 2);
      assert.equal(Number(ledger.net), 0);
    },
  );
  await check(
    "worker rejects absent/null/stale leases, claims once, retries to dead",
    async () => {
      await pool.query(
        "update public.automation_jobs set available_at=now()+interval '1 day' where status='pending'",
      );
      const id = (
        await pool.query(
          "insert into public.automation_jobs(organization_id,branch_id,job_type,max_attempts) values($1,$2,'unsupported_audit_job',2) returning id",
          [f.orgA, f.branches.a1],
        )
      ).rows[0].id;
      await assert.rejects(
        () => pool.query("select app_private.process_job_core($1,null)", [id]),
        { code: "42501" },
      );
      await assert.rejects(
        () =>
          pool.query("select app_private.process_job_core($1,null)", [
            randomUUID(),
          ]),
        { code: "42501" },
      );
      const claims = await Promise.all(
        Array.from({ length: 4 }, () =>
          pool.query("select app_private.claim_jobs_core(1) jobs"),
        ),
      );
      const jobs = claims.flatMap(
        (r) => r.rows[0].jobs as { id: string; lease_token: string }[],
      );
      assert.equal(jobs.filter((j) => j.id === id).length, 1);
      const job = jobs.find((j) => j.id === id)!;
      await assert.rejects(
        () =>
          pool.query("select app_private.process_job_core($1,$2)", [
            id,
            randomUUID(),
          ]),
        { code: "42501" },
      );
      await pool.query("select app_private.fail_job_core($1,$2)", [
        id,
        job.lease_token,
      ]);
      assert.equal(
        (
          await pool.query(
            "select status,available_at>now() backoff from public.automation_jobs where id=$1",
            [id],
          )
        ).rows[0].backoff,
        true,
      );
      await pool.query(
        "update public.automation_jobs set available_at=now()-interval '1 second' where id=$1",
        [id],
      );
      const retried = (
        await pool.query("select app_private.claim_jobs_core(1) jobs")
      ).rows[0].jobs[0];
      assert.notEqual(retried.lease_token, job.lease_token);
      await assert.rejects(
        () =>
          pool.query("select app_private.process_job_core($1,$2)", [
            id,
            job.lease_token,
          ]),
        { code: "42501" },
      );
      await pool.query("select app_private.fail_job_core($1,$2)", [
        id,
        retried.lease_token,
      ]);
      assert.equal(
        (
          await pool.query(
            "select status from public.automation_jobs where id=$1",
            [id],
          )
        ).rows[0].status,
        "dead",
      );
    },
  );
  await check(
    "two settlements cannot reserve or pay the same commission twice",
    async () => {
      await command("configure", {
        entity: "commission_rules",
        staff_id: f.staff.a1,
        service_id: f.services.cut,
        rate_bps: 4000,
      });
      const sale = (
        await command("create_checkout", {
          lines: [
            { service_id: f.services.cut, staff_id: f.staff.a1, quantity: 1 },
          ],
        })
      ).id;
      const total = Number(
        (
          await pool.query(
            "select total_minor from public.checkouts where id=$1",
            [sale],
          )
        ).rows[0].total_minor,
      );
      await command("post_checkout", {
        id: sale,
        payments: [{ payment_method_id: method, amount_minor: total }],
      });
      const date = new Date().toISOString().slice(0, 10);
      const settlements = await Promise.all(
        Array.from({ length: 2 }, () =>
          command("create_staff_settlement", {
            staff_id: f.staff.a1,
            period_start: date,
            period_end: date,
          }),
        ),
      );
      const rows = (
        await pool.query(
          "select id,commission_accrued_minor from public.staff_settlements where id=any($1)",
          [settlements.map((s) => s.id)],
        )
      ).rows;
      const commission = Number(
        (
          await pool.query(
            "select sum(amount_minor*direction) n from public.commission_entries where checkout_id=$1",
            [sale],
          )
        ).rows[0].n,
      );
      assert.equal(
        rows.reduce((sum, r) => sum + Number(r.commission_accrued_minor), 0),
        commission,
      );
      const payable = rows.find((r) => Number(r.commission_accrued_minor) > 0)!;
      await command("review_staff_settlement", { id: payable.id });
      const payoutCategory = (
        await command("configure", {
          entity: "expense_categories",
          name: "Commission payouts",
          code: "audit_payout",
          kind: "commission_payment",
        })
      ).id;
      const attempts = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          command("pay_staff_settlement", {
            id: payable.id,
            category_id: payoutCategory,
            payment_method_id: method,
          }),
        ),
      );
      assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from public.expenses where category_kind_snapshot='commission_payment'",
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await check(
    "native scheduler lock skips concurrent invocations and missing provider remains pending configuration",
    async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          "select pg_advisory_xact_lock(hashtextextended('barberia:scheduled-worker',0))",
        );
        const second = (
          await pool.query("select app_private.run_scheduled_jobs() result")
        ).rows[0].result;
        assert.equal(second.skipped, true);
        await client.query("commit");
      } finally {
        await client.query("rollback");
        client.release();
      }
      const id = (
        await pool.query(
          "insert into public.automation_jobs(organization_id,branch_id,job_type) values($1,$2,'webhook_delivery') returning id",
          [f.orgA, f.branches.a1],
        )
      ).rows[0].id;
      const claimed = (
        await pool.query("select app_private.claim_jobs_core(20) jobs")
      ).rows[0].jobs as { id: string; lease_token: string }[];
      const job = claimed.find((j) => j.id === id)!;
      assert.ok(job);
      await pool.query("select app_private.process_job_core($1,$2)", [
        id,
        job.lease_token,
      ]);
      assert.equal(
        (
          await pool.query(
            "select status from public.automation_jobs where id=$1",
            [id],
          )
        ).rows[0].status,
        "awaiting_configuration",
      );
    },
  );
  await check(
    "a financial command queued behind membership revocation fails after the lock",
    async () => {
      const blocker = await pool.connect();
      let pending: Promise<{ accepted: boolean; code?: string }> | undefined;
      try {
        await blocker.query("begin");
        await blocker.query("select app_private.lock_organization($1)", [
          f.orgA,
        ]);
        await blocker.query(
          "update public.organization_memberships set active=false where organization_id=$1 and profile_id=$2",
          [f.orgA, finance],
        );
        pending = command("create_expense", expenseData, finance).then(
          () => ({ accepted: true }),
          (e) => ({ accepted: false, code: e.code }),
        );
        let waiting = false;
        for (let n = 0; n < 100 && !waiting; n++) {
          waiting = (
            await pool.query(
              "select exists(select 1 from pg_stat_activity where wait_event='advisory' and query like 'select public.finance_command%') waiting",
            )
          ).rows[0].waiting;
          if (!waiting) await new Promise((resolve) => setTimeout(resolve, 25));
        }
        assert.equal(
          waiting,
          true,
          "command must be proven blocked behind the revocation transaction",
        );
        await blocker.query("commit");
        assert.deepEqual(await pending, { accepted: false, code: "42501" });
      } finally {
        await blocker.query("rollback");
        blocker.release();
        if (pending) await pending;
        await pool.query(
          "update public.organization_memberships set active=true where organization_id=$1 and profile_id=$2",
          [f.orgA, finance],
        );
      }
    },
  );
  await check(
    "outbox and notifications reject cross-tenant event references even with privileged SQL",
    async () => {
      const event = (
        await pool.query(
          "insert into public.domain_events(organization_id,branch_id,event_type,entity_id,payload,request_id) values($1,$2,'audit.fixture',$3,'{}',$4) returning id",
          [f.orgB, f.branches.b1, f.customers.b1, randomUUID()],
        )
      ).rows[0].id;
      await assert.rejects(
        () =>
          pool.query(
            "insert into public.automation_jobs(organization_id,branch_id,event_id,job_type) values($1,$2,$3,'metrics_rebuild')",
            [f.orgA, f.branches.a1, event],
          ),
        { code: "23503" },
      );
      await assert.rejects(
        () =>
          pool.query(
            "insert into public.notifications(organization_id,branch_id,profile_id,event_id,title,body) values($1,$2,$3,$4,'audit','audit')",
            [f.orgA, f.branches.a1, f.users.ownerA, event],
          ),
        { code: "23503" },
      );
    },
  );
  return { passed };
}

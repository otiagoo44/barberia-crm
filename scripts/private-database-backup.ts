import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import assert from "node:assert/strict";
import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";

const schemas = [
  "public",
  "app_private",
  "auth",
  "extensions",
  "supabase_migrations",
];
const project = "tbcfhagteyqufjkmbxzz";
let backupPhase = "initializing";
const identifier = (s: string) => '"' + s.replaceAll('"', '""') + '"';
const digest = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export function encryptBackup(bytes: Buffer, passphrase: string) {
  assert.ok(
    passphrase.length >= 20,
    "Backup passphrase must contain at least 20 characters",
  );
  const salt = randomBytes(32),
    iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from("BarberiaOS-private-backup-v1"));
    const data = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.from(
      JSON.stringify({
        version: 1,
        cipher: "aes-256-gcm",
        kdf: "scrypt-N32768-r8-p1",
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: data.toString("base64"),
      }),
    );
  } finally {
    key.fill(0);
  }
}

export function decryptBackup(bytes: Buffer, passphrase: string) {
  const e = JSON.parse(bytes.toString("utf8"));
  assert.equal(e.version, 1);
  assert.equal(e.cipher, "aes-256-gcm");
  assert.equal(e.kdf, "scrypt-N32768-r8-p1");
  const key = scryptSync(passphrase, Buffer.from(e.salt, "base64"), 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(e.iv, "base64"),
    );
    decipher.setAAD(Buffer.from("BarberiaOS-private-backup-v1"));
    decipher.setAuthTag(Buffer.from(e.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(e.data, "base64")),
      decipher.final(),
    ]);
  } finally {
    key.fill(0);
  }
}

async function tool(
  bin: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  input?: Buffer,
) {
  const childEnvironment = { ...env };
  for (const name of Object.keys(childEnvironment))
    if (name.startsWith("TASK_BACKUP_")) delete childEnvironment[name];
  childEnvironment.PGCONNECT_TIMEOUT = "15";
  childEnvironment.PGOPTIONS =
    "-c timezone=UTC -c extra_float_digits=3 -c bytea_output=hex -c intervalstyle=postgres";
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(bin, args, {
      env: childEnvironment,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const output: Buffer[] = [];
    let size = 0;
    child.stdout.on("data", (b: Buffer) => {
      size += b.length;
      if (size > 512 * 1024 * 1024) child.kill();
      else output.push(b);
    });
    // Diagnostics are restricted to the synthetic fixture runner and localhost.
    // The production entry point never enables this flag.
    const diagnostics =
      env.TASK_BACKUP_FIXTURE_DIAGNOSTICS === "1" && env.PGHOST === "127.0.0.1";
    let stderr = "";
    child.stderr.on("data", (bytes: Buffer) => {
      if (stderr.length < 32768) stderr += bytes.toString("utf8");
    });
    child.stdin.on("error", () => {});
    child.on("error", () =>
      reject(new Error("PostgreSQL tool could not start")),
    );
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(output));
      else {
        if (diagnostics) console.error(stderr);
        const safeCode = /password authentication failed/i.test(stderr)
          ? "DB_AUTH_FAILED"
          : /permission denied/i.test(stderr)
            ? "DB_PERMISSION_DENIED"
            : /certificate|SSL error/i.test(stderr)
              ? "DB_TLS_FAILED"
              : /server version mismatch|aborting because of server version/i.test(
                    stderr,
                  )
                ? "DB_VERSION_MISMATCH"
                : "POSTGRES_TOOL_FAILED";
        reject(
          Object.assign(
            new Error(`PostgreSQL tool exited ${code}; output suppressed`),
            { code: safeCode },
          ),
        );
      }
    });
    child.stdin.end(input);
  });
}

async function inventory(client: Client) {
  await client.query("set time zone 'UTC'");
  const relations = (
    await client.query(
      "select n.nspname schema,c.relname name,c.relrowsecurity rls,c.relforcerowsecurity force_rls,pg_get_userbyid(c.relowner) owner,array(select a::text from unnest(coalesce(c.relacl,acldefault('r',c.relowner))) a order by a::text) acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1) and c.relkind in ('r','p') order by 1,2",
      [schemas],
    )
  ).rows;
  const tables = [];
  for (const r of relations) {
    const check = (
      await client.query(
        `select count(*)::text rows,md5(coalesce(string_agg(to_jsonb(t)::text,chr(10) order by to_jsonb(t)::text collate "C"),'')) content_hash from ${identifier(r.schema)}.${identifier(r.name)} t`,
      )
    ).rows[0];
    tables.push({ ...r, ...check });
  }
  const policies = (
    await client.query(
      "select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname=any($1) order by 1,2,3",
      [schemas],
    )
  ).rows;
  const constraints = (
    await client.query(
      "select n.nspname schema,c.relname table_name,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1) order by 1,2,3",
      [schemas],
    )
  ).rows;
  const routines = (
    await client.query(
      "select n.nspname schema,p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosecdef,p.proconfig,md5(p.prosrc) body_hash,array(select a::text from unnest(coalesce(p.proacl,acldefault('f',p.proowner))) a order by a::text) acl,pg_get_userbyid(p.proowner) owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=any($1) and p.prokind='f' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by 1,2,3",
      [schemas],
    )
  ).rows;
  const schemaPermissions = (
    await client.query(
      "select n.nspname,pg_get_userbyid(n.nspowner) owner,array(select a::text from unnest(coalesce(n.nspacl,acldefault('n',n.nspowner))) a order by a::text) acl from pg_namespace n where n.nspname=any($1) order by 1",
      [schemas],
    )
  ).rows;
  const schemaGrants = (
    await client.query(
      "select n.nspname schema,case a.grantee when 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end grantee,a.privilege_type privilege,a.is_grantable grantable from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname=any($1) order by 1,2,3,4",
      [schemas],
    )
  ).rows;
  return {
    tables,
    policies,
    constraints,
    routines,
    schemaPermissions,
    schemaGrants,
  };
}

// COPY text escapes literal tabs/newlines in values. Compare row multisets from
// the original pg_dump archive and a fresh dump of the recovered database, using
// JS byte-independent ordering rather than Linux/Windows database collation.
// Plain data remains in memory and is never written to logs or a plaintext file.
export function fingerprintDumpData(sql: string) {
  const tables: {
    table: string;
    header: string;
    rows: number;
    hash: string;
  }[] = [];
  const sequences: string[] = [];
  let active: { header: string; rows: string[] } | undefined;
  for (const line of sql.replaceAll("\r\n", "\n").split("\n")) {
    if (active) {
      if (line === "\\.") {
        const table = active.header.slice(5, active.header.indexOf(" ("));
        assert.ok(
          !tables.some((t) => t.table === table),
          "Duplicate COPY table in archive",
        );
        tables.push({
          table,
          header: active.header,
          rows: active.rows.length,
          hash: digest(Buffer.from(active.rows.sort().join("\n"))),
        });
        active = undefined;
      } else active.rows.push(line);
      continue;
    }
    if (/^COPY .+ \(.+\) FROM stdin;$/.test(line)) {
      active = { header: line, rows: [] };
      continue;
    }
    if (/^SELECT pg_catalog\.setval\(.+\);$/.test(line)) {
      sequences.push(line);
      continue;
    }
    if (
      !line.trim() ||
      line.startsWith("--") ||
      /^SET .+;$/.test(line) ||
      /^SELECT pg_catalog\.set_config\('search_path', '', false\);$/.test(
        line,
      ) ||
      /^\\(?:un)?restrict [A-Za-z0-9]+$/.test(line)
    )
      continue;
    throw Object.assign(
      new Error("Unsupported data statement; verification refuses to omit it"),
      { code: "UNSUPPORTED_DUMP_DATA_STATEMENT" },
    );
  }
  assert.equal(active, undefined, "Unterminated COPY block");
  return {
    tables: tables.sort((a, b) =>
      a.table < b.table ? -1 : a.table > b.table ? 1 : 0,
    ),
    sequences: sequences.sort(),
  };
}

function canonicalMetadata(
  state: Record<string, Record<string, unknown>[]>,
  includeContentHash: boolean,
) {
  return Object.fromEntries(
    Object.entries(state).map(([section, rows]) => [
      section,
      rows
        .map((row) => {
          const normalized = { ...row };
          if (section === "tables" && !includeContentHash)
            delete normalized.content_hash;
          for (const key of ["acl", "roles"])
            if (Array.isArray(normalized[key]))
              normalized[key] = [...(normalized[key] as unknown[])].sort();
          return normalized;
        })
        .sort((a, b) =>
          JSON.stringify(a) < JSON.stringify(b)
            ? -1
            : JSON.stringify(a) > JSON.stringify(b)
              ? 1
              : 0,
        ),
    ]),
  );
}

async function upgradeRestoredCopy(client: Client) {
  backupPhase = "isolated-upgrade";
  const exists = (
    await client.query(
      "select to_regclass('supabase_migrations.schema_migrations') is not null present",
    )
  ).rows[0].present;
  if (!exists)
    return {
      status: "NOT_TESTED",
      reason: "No source migration ledger in this fixture",
    };
  const directory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../supabase/migrations",
  );
  const files = (await readdir(directory))
    .filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f))
    .sort();
  const history = (
    await client.query(
      "select version,name from supabase_migrations.schema_migrations order by version",
    )
  ).rows;
  if (
    !history.length ||
    history.some((r, i) => files[i] !== `${r.version}_${r.name}.sql`)
  )
    throw Object.assign(
      new Error("Restored migration history differs from the release prefix"),
      { code: "MIGRATION_HISTORY_DIVERGENCE" },
    );
  const before = (await inventory(client)).tables.filter(
    (t) => t.schema !== "supabase_migrations",
  );
  const applied: string[] = [];
  for (const file of files.slice(history.length)) {
    const sql = await readFile(path.join(directory, file), "utf8");
    await client.query("begin");
    try {
      await client.query(
        "set local lock_timeout='5s';set local statement_timeout='60s'",
      );
      await client.query(sql);
      await client.query(
        "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)",
        [file.slice(0, 14), file.slice(15, -4), [sql]],
      );
      await client.query("commit");
      applied.push(file);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
  const after = await inventory(client);
  for (const table of before) {
    const row = after.tables.find(
      (t) => t.schema === table.schema && t.name === table.name,
    );
    assert.ok(row);
    assert.equal(row.rows, table.rows);
    assert.equal(
      row.content_hash,
      table.content_hash,
      "Upgrade must preserve every original business/Auth row",
    );
  }
  const security = (
    await client.query(
      "select (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) unprotected,(select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prosecdef) public_definers,to_regprocedure('public.save_weekly_schedule(uuid,uuid,uuid,date,integer[],jsonb,jsonb,uuid)') is not null weekly_rpc,to_regprocedure('public.setup_team(uuid,uuid)') is not null team_rpc",
    )
  ).rows[0];
  assert.equal(security.unprotected, 0);
  assert.equal(security.public_definers, 0);
  assert.equal(security.weekly_rpc, true);
  assert.equal(security.team_rpc, true);
  assert.equal(
    (
      await client.query(
        "select count(*)::int n from supabase_migrations.schema_migrations",
      )
    ).rows[0].n,
    files.length,
  );
  return {
    status: "PASSED",
    from: history.length,
    to: files.length,
    applied,
    original_tables_content_unchanged: before.length,
    security,
  };
}

export async function exportSnapshot(
  client: Client,
  pgBin: string,
  pgEnv: NodeJS.ProcessEnv,
) {
  backupPhase = "source-snapshot";
  await client.query("begin isolation level repeatable read read only");
  try {
    const snapshot = (
      await client.query(
        "select pg_export_snapshot() snapshot,clock_timestamp() at",
      )
    ).rows[0];
    backupPhase = "source-inventory";
    const state = await inventory(client);
    const roles = (
      await client.query(
        "select rolname from pg_roles where rolname !~ '^pg_' order by rolname",
      )
    ).rows;
    const extensions = (
      await client.query(
        "select e.extname,n.nspname schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where n.nspname=any($1) order by e.extname",
        [schemas],
      )
    ).rows;
    backupPhase = "source-pg-dump";
    const dump = await tool(
      path.join(pgBin, "pg_dump.exe"),
      [
        "--format=custom",
        "--no-publications",
        "--no-subscriptions",
        "--snapshot=" + snapshot.snapshot,
        ...schemas.map((s) => "--schema=" + s),
        ...extensions.map((e) => "--extension=" + e.extname),
      ],
      pgEnv,
    );
    await client.query("commit");
    return Buffer.from(
      JSON.stringify({
        version: 1,
        project,
        content_hash_order: "C",
        taken_at: snapshot.at,
        state,
        roles,
        extensions,
        dump: dump.toString("base64"),
        dump_sha256: digest(dump),
      }),
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function restoreIsolated(
  bundle: Buffer,
  pgBin: string,
  privateRoot: string,
) {
  backupPhase = "isolated-restore";
  const data = JSON.parse(bundle.toString("utf8"));
  assert.equal(data.project, project);
  const dump = Buffer.from(data.dump, "base64");
  assert.equal(digest(dump), data.dump_sha256);
  const socket = createServer();
  await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((r) => socket.close(() => r()));
  const root = await realpath(privateRoot);
  const directory = path.resolve(
    root,
    "restore-" + randomBytes(12).toString("hex"),
  );
  assert.ok(directory.startsWith(root + path.sep));
  const password = randomBytes(32).toString("hex");
  const pg = new EmbeddedPostgres({
    databaseDir: directory,
    user: "postgres",
    password,
    port,
    persistent: true,
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  let started = false;
  let client: Client | undefined;
  const start = performance.now();
  try {
    await pg.initialise();
    await pg.start();
    started = true;
    client = new Client({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "postgres",
    });
    await client.connect();
    // This is the newly initialized loopback-only cluster, never a supplied URL.
    // Its empty public schema must be recreated by pg_restore with original ACL.
    await client.query("drop schema public");
    for (const role of data.roles)
      if (role.rolname !== "postgres")
        await client.query(`create role ${identifier(role.rolname)} nologin`);
    await tool(
      path.join(pgBin, "pg_restore.exe"),
      ["--exit-on-error", "--single-transaction", "--dbname=postgres"],
      {
        ...process.env,
        PGHOST: "127.0.0.1",
        PGPORT: String(port),
        PGUSER: "postgres",
        PGPASSWORD: password,
        PGDATABASE: "postgres",
        PGSSLMODE: "disable",
      },
      dump,
    );
    // pg_dump omits the default PUBLIC USAGE grant of the built-in public schema.
    // It was recreated above, so replay the captured schema grants on this fresh
    // isolated copy, then verify every ACL instead of omitting permission checks.
    for (const schema of data.state.schemaPermissions) {
      const grantees = (
        await client.query(
          "select distinct case a.grantee when 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end grantee from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname=$1",
          [schema.nspname],
        )
      ).rows;
      for (const { grantee } of grantees)
        await client.query(
          `revoke all on schema ${identifier(schema.nspname)} from ${grantee === "PUBLIC" ? "PUBLIC" : identifier(grantee)}`,
        );
      for (const grant of data.state.schemaGrants.filter(
        (g: { schema: string }) => g.schema === schema.nspname,
      )) {
        assert.ok(["USAGE", "CREATE"].includes(grant.privilege));
        await client.query(
          `grant ${grant.privilege} on schema ${identifier(schema.nspname)} to ${grant.grantee === "PUBLIC" ? "PUBLIC" : identifier(grant.grantee)}${grant.grantable ? " with grant option" : ""}`,
        );
      }
    }
    backupPhase = "isolated-validation";
    const recovered = await inventory(client);
    backupPhase = "isolated-row-content";
    const originalCopy = fingerprintDumpData(
      (
        await tool(
          path.join(pgBin, "pg_restore.exe"),
          ["--data-only", "--file=-"],
          process.env,
          dump,
        )
      ).toString("utf8"),
    );
    const recoveredCopy = fingerprintDumpData(
      (
        await tool(
          path.join(pgBin, "pg_dump.exe"),
          [
            "--data-only",
            "--no-publications",
            "--no-subscriptions",
            ...schemas.map((s) => "--schema=" + s),
            ...data.extensions.map(
              (e: { extname: string }) => "--extension=" + e.extname,
            ),
          ],
          {
            ...process.env,
            PGHOST: "127.0.0.1",
            PGPORT: String(port),
            PGUSER: "postgres",
            PGPASSWORD: password,
            PGDATABASE: "postgres",
            PGSSLMODE: "disable",
          },
        )
      ).toString("utf8"),
    );
    if (!isDeepStrictEqual(originalCopy, recoveredCopy))
      throw Object.assign(
        new Error(
          "Recovered COPY rows or sequence values differ from the encrypted archive",
        ),
        { code: "RESTORED_ROW_DATA_MISMATCH" },
      );
    backupPhase = "isolated-validation";
    const originalMetadata = canonicalMetadata(
      data.state,
      data.content_hash_order === "C",
    );
    const recoveredMetadata = canonicalMetadata(
      recovered,
      data.content_hash_order === "C",
    );
    const differences = [];
    for (const section of Object.keys(originalMetadata)) {
      if (
        isDeepStrictEqual(recoveredMetadata[section], originalMetadata[section])
      )
        continue;
      const rows = recoveredMetadata[section] as Record<string, unknown>[];
      const originals = originalMetadata[section] as Record<string, unknown>[];
      const key = (row: Record<string, unknown>) =>
        section === "tables"
          ? `${row.schema}.${row.name}`
          : section === "routines"
            ? `${row.schema}.${row.proname}(${row.args})`
            : section === "constraints"
              ? `${row.schema}.${row.table_name}.${row.conname}`
              : section === "policies"
                ? `${row.schemaname}.${row.tablename}.${row.policyname}`
                : section === "schemaPermissions"
                  ? String(row.nspname)
                  : `${row.schema}.${row.grantee}.${row.privilege}.${row.grantable}`;
      const changed = [];
      for (const original of originals) {
        const found = rows.find((row) => key(row) === key(original));
        if (!isDeepStrictEqual(found, original))
          changed.push({
            object: key(original),
            fields: found
              ? Object.keys(original).filter(
                  (field) => !isDeepStrictEqual(found[field], original[field]),
                )
              : ["missing"],
          });
      }
      for (const row of rows)
        if (!originals.some((original) => key(row) === key(original)))
          changed.push({ object: key(row), fields: ["unexpected"] });
      differences.push({
        section,
        source_count: originals.length,
        recovered_count: rows.length,
        changed: changed.slice(0, 30),
      });
    }
    if (differences.length) {
      await writeFile(
        path.join(root, "last-restore-diagnostic.json"),
        JSON.stringify(
          {
            checked_at: new Date().toISOString(),
            project,
            phase: backupPhase,
            differences,
            note: "Object names and differing metadata fields only; no rows, hashes, SQL bodies or credentials",
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
      throw Object.assign(
        new Error("Restored state mismatch; safe diagnostic saved privately"),
        { code: "RESTORE_STATE_MISMATCH" },
      );
    }
    for (const role of ["anon", "authenticated"]) {
      await client.query("begin");
      try {
        await client.query(`set local role ${identifier(role)}`);
        assert.equal(
          (await client.query("select count(*)::int n from public.customers"))
            .rows[0].n,
          0,
          "An unauthenticated or unscoped session must not read customers",
        );
      } catch (error) {
        if ((error as { code?: string }).code !== "42501") throw error;
      } finally {
        await client.query("rollback");
      }
    }
    const isolated_upgrade = await upgradeRestoredCopy(client);
    return {
      status: "PASSED",
      restore_ms: Math.round(performance.now() - start),
      tables_verified: recovered.tables.length,
      auth_tables_verified: recovered.tables.filter((t) => t.schema === "auth")
        .length,
      policies_verified: recovered.policies.length,
      anonymous_and_unscoped_authenticated_denied: true,
      row_content_verified_against_archive: true,
      sequence_values_verified: originalCopy.sequences.length,
      portable_source_checksums: data.content_hash_order === "C",
      isolated_upgrade,
      auth_api_login: "NOT_TESTED",
      managed_physical_restore: "NOT_TESTED",
      destination: "localhost only; no outgoing integrations executed",
    };
  } finally {
    await client?.end();
    if (started) await pg.stop();
    if (
      directory.startsWith(root + path.sep) &&
      path.basename(directory).startsWith("restore-")
    )
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 250,
      });
  }
}

async function main() {
  delete process.env.TASK_BACKUP_FIXTURE_DIAGNOSTICS;
  const root = path.resolve(process.env.TASK_BACKUP_ROOT ?? "");
  const expectedRoot = path.resolve(
    process.env.LOCALAPPDATA!,
    "BarberiaOS/private-backups",
    project,
  );
  assert.equal(
    root,
    expectedRoot,
    "Backups must stay in the private directory outside the repository",
  );
  await mkdir(root, { recursive: true });
  const pgBin = process.env.TASK_BACKUP_PG_BIN!;
  assert.ok((await readdir(pgBin)).includes("pg_dump.exe"));
  const passphrase = process.env.TASK_BACKUP_PASSPHRASE!;
  if (!passphrase || passphrase.length < 20)
    throw Object.assign(new Error("Backup passphrase too short"), {
      code: "BACKUP_PASSPHRASE_TOO_SHORT",
    });
  let file = process.env.TASK_BACKUP_FILE;
  let bundle: Buffer;
  if (process.env.TASK_BACKUP_ACTION === "Verify") {
    assert.ok(file);
    file = path.resolve(file);
    assert.ok(file.startsWith(root + path.sep));
    bundle = decryptBackup(await readFile(file), passphrase);
  } else {
    assert.equal(process.env.TASK_BACKUP_ACTION, "Backup");
    const caFile = path.resolve(
      process.env.LOCALAPPDATA!,
      "BarberiaOS/tools/supabase-ca-bundle.pem",
    );
    const password = process.env.TASK_BACKUP_DB_PASSWORD;
    assert.ok(password);
    const host = "aws-0-us-east-1.pooler.supabase.com",
      user = "postgres." + project;
    const client = new Client({
      host,
      port: 5432,
      user,
      password,
      database: "postgres",
      connectionTimeoutMillis: 15000,
      ssl: { rejectUnauthorized: true, ca: await readFile(caFile, "utf8") },
    });
    try {
      backupPhase = "source-connect";
      await client.connect();
      backupPhase = "source-identity";
      const target = await client.query(
        "select o.id from public.organizations o join public.branches b on b.organization_id=o.id where o.id='db03ca0c-48cc-46d2-bcbe-86c6ba8525d4' and o.slug='1717-barberia' and b.id='1c10857c-c9da-442a-a1cb-46edd114832d' and b.slug='luque'",
      );
      assert.equal(target.rowCount, 1, "Unexpected production identity");
      bundle = await exportSnapshot(client, pgBin, {
        ...process.env,
        PGHOST: host,
        PGPORT: "5432",
        PGUSER: user,
        PGPASSWORD: password,
        PGDATABASE: "postgres",
        PGSSLMODE: "verify-full",
        PGSSLROOTCERT: caFile,
      });
    } finally {
      await client.end();
    }
    file = path.join(
      root,
      "1717-" + new Date().toISOString().replaceAll(":", "-") + ".bkos",
    );
    backupPhase = "encrypt-backup";
    const encrypted = encryptBackup(bundle, passphrase);
    await writeFile(file, encrypted, { flag: "wx", mode: 0o600 });
    assert.deepEqual(decryptBackup(await readFile(file), passphrase), bundle);
    console.log(
      "Copia lógica cifrada creada fuera de Git. Iniciando restauración aislada.",
    );
  }
  const receiptFile = file + ".receipt.json";
  const receipt = {
    project,
    checked_at: new Date().toISOString(),
    encrypted_file: path.basename(file),
    encryption: "AES-256-GCM with scrypt; passphrase never stored",
    scope: schemas,
    source_snapshot: JSON.parse(bundle.toString("utf8")).taken_at,
    production_writes: 0,
    restore: { status: "NOT_TESTED" } as object,
  };
  await writeFile(receiptFile, JSON.stringify(receipt, null, 2), {
    mode: 0o600,
  });
  receipt.restore = await restoreIsolated(bundle, pgBin, root);
  await writeFile(receiptFile, JSON.stringify(receipt, null, 2), {
    mode: 0o600,
  });
  bundle.fill(0);
  console.log(JSON.stringify(receipt));
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    await main();
  } catch (error) {
    const code = (error as { code?: string }).code;
    console.error(
      JSON.stringify({
        status: "NOT_APPROVED",
        phase: backupPhase,
        code: code && /^[A-Z0-9_]+$/.test(code) ? code : "UNCLASSIFIED",
      }),
    );
    console.error(
      "Respaldo/restauración NO aprobados. Credenciales y errores SQL privados no se imprimen. No aplicar migraciones.",
    );
    process.exitCode = 1;
  }
}

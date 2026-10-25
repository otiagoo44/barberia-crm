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
import { pathToFileURL } from "node:url";
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
      if (diagnostics) stderr += bytes.toString("utf8");
    });
    child.stdin.on("error", () => {});
    child.on("error", () =>
      reject(new Error("PostgreSQL tool could not start")),
    );
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(output));
      else {
        if (diagnostics) console.error(stderr);
        reject(new Error(`PostgreSQL tool exited ${code}; output suppressed`));
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
        `select count(*)::text rows,md5(coalesce(string_agg(to_jsonb(t)::text,chr(10) order by to_jsonb(t)::text),'')) content_hash from ${identifier(r.schema)}.${identifier(r.name)} t`,
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

export async function exportSnapshot(
  client: Client,
  pgBin: string,
  pgEnv: NodeJS.ProcessEnv,
) {
  await client.query("begin isolation level repeatable read read only");
  try {
    const snapshot = (
      await client.query(
        "select pg_export_snapshot() snapshot,clock_timestamp() at",
      )
    ).rows[0];
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
    const recovered = await inventory(client);
    assert.deepEqual(
      recovered,
      data.state,
      "Restored counts, content, RLS, ACL, constraints and routine security must match the same source snapshot",
    );
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
    return {
      status: "PASSED",
      restore_ms: Math.round(performance.now() - start),
      tables_verified: recovered.tables.length,
      auth_tables_verified: recovered.tables.filter((t) => t.schema === "auth")
        .length,
      policies_verified: recovered.policies.length,
      anonymous_and_unscoped_authenticated_denied: true,
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
  assert.ok(passphrase?.length >= 20);
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
      await client.connect();
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
  } catch {
    console.error(
      "Respaldo/restauración NO aprobados. Credenciales y errores SQL privados no se imprimen. No aplicar migraciones.",
    );
    process.exitCode = 1;
  }
}

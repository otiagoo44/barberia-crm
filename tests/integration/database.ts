import EmbeddedPostgres from "embedded-postgres";
import { Pool, type PoolClient } from "pg";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { readFile, readdir, mkdir, rm } from "node:fs/promises";
import path from "node:path";

export async function isolatedDatabase(migrationLimit = Infinity) {
  if (process.env.TEST_DATABASE_URL)
    throw new Error(
      "Embedded test runner does not accept external database URLs. Use the dedicated staging runner.",
    );
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const root = path.resolve(".test-data");
  const databaseDir = path.resolve(
    root,
    `pg-${process.pid}-${randomBytes(4).toString("hex")}`,
  );
  if (!databaseDir.startsWith(root + path.sep))
    throw new Error("Unsafe test path");
  await mkdir(root, { recursive: true });
  const password = randomBytes(32).toString("hex");
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password,
    port,
    persistent: true,
    postgresFlags: [
      "-c",
      "listen_addresses=127.0.0.1",
      "-c",
      "max_connections=150",
    ],
    onLog: () => {},
    onError: (message) => {
      if (String(message).includes("FATAL"))
        console.error("PostgreSQL test process failed");
    },
  });
  await pg.initialise();
  await pg.start();
  const pool = new Pool({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password,
    database: "postgres",
    max: 110,
  });
  const connections = new Set<PoolClient>();
  pool.on("connect", (client) => connections.add(client));
  pool.on("remove", (client) => connections.delete(client));
  async function closePool() {
    // pg-pool resolves end() after scheduling client.end(), before every socket
    // has closed. Wait for client end events before stopping the local server.
    const closed = [...connections].map(
      (client) => new Promise<void>((resolve) => client.once("end", resolve)),
    );
    await pool.end();
    await Promise.all(closed);
  }
  await pool.query(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text unique,raw_user_meta_data jsonb not null default '{}');
    -- SQL authorization fixtures, deliberately separate from real Supabase Auth E2E.
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);
    create table auth.mfa_factors(id uuid primary key,user_id uuid not null references auth.users(id),status text not null);
    create function auth.fixture_session() returns trigger language plpgsql as $$ begin
      insert into auth.sessions(id,user_id) values(new.id,new.id); return new; end $$;
    create trigger fixture_session after insert on auth.users for each row execute function auth.fixture_session();
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,
        jsonb_build_object('sub',current_setting('request.jwt.claim.sub',true),'aal','aal2',
        'session_id',current_setting('request.jwt.claim.sub',true))) $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    grant execute on function auth.jwt() to anon,authenticated;
  `);
  const files = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let applied = 0;
  async function migrate(limit = Infinity) {
    for (const file of files.slice(applied, limit)) {
      const sql = await readFile(
        path.join("supabase/migrations", file),
        "utf8",
      );
      if (!sql.trim()) continue;
      await pool.query("begin");
      await pool.query(sql);
      await pool.query("commit");
      console.log(`Migration OK: ${file}`);
      applied++;
    }
  }
  try {
    await migrate(migrationLimit);
  } catch (error) {
    await pool.query("rollback");
    await closePool();
    await pg.stop();
    throw error;
  }
  return {
    pool,
    migrate,
    stop: async () => {
      await closePool();
      await pg.stop();
      if (!databaseDir.startsWith(root + path.sep))
        throw new Error("Unsafe cleanup");
      await rm(databaseDir, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 250,
      });
    },
  };
}

export async function asUser<T>(
  pool: Pool,
  user: string | null,
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${user ? "authenticated" : "anon"}`);
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user ?? "",
    ]);
    await client.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: user, aal: "aal2", session_id: user }),
    ]);
    const result = await client.query(query, params);
    await client.query("commit");
    return result.rows as T[];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// Operator-only provisioning. No secrets are printed. Run after migrations.
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((all, value, index, values) => {
  if (value.startsWith('--')) all.push([value.slice(2), values[index + 1]]);
  return all;
}, []));
const project = args['project-ref'], origin = args.origin, environment = args.environment;
const production = 'tbcfhagteyqufjkmbxzz';
if (!/^[a-z]{20}$/.test(project || '') || !['production','staging'].includes(environment) || (environment === 'production') !== (project === production)) throw new Error('Explicit production/staging project boundary required');
const url = new URL(origin);
if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password || !/^[a-zA-Z0-9.-]+$/.test(url.hostname)) throw new Error('Exact HTTPS origin required');
if (environment === 'production' && origin !== 'https://barberia-crm-kappa.vercel.app') throw new Error('Production CRM origin mismatch');
await mkdir('.test-data', { recursive: true });
const file = path.resolve(`.test-data/calendar-${project}.json`);
let credentials;
try { credentials = JSON.parse(await readFile(file,'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  credentials = { project, origin, encryptionKey: randomBytes(32).toString('hex'), workerSecret: randomBytes(32).toString('hex') };
  await writeFile(file,JSON.stringify(credentials,null,2)+'\n',{mode:0o600,flag:'wx'});
}
if (credentials.project !== project || credentials.origin !== origin || !/^[0-9a-f]{64}$/.test(credentials.encryptionKey) || !/^[0-9a-f]{64}$/.test(credentials.workerSecret)) throw new Error('Stored provisioning context mismatch');
if (!process.argv.includes('--apply')) {
  console.log(`Prepared private credentials for ${environment} ${project}; ${file}. Use --apply after reviewing the target.`);
  process.exit(0);
}
const sql = `begin;
do $configure$ declare existing text; secret_id uuid; begin
 select secret_hash into existing from app_private.gateway_credentials where name='calendar';
 if existing is not null and existing<>encode(extensions.digest('${credentials.workerSecret}','sha256'),'hex') then raise exception 'calendar_secret_rotation_requires_review'; end if;
 insert into app_private.gateway_credentials(name,secret_hash) values('calendar',encode(extensions.digest('${credentials.workerSecret}','sha256'),'hex')) on conflict(name) do update set active=true;
 select id into secret_id from vault.secrets where name='barberia-calendar-worker';
 if secret_id is null then select vault.create_secret('${credentials.workerSecret}','barberia-calendar-worker','Calendar dispatcher only') into secret_id; end if;
 if not exists(select 1 from vault.decrypted_secrets where id=secret_id and decrypted_secret='${credentials.workerSecret}') then raise exception 'calendar_vault_secret_mismatch'; end if;
 insert into app_private.calendar_dispatch_config(singleton,origin,vault_secret_id) values(true,'${origin}',secret_id)
 on conflict(singleton) do update set origin=excluded.origin,vault_secret_id=excluded.vault_secret_id;
end $configure$;
select jsonb_build_object('gateway_configured',exists(select 1 from app_private.gateway_credentials where name='calendar' and active),'transport_configured',exists(select 1 from app_private.calendar_dispatch_config),'scheduler_configured',exists(select 1 from cron.job where jobname='barberia-google-calendar' and active)) result;
commit;`;
const sqlFile=path.resolve(`.test-data/calendar-configure-${project}.sql`);
await writeFile(sqlFile,sql,{mode:0o600});
try {
  const output=execFileSync(process.execPath,[path.resolve('node_modules/supabase/dist/supabase.js'),'db','query','--linked','--project-ref',project,'--file',sqlFile,'--output','json'],{cwd:args['cli-workdir'] || process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const receipt={checkedAt:new Date().toISOString(),project,environment,origin,rows:JSON.parse(output).rows};
  await writeFile(`.test-data/calendar-provisioning-${project}.json`,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
} catch { throw new Error('Calendar provisioning failed. Credentials and SQL are retained privately for diagnosis; no secret output.'); }

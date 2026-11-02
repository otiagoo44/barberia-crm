import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { fixtures } from "./fixtures";
import { asUser } from "./database";
export async function publicConfirmationContracts(pool: Pool) {
 const f=await fixtures(pool);
 const date=new Date(Date.now()+2*86400000);date.setUTCHours(12,0,0,0);
 const args=[f.bookingSecret,"fixture-a","a1",["cut"],null,date.toISOString(),{name:"Public fixture",normalized_phone:"+12025550188"},randomUUID(),"","website"];
 const sql="select public.public_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result";
 const one=await asUser<{result:{reference:string;staff:{name:string;slug:string};services:{name:string}[]}}>(pool,null,sql,args);
 const two=await asUser(pool,null,sql,args);
 assert.deepEqual(one,two);
 const actual=(await pool.query("select s.name,s.slug from public.appointments a join public.staff s on s.organization_id=a.organization_id and s.id=a.staff_id where a.organization_id=$1 and a.public_reference=$2",[f.orgA,one[0].result.reference])).rows[0];
 assert.deepEqual(one[0].result.staff,actual);
 assert.deepEqual(one[0].result.services,[{name:"cut"}]);
 assert.ok(!("id" in one[0].result));assert.ok(!("staff_id" in one[0].result));assert.ok(!JSON.stringify(one[0].result).includes("+12025550188"));
 assert.equal((await pool.query("select count(*)::int total from public.appointments where public_reference=$1",[one[0].result.reference])).rows[0].total,1);
 await assert.rejects(asUser(pool,null,sql,["wrong",...args.slice(1)]),{code:"42501"});
 console.log("PASS public confirmation: authoritative assigned professional, service snapshots, private IDs/contact excluded, idempotent replay and gateway retained");
}

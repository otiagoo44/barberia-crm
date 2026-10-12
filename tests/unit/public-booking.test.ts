import test from "node:test";
import assert from "node:assert/strict";
import { parsePublicBookingQuery, preselectedServices, type PublicPickableService } from "../../src/lib/public-booking";
const all: PublicPickableService[] = [
  {id:"cut",name:"Corte",composition_mode:"standalone",base_service_id:null,consultation_required:false},
  {id:"curl",name:"Rulos",composition_mode:"standalone",base_service_id:null,consultation_required:true,website_category:"rulos"},
  {id:"design",name:"Diseño",composition_mode:"included",base_service_id:"cut",consultation_required:false},
  {id:"wash",name:"Lavado",composition_mode:"additive",base_service_id:null,consultation_required:false},
];
test("Public preselection accepts canonical slug only from branch catalog",()=>{
  assert.deepEqual(preselectedServices(all,"cut"),["cut"]);
  assert.deepEqual(preselectedServices(all,"design"),["cut","design"]);
  for(const value of [undefined,"missing","Corte","curl","wash"])assert.deepEqual(preselectedServices(all,value),[]);
  assert.deepEqual(preselectedServices(all.filter(s=>s.id!=="cut"),"design"),[]);
  assert.deepEqual(preselectedServices(all.map(s=>({...s,consultation_required:true})),"design"),[]);
});
test("Query parsing ignores repeated/invalid slugs and forged attribution",()=>{
  assert.deepEqual(parsePublicBookingQuery({service:"cut",source:"website"}),{service:"cut",source:"website"});
  for(const service of ["../cut","",["cut","curl"]])assert.equal(parsePublicBookingQuery({service}).service,undefined);
  for(const source of ["internal","public","arbitrary",["website","website"]])assert.equal(parsePublicBookingQuery({source}).source,undefined);
  assert.deepEqual(preselectedServices(all),[]);
});

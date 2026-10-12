import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire((process.env.QA_TOOLS_DIR || 'C:/Users/User/AppData/Local/Temp/1717-final-qa')+'/qa.cjs');
const browser=await require('puppeteer-core').launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const catalog={slug:'fixture-a',name:'Isolated booking fixture',currency:'PYG',brand_color:'#6fe2ff',logo_url:null,website_booking_version:1,branches:[{slug:'a1',name:'Fixture branch',timezone:'America/Asuncion',address:'Fixture address',staff:[{slug:'a1',name:'Fixture staff',services:['cut','curl','design']}],services:[{slug:'cut',name:'Corte fixture',composition_mode:'standalone',base_service_slug:null,price_minor:30000,consultation_required:false,website_category:'corte'},{slug:'curl',name:'Rulos fixture',composition_mode:'standalone',base_service_slug:null,price_minor:180000,consultation_required:true,website_category:'rulos'},{slug:'design',name:'Diseño fixture',composition_mode:'included',base_service_slug:'cut',price_minor:0,consultation_required:false,website_category:null}]}]};
const out=process.env.QA_OUT||'test-results/website-booking';await mkdir(out,{recursive:true});
const report={mode:'Actual production Next build with intercepted public API fixtures; database rules verified separately in isolated PostgreSQL. No production bookings.',cases:[],errors:[],requests:[]};
try{
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push({message:m.text(),location:m.location()});});
 await page.setRequestInterception(true);
 page.on('request',async req=>{
  const url=new URL(req.url());
  if(!url.pathname.startsWith('/api/public/'))return req.continue();
  report.requests.push({path:url.pathname,services:url.searchParams.getAll('service')});
  if(url.pathname.endsWith('/catalog'))return req.respond({status:200,contentType:'application/json',body:JSON.stringify(catalog)});
  if(url.pathname.endsWith('/availability'))return req.respond({status:200,contentType:'application/json',body:JSON.stringify([{starts_at:url.searchParams.get('date')+'T17:00:00-03:00',staff_slug:'a1',staff_name:'Fixture staff',duration_minutes:40}])});
  if(url.pathname.endsWith('/booking')){
   const body=JSON.parse(req.postData());assert.deepEqual(body.services,['cut']);assert.equal(body.source,'website');assert.equal(body.organization,'fixture-a');assert.equal(body.branch,'a1');assert.equal('price_minor' in body,false);assert.equal('duration_minutes' in body,false);
   report.bookingBodyKeys=Object.keys(body);return req.respond({status:201,contentType:'application/json',body:JSON.stringify({reference:'fixture-reference',starts_at:body.starts_at,ends_at:body.starts_at,duration_minutes:40})});
  }
 });
 for(const width of [390,1440]){
  await page.setViewport({width,height:900,isMobile:width<500,hasTouch:width<500});
  for(const [query,expected] of [['source=website',[]],['service=cut&source=website',['cut']],['service=design&source=website',['cut','design']],['service=missing&source=website',[]],['service=curl&source=website',[]],['service=cut&service=curl&source=internal',[]]]){
   await page.goto('http://127.0.0.1:3017/book/fixture-a/a1?'+query,{waitUntil:'networkidle0'});await page.waitForSelector('.service-options');
   const chosen=await page.$$eval('.service-option',els=>els.filter(e=>e.querySelector('input').checked).map(e=>e.innerText.trim()));
   assert.deepEqual(chosen,expected.map(s=>s==='cut'?'Corte fixture':'Diseño fixture\nIncluido'));
   assert.ok(!(await page.$eval('main',e=>e.innerText)).includes('Rulos fixture'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   report.cases.push({width,query,selected:expected});
  }
 }
 await page.goto('http://127.0.0.1:3017/book/fixture-a/a1?service=cut&source=website',{waitUntil:'networkidle0'});
 await page.click('.slot-grid button');await page.type('input[name=name]','Fixture client');await page.type('input[name=phone]','+12025550199');await page.click('button.primary');await page.waitForSelector('.public-confirmation');
 assert.deepEqual(report.errors,[]);report.passed=true;console.log('CRM browser: 12 query/viewport combinations and fixture booking payload PASS');
}catch(e){report.passed=false;report.failure=e.stack;throw e;}finally{await writeFile(out+'/crm-browser-fixtures.json',JSON.stringify(report,null,2));await browser.close();}

import test from "node:test";
import assert from "node:assert/strict";
import { publicBookingCors, publicBookingOrigins } from "../../src/lib/public-booking-origin";
const env = { APP_URL: "https://crm.fixture.invalid", PUBLIC_BOOKING_ORIGINS: "https://landing.fixture.invalid" };
test("Public CORS permits exact origins without credentials and rejects lookalikes", () => {
 for (const origin of [env.APP_URL, env.PUBLIC_BOOKING_ORIGINS]) assert.equal(publicBookingCors(new Request(env.APP_URL,{headers:{Origin:origin}}),env)?.["Access-Control-Allow-Origin"], origin);
 for (const origin of ["null","https://landing.fixture.invalid.evil.test","http://landing.fixture.invalid","https://elsewhere.test"]) assert.equal(publicBookingCors(new Request(env.APP_URL,{headers:{Origin:origin}}),env), null);
 assert.deepEqual(publicBookingCors(new Request(env.APP_URL),env),{Vary:"Origin"});
 for(const value of ["*","https://user:pass@fixture.invalid","https://fixture.invalid/path","https://fixture.invalid/"]) assert.throws(()=>publicBookingOrigins({...env,PUBLIC_BOOKING_ORIGINS:value}));
});

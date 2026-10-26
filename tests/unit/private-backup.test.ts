import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintDumpData } from "../../scripts/private-database-backup";

test("backup verifies COPY content independently of row and table order", () => {
  const one =
    "COPY public.a (id, value) FROM stdin;\n1\tline\\nvalue\n2\tother\\tvalue\n\\.\nCOPY auth.users (id) FROM stdin;\n3\n\\.\nSELECT pg_catalog.setval('public.a_id_seq', 3, true);\n";
  const reordered =
    "-- fixture only\nSET row_security = off;\nCOPY auth.users (id) FROM stdin;\n3\n\\.\nCOPY public.a (id, value) FROM stdin;\n2\tother\\tvalue\n1\tline\\nvalue\n\\.\nSELECT pg_catalog.setval('public.a_id_seq', 3, true);\n";
  assert.deepEqual(fingerprintDumpData(one), fingerprintDumpData(reordered));
  assert.notDeepEqual(
    fingerprintDumpData(one),
    fingerprintDumpData(one.replace("other\\tvalue", "changed")),
  );
  assert.notDeepEqual(
    fingerprintDumpData(one),
    fingerprintDumpData(one.replace("3, true", "4, true")),
  );
});

test("backup refuses unhandled data statements and incomplete COPY blocks", () => {
  assert.throws(() => fingerprintDumpData("SELECT unexpected_side_effect();"), {
    code: "UNSUPPORTED_DUMP_DATA_STATEMENT",
  });
  assert.throws(() =>
    fingerprintDumpData("COPY public.a (id) FROM stdin;\n1\n"),
  );
});

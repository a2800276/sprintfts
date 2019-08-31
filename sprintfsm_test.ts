import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { test, runTests } from "https://deno.land/std/testing/mod.ts";

import { FormatString } from "./sprintf_ng.ts";

test(function testStatemachine() {
  let fs = new FormatString();
  fs.compile("The quick brown fox jumped over the lazy dog.");
  assertEquals(fs.run(), "The quick brown fox jumped over the lazy dog.");
  fs.compile("The quick %% fox jumped over the lazy accountant.");
  assertEquals(fs.run(), "The quick % fox jumped over the lazy accountant.");
});

runTests();

#!/usr/bin/env node
// Process-inventory double used only on the integration test's private PATH.
import { readFile } from "node:fs/promises";
const state = JSON.parse(
  await readFile(process.env.SITE_FIXTURE_STATE, "utf8"),
);
if (state.scenario !== "no-browser")
  console.log("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");

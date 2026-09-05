// Executable protocol fixture. Only the integration test config points here.
import { readFile, writeFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { fixturePage } from "./fixture-page.mjs";
const path = process.env.SITE_FIXTURE_STATE;
if (!path) throw new Error("Missing fixture state");
const state = JSON.parse(await readFile(path, "utf8"));
const args = process.argv.slice(2);
state.calls.push(
  args.map((a) => (a.startsWith("--filename=") ? "--filename=<private>" : a)),
);
const config = JSON.parse(
  await readFile(new URL("../runtime/manifest.json", import.meta.url), "utf8"),
).config;
try {
  if (args[0] === "--version")
    console.log(
      state.scenario === "wrong-version" ? "0.0.0" : config.browser.cliVersion,
    );
  else if (args[0] === "list")
    console.log(
      JSON.stringify({
        browsers: state.attached
          ? [
              {
                name: config.browser.session,
                status: "open",
                attached: state.scenario !== "managed",
                compatible: true,
                browserType: "chrome",
              },
            ]
          : [],
      }),
    );
  else if (args[0] === "attach") {
    if (state.scenario === "no-browser")
      throw new Error("Browser is not running");
    if (state.scenario === "attach-failed")
      throw new Error("Extension connection refused");
    if (
      !args.includes("--extension=chrome") &&
      !args.includes("--cdp=http://127.0.0.1:9222")
    )
      throw new Error("Wrong attach mode");
    if (!args.includes("--session=" + config.browser.session))
      throw new Error("Wrong session");
    state.attached = true;
    console.log("attached");
  } else if (args.includes("run-code")) {
    if (
      !state.attached ||
      !args.includes("-s=" + config.browser.session) ||
      !args.includes("--raw")
    )
      throw new Error("Wrong invocation");
    const file = args.find((a) => a.startsWith("--filename="))?.slice(11);
    const code = await readFile(file, "utf8");
    const invoke = runInNewContext("(" + code + ")", {}, { timeout: 1000 });
    const result = await invoke(fixturePage(state));
    if (state.scenario === "malformed-response") console.log("not-json");
    else console.log(JSON.stringify(result)); // Mirrors real CLI 0.1.19 --raw returned-string encoding.
  } else throw new Error("Forbidden command: " + args.join(" "));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await writeFile(path, JSON.stringify(state));
}

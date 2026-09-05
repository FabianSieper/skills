#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
async function main() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 16))
    throw new Error("Node >=22.16 is required.");
  let version, list;
  try {
    version = (
      await run("playwright-cli", ["--version"], { timeout: 10_000 })
    ).stdout.trim();
    list = JSON.parse(
      (
        await run("playwright-cli", ["list", "--json", "--all"], {
          timeout: 10_000,
        })
      ).stdout,
    );
  } catch {
    throw new Error("playwright-cli is missing or incompatible.");
  }
  const chrome = list.channelSessions?.find(
    (value) => value.channel === "chrome",
  );
  return {
    ok: true,
    node: process.versions.node,
    playwrightCli: version,
    chromeExtension: chrome?.extensionInstalled === true,
    openSessions:
      list.browsers?.map((value) => ({
        name: value.name,
        attached: value.attached,
      })) ?? [],
    next:
      chrome?.extensionInstalled === true
        ? "Use extension=chrome."
        : "Install the Chrome extension or explicitly configure and test CDP.",
  };
}
main()
  .then((value) => console.log(JSON.stringify(value)))
  .catch((error) => {
    console.log(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  });

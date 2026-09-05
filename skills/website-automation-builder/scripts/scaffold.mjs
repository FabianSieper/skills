#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  stat,
  mkdtemp,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      url: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean" },
      demo: { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    console.log(
      "Usage: scaffold.mjs --name <site>-automation --url https://host --out /path/<site>-automation [--demo]",
    );
    return;
  }
  const name = values.name;
  if (
    !name ||
    name.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*-automation$/.test(name)
  )
    throw new Error(
      "--name requires <site>-automation in lowercase kebab-case (max 64).",
    );
  if (!values.url || !values.out)
    throw new Error("Required: --name NAME --url URL --out PATH");
  const url = new URL(values.url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (values.demo && !local)
    throw new Error("--demo requires a localhost URL.");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
  )
    throw new Error(
      "Use HTTPS (or localhost HTTP), without credentials, query or fragment.",
    );
  const out = resolve(values.out);
  if (basename(out) !== name)
    throw new Error("Output directory must match --name.");
  try {
    await stat(out);
    throw new Error("Output already exists; refusing to overwrite.");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const source = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../assets/site-template",
  );
  const replacements = {
    "{{SLUG}}": name,
    "{{BASE_URL_JSON}}": JSON.stringify(url.href),
    "{{ORIGIN_JSON}}": JSON.stringify(url.origin),
    "{{HOST}}": url.host,
    "{{BASE_URL}}": url.href,
  };
  async function copy(from, to) {
    await mkdir(to, { recursive: true });
    for (const entry of await readdir(from, { withFileTypes: true })) {
      if (entry.isSymbolicLink())
        throw new Error("Template symlinks are not allowed.");
      const name = entry.name === "SKILL.template.md" ? "SKILL.md" : entry.name;
      const dst = join(to, name);
      if (entry.isDirectory()) await copy(join(from, entry.name), dst);
      else {
        let text = await readFile(join(from, entry.name), "utf8");
        for (const [key, value] of Object.entries(replacements))
          text = text.split(key).join(value);
        await writeFile(dst, text, { flag: "wx" });
      }
    }
  }
  await mkdir(dirname(out), { recursive: true });
  const temporary = await mkdtemp(join(dirname(out), `.${name}-`));
  try {
    await copy(source, temporary);
    if (values.demo) {
      const assets = resolve(source, "../");
      // Demo overlays deliberately replace only template files in this new directory.
      async function overlay(from, to) {
        await mkdir(to, { recursive: true });
        for (const entry of await readdir(from, { withFileTypes: true })) {
          if (entry.isSymbolicLink()) throw new Error("Demo symlink");
          if (entry.isDirectory())
            await overlay(join(from, entry.name), join(to, entry.name));
          else {
            let text = await readFile(join(from, entry.name), "utf8");
            for (const [key, value] of Object.entries(replacements))
              text = text.split(key).join(value);
            await writeFile(join(to, entry.name), text);
          }
        }
      }
      await overlay(join(assets, "demo"), temporary);
      for (const [file, target] of [
        ["InventoryPage.ts", "src/pages/InventoryPage.ts"],
        ["find.action.ts", "src/actions/inventory.find.ts"],
        ["update.action.ts", "src/actions/inventory.update-title.ts"],
      ]) {
        await writeFile(
          join(temporary, target),
          await readFile(join(assets, "examples", file)),
        );
      }
      const configPath = join(temporary, "site.config.ts");
      await writeFile(
        configPath,
        (await readFile(configPath, "utf8")).replace(
          "configured: false",
          "configured: true",
        ),
      );
      const skillPath = join(temporary, "SKILL.md");
      await writeFile(
        skillPath,
        (await readFile(skillPath, "utf8")).replace(
          "BUILD_REQUIRED: add supported user intents.",
          "Search inventory by SKU and plan an item title update in the local demo fixture.",
        ),
      );
    }
    await rename(temporary, out);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
  console.log(
    JSON.stringify({
      ok: true,
      path: out,
      status: "build_required",
      next: "npm install, implement actions, then npm run verify",
    }),
  );
}
main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exitCode = 1;
});

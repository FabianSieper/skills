import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { implementationFingerprint } from "../src/runtime/fingerprint.ts";

test("source and lockfile changes invalidate the implementation fingerprint", async () => {
  const root = await mkdtemp(join(tmpdir(), "website-fingerprint-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "src", "action.ts"),
      "export const version = 1;",
    );
    await writeFile(join(root, "site.config.ts"), "export const config = {};");
    await writeFile(join(root, "package.json"), "{}");
    const first = await implementationFingerprint(root);
    assert.equal(first, await implementationFingerprint(root));
    await writeFile(
      join(root, "src", "action.ts"),
      "export const version = 2;",
    );
    const second = await implementationFingerprint(root);
    assert.notEqual(first, second);
    await writeFile(join(root, "package-lock.json"), "{}");
    assert.notEqual(second, await implementationFingerprint(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

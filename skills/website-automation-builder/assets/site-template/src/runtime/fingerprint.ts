import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Bind approvals to source, config and dependency definitions, not only a manual version. */
export async function implementationFingerprint(
  project: string,
): Promise<string> {
  const files: string[] = [];
  async function walk(relative: string): Promise<void> {
    for (const entry of await readdir(join(project, relative), {
      withFileTypes: true,
    })) {
      const path = join(relative, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Source symlinks require an explicit reviewed build.");
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await walk("src");
  files.push("site.config.ts", "package.json");
  try {
    await readFile(join(project, "package-lock.json"));
    files.push("package-lock.json");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash
      .update(file)
      .update("\0")
      .update(await readFile(join(project, file)))
      .update("\0");
  }
  return hash.digest("hex");
}

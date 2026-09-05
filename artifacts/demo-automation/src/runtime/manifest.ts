import type { config } from "../../site.config.ts";
import type { Fields, Input } from "./input.ts";
export type RuntimeSettings = typeof config & {
  browser: typeof config.browser & { cliScript?: string };
};
export interface Bundle {
  file: string;
  sha256: string;
}
export interface ManifestAction {
  id: string;
  kind: "read" | "write";
  description: string;
  input: Fields;
  output: { description: string };
  example: Input;
  preconditions: readonly string[];
  postconditions: readonly string[];
  next: readonly string[];
  bundle: Bundle;
}
export interface Manifest {
  format: 1;
  buildHash: string;
  config: RuntimeSettings;
  actions: ManifestAction[];
  observe: { ids: string[]; bundle: Bundle };
}

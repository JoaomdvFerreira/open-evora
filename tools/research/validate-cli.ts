#!/usr/bin/env node
/**
 * CLI wrapper for validate.ts. Equivalent to the legacy
 * tools/validate-research.js CLI: same flags, same output format, same
 * exit codes. All validation logic lives in validate.ts; this file owns
 * only process.argv parsing, console output, and process.exitCode.
 *
 * Usage: node --experimental-strip-types tools/research/validate-cli.ts [--dir <researchRoot>]
 * Exit code 0 = all records valid, 1 = at least one problem found.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateResearchRoot } from "./validate.ts";

function main(): void {
  const args = process.argv.slice(2);
  const dirFlagIdx = args.indexOf("--dir");
  const researchRoot =
    dirFlagIdx !== -1 && args[dirFlagIdx + 1]
      ? resolve(args[dirFlagIdx + 1])
      : resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "research");

  const { errors, totalRecords } = validateResearchRoot(researchRoot);

  if (errors.length > 0) {
    console.error(`Validated ${totalRecords} record(s): ${errors.length} problem(s) found.\n`);
    for (const e of errors) console.error(" - " + e);
    process.exitCode = 1;
  } else {
    console.log(`Validated ${totalRecords} record(s): OK.`);
    process.exitCode = 0;
  }
}

main();

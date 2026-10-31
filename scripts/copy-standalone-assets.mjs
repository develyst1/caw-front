// Next.js `output: "standalone"` does not include <distDir>/static or public/ —
// copy them in so the standalone server can serve assets on its own.
// Reads the same NEXT_DIST_DIR as next.config (default ".next"). Fails loudly if the build output is missing.
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const distDir = process.env.NEXT_DIST_DIR || ".next";
const standalone = join(root, distDir, "standalone");
const staticDir = join(root, distDir, "static");

if (!existsSync(standalone)) {
  console.error(`[postbuild] ${standalone} is missing — is output: "standalone" set in next.config?`);
  process.exit(1);
}
cpSync(staticDir, join(standalone, distDir, "static"), { recursive: true });

const publicDir = join(root, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standalone, "public"), { recursive: true });
}

console.log(`[postbuild] copied ${distDir}/static` + (existsSync(publicDir) ? " + public/" : "") + ` into ${distDir}/standalone`);

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Two sessions share this checkout: each builds into its own folder (Bob: NEXT_DIST_DIR=.next-b on :3510, Fanta: .next-f on :3500).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Stops `next dev` writing AGENTS.md / CLAUDE.md at the repo root.
  agentRules: false,
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;

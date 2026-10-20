// Which implementation of `CawApi` the app uses (D-089, TASK-B-093): `CAW_API=http` — caw-back at `CAW_API_URL` — is the default, so a plain
// `bun run dev` runs the real app; `CAW_API=mock` (`bun run dev:mock`, the e2e) is the built-in sample data.
import type { CawApi } from "./caw";
import { createHttpApi } from "./http";
import { createMockApi, type MockState } from "./mock";

declare global { var __cawMock: CawApi | undefined; var __cawHttp: CawApi | undefined }

export const mode = () => process.env.CAW_API || "http";

/** True on sample data — the mock (D-058: every page says so). The same value `pick()` reads. */
export const onSampleData = () => mode() === "mock";

function pick(): CawApi {
  const which = mode();
  if (which === "mock") return (globalThis.__cawMock ??= createMockApi()); // one in-memory copy for the whole server process
  if (which === "http") return (globalThis.__cawHttp ??= createHttpApi());
  throw new Error(`CAW_API=${which}: use "mock" or "http"`);
}

/** Back to the seed: the next call gets a fresh mock. For the e2e's reset route only (a no-op for `http`, which has nothing of ours to reset). */
export function resetMock(state?: MockState) { globalThis.__cawMock = state ? createMockApi({ state }) : undefined; }

/** Where caw-back is expected (the same default as http.ts). */
export const backendUrl = () => process.env.CAW_API_URL ?? "http://127.0.0.1:4500";

/** On http, can caw-back be reached right now? One light read of caw-back's own `GET /health` with a 3 s limit, asked once per request by the root
 *  layout, so a down back end shows BackendDown instead of an error or a blank page (D-089). `/v1/projects` was the probe first and took 1.1–1.4 s
 *  against a real database, too close to a 1.5 s limit (D-094 X-1). Any HTTP answer counts as reachable; only no answer does not. A refused
 *  connection fails at once, so a dead caw-back is not slowed by the longer limit. */
export async function backendReachable(timeoutMs = 3000): Promise<boolean> {
  try { await fetch(`${backendUrl()}/health`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" }); return true; }
  catch { return false; }
}

export const api: CawApi = new Proxy({} as CawApi, { get: (_t, key) => (pick() as unknown as Record<string | symbol, unknown>)[key] });

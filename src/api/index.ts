// Which implementation of `CawApi` the app uses: `CAW_API=mock` (the default) or `CAW_API=http` (caw-back at `CAW_API_URL`).
import type { CawApi } from "./caw";
import { createHttpApi } from "./http";
import { createMockApi } from "./mock";

declare global { var __cawMock: CawApi | undefined; var __cawHttp: CawApi | undefined }

function pick(): CawApi {
  const which = process.env.CAW_API || "mock";
  if (which === "mock") return (globalThis.__cawMock ??= createMockApi()); // one in-memory copy for the whole server process
  if (which === "http") return (globalThis.__cawHttp ??= createHttpApi());
  throw new Error(`CAW_API=${which}: use "mock" or "http"`);
}

/** Back to the seed: the next call gets a fresh mock. For the e2e's reset route only (a no-op for `http`, which has nothing of ours to reset). */
export function resetMock() { globalThis.__cawMock = undefined; }

export const api: CawApi = new Proxy({} as CawApi, { get: (_t, key) => (pick() as unknown as Record<string | symbol, unknown>)[key] });

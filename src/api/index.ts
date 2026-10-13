// Which implementation of `CawApi` the app uses: `CAW_API=mock` (the default) until REQ-010's OpenAPI lands, then `http`.
import type { CawApi } from "./caw";
import { createMockApi } from "./mock";

declare global { var __cawMock: CawApi | undefined }

function pick(): CawApi {
  const which = process.env.CAW_API || "mock";
  if (which === "mock") return (globalThis.__cawMock ??= createMockApi()); // one in-memory copy for the whole server process
  throw new Error(`CAW_API=${which}: only "mock" exists until REQ-010's OpenAPI is announced (then src/api/http.ts)`);
}

export const api: CawApi = new Proxy({} as CawApi, { get: (_t, key) => (pick() as unknown as Record<string | symbol, unknown>)[key] });

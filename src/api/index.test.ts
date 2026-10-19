// Which back end the app talks to (D-089, TASK-B-093): unset → the real caw-back (http); `mock` → the built-in sample data; anything else → an error
// that names the two choices. Plus the reachability probe the root layout uses for the BackendDown screen.
import { afterEach, describe, expect, test } from "bun:test";
import { api, backendReachable, mode, onSampleData } from "./index";

const saved = { api: process.env.CAW_API, url: process.env.CAW_API_URL };
afterEach(() => {
  if (saved.api === undefined) delete process.env.CAW_API; else process.env.CAW_API = saved.api;
  if (saved.url === undefined) delete process.env.CAW_API_URL; else process.env.CAW_API_URL = saved.url;
});

describe("CAW_API", () => {
  test("unset → http: a plain `bun run dev` is the real app, and no sample-data mark", () => {
    delete process.env.CAW_API;
    expect(mode()).toBe("http");
    expect(onSampleData()).toBe(false);
  });
  test("mock → the sample data (dev:mock and the e2e), with the mark", () => {
    process.env.CAW_API = "mock";
    expect(mode()).toBe("mock");
    expect(onSampleData()).toBe(true);
  });
  test("anything else → the existing error naming both choices", () => {
    process.env.CAW_API = "sample";
    expect(() => api.projects).toThrow('CAW_API=sample: use "mock" or "http"');
  });
});

describe("backendReachable", () => {
  test("nothing listening → false, within the timeout", async () => {
    process.env.CAW_API_URL = "http://127.0.0.1:9"; // the discard port: nothing answers HTTP there
    const t0 = Date.now();
    expect(await backendReachable(500)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(1500);
  });
  test("any HTTP answer → true (a 404 still means caw-back is up)", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("no", { status: 404 }) });
    process.env.CAW_API_URL = `http://127.0.0.1:${server.port}`;
    expect(await backendReachable(1500)).toBe(true);
    server.stop(true);
  });
});

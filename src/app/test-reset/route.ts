// A test-only door: POST puts the in-memory mock back to its seed, so each e2e test starts from the same place and the spec files do not
// depend on the order they run in (TASK-B-045). It answers only when `CAW_API` is the mock AND `CAW_TEST_RESET=1` (Playwright's web server
// sets it); in any other build — an http one, or a mock one nobody asked to reset — it is a plain 404, like a route that is not there.
// (Not under `__test/`: a folder starting with an underscore is private in Next's App Router and is never a route.)
import { resetMock } from "@/api";

export const dynamic = "force-dynamic";

const allowed = () => (process.env.CAW_API || "mock") === "mock" && process.env.CAW_TEST_RESET === "1";

export function POST() {
  if (!allowed()) return new Response(null, { status: 404 });
  resetMock();
  return new Response(null, { status: 204 });
}

// every other method is also a 404, not Next's 405: nothing here to find
export const GET = () => new Response(null, { status: 404 });

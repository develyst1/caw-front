// A test-only door: POST puts the in-memory mock back to its seed, so each e2e test starts from the same place and the spec files do not
// depend on the order they run in (TASK-B-045). It answers only when `CAW_API` is the mock AND `CAW_TEST_RESET=1` (Playwright's web server
// sets both, D-089); in any other build — an http one (the default since D-089), or a mock one nobody asked to reset — it is a plain 404,
// like a route that is not there. `?reply=<text>` (TASK-B-101) makes the entry worker answer the newest operator message, with the same gate.
// (Not under `__test/`: a folder starting with an underscore is private in Next's App Router and is never a route.)
import { api, resetMock } from "@/api";
import { MOCK_PROJECT_ID, MOCK_STATES, type MockRunner, type MockState } from "@/api/mock";

export const dynamic = "force-dynamic";

const allowed = () => process.env.CAW_API === "mock" && process.env.CAW_TEST_RESET === "1"; // exactly mock: the default is http (src/api/index.ts)

export function POST(req: Request) {
  if (!allowed()) return new Response(null, { status: 404 });
  const { searchParams } = new URL(req.url);
  const reply = searchParams.get("reply");
  if (reply !== null) { // the entry worker answers the newest operator message of the one project (TASK-B-101, D-095: the e2e that waits for a reply without a reload)
    if (reply.length < 1 || reply.length > 4000) return new Response("reply: 1–4 000 characters", { status: 400 });
    return (api as unknown as MockRunner).replyChat(MOCK_PROJECT_ID, reply).then(
      () => new Response(null, { status: 204 }),
      (e: { status?: number; message?: string }) => new Response(e.message ?? "refused", { status: e.status ?? 500 }),
    );
  }
  const team = searchParams.get("team");
  if (team !== null) { // the mock team starts or stops checking in, without a reset (TASK-B-103, REQ-015 R1)
    if (team !== "up" && team !== "down") return new Response('team: "up" or "down"', { status: 400 });
    (api as unknown as MockRunner).setTeamRunning(team === "up");
    return new Response(null, { status: 204 });
  }
  const codeMap = searchParams.get("codeMap");
  if (codeMap !== null) { // a worker saves the first project's code map, as the setup step does (TASK-B-110, REQ-015 R2): the e2e for a map arriving live
    if (codeMap !== "save") return new Response('codeMap: "save"', { status: 400 });
    return (api as unknown as MockRunner).saveCodeMap(MOCK_PROJECT_ID).then(() => new Response(null, { status: 204 }), (e: { status?: number; message?: string }) => new Response(e.message ?? "refused", { status: e.status ?? 500 }));
  }
  const state = searchParams.get("state");
  if (state === null) { resetMock(); return new Response(null, { status: 204 }); }
  if (!(MOCK_STATES as readonly string[]).includes(state)) return new Response(`unknown state "${state}"; known: ${MOCK_STATES.join(", ")}`, { status: 400 });
  resetMock(state as MockState); // a named variant of the seed (TASK-B-049)
  return new Response(null, { status: 204 });
}

// every other method is also a 404, not Next's 405: nothing here to find
export const GET = () => new Response(null, { status: 404 });

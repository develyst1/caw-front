# caw-front

## Run

Next.js 16.3.6 · React 19.3.0 · TypeScript 5.9.3 · Ant Design 6.6.5 · bun · Playwright 1.64.0 — the versions of `blueprint-front`.
Every screen reads and writes through `src/api/caw.ts` (`CawApi`); until REQ-010's OpenAPI exists the implementation is
`src/api/mock.ts` (`CAW_API=mock`, the default). Words live in `src/words.ts`. The app never touches a database.

```bash
bun install
bun run dev                              # http://127.0.0.1:3510
NEXT_DIST_DIR=.next-b bun run build      # each person builds into their own folder (Bob .next-b, Fanta .next-f)
NEXT_DIST_DIR=.next-b bun run start      # port 3510
bun run typecheck
bun test src                             # words + the mock's seed
NEXT_DIST_DIR=.next-b PLAYWRIGHT_PORT=3510 bun run test:e2e   # starts its own server on the port
```

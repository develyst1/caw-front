# caw-front

## Run

Next.js 16.3.6 · React 19.3.0 · TypeScript 5.9.3 · Ant Design 6.6.5 · bun · Playwright 1.64.0 — the versions of `blueprint-front`.
Every screen reads and writes through `src/api/caw.ts` (`CawApi`); the implementation is `src/api/mock.ts` (built-in sample data,
`CAW_API=mock`, the default) or `src/api/http.ts` on caw-back's OpenAPI (`CAW_API=http`). Words live in `src/words.ts`.
The app never touches a database.

```bash
bun install
bun run dev                              # http://127.0.0.1:3500 (PORT=… to change it) — the built-in sample data
bun run dev:http                         # the same, talking to a running caw-back at CAW_API_URL (default http://127.0.0.1:4500)
NEXT_DIST_DIR=.next-b bun run build      # each person builds into their own folder (Bob .next-b, Fanta .next-f)
PORT=3510 NEXT_DIST_DIR=.next-b bun run start   # a production run; the default port is 3500 too
bun run typecheck
bun test src                             # words + the mock's seed
NEXT_DIST_DIR=.next-b PLAYWRIGHT_PORT=3510 bun run test:e2e   # starts its own server on the port; never reuses one
```

The variables the code reads are listed, with their defaults, in `.env.example`.

## Run it with real data — the four apps, in this order

Each in its own terminal. `pglite:memory` is a throw-away database in memory (it is empty again after a restart); put your own
`DATABASE_URL` in the app's `.env` instead for a database that stays.

| # | App | Command | Port |
|---|---|---|---|
| 1 | `blueprint-back` | `cd blueprint-back && DATABASE_URL=pglite:memory bun run dev` | 4200 |
| 2 | `blueprint-front` | `cd blueprint-front && bun run dev` | 3100 |
| 3 | `caw-back` | `cd caw-back && DATABASE_URL=pglite:memory bun run dev` | 4500 |
| 4 | `caw-front` | `cd caw-front && bun run dev:http` | 3500 |

Order matters: `caw-back` asks `blueprint-back` (4200) whether a project and its version exist when a CAW project is made, and
`caw-front` asks `caw-back`. Blueprint's "ส่งไปสร้างที่ CAW" opens `http://127.0.0.1:3500/start?project=…&version=…`.

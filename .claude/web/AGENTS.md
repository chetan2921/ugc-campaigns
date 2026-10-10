# web

The Next.js client. Brands and creators use it against the API. Visual
direction is `web/DESIGN.md`. HTTP shapes are `.claude/contracts/api-surface.md`.
Symbol lookup is `.claude/web/STRUCTURE.md`.

## Stack
- Next.js 16, React 19, Tailwind 4, shadcn (base-nova), SWR
- Money stays integer paise until `formatINR`. Deadlines display in IST.
- The auth token is the `localStorage` key `token`. `useMe` reads it only after
  mount, so the server and the first client render match.

## Entry points
- `npm run dev` from `web/`. `./dev.sh` starts this once the folder exists.
- `npm run lint` and `npm run build`

## Folder map
```
web/
  DESIGN.md                  visual direction
  src/app/                   routes, including /inbox and /settings
  src/components/            shell, role guard, campaign form, fee note, application card, submit form, withdraw form, bill, meter, review, shadcn ui/
  src/lib/                   api client, auth, money, time, types
```

## Commands
Run from `web/`.

| What | Command |
|------|---------|
| dev | `npm run dev` |
| lint | `npm run lint` |
| build | `npm run build` |

`.env.local` stays on the machine. `.env.local.example` is committed.
`NEXT_PUBLIC_DEMO=1` shows the demo login links.

Cache components are off. These routes read the URL and then fetch with SWR
after login, so they are not prerendered.

`refero-design`, `impeccable`, the shadcn skill, `design-motion-principles`,
and `boneyard` are not installed. Their steps were done by hand. `web/DESIGN.md`
says so.

<!-- mapped: .@172655c paths: web/src,web/DESIGN.md,web/package.json -->

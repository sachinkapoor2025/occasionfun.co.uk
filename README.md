# OCCASIONFUN LTD website

Public website for **OCCASIONFUN LTD** (company number **17427098**), a UK-registered technology services company. DGV is presented as a technology/engineering delivery partner—not as the primary brand or contracting entity.

Built from `OCCASIONFUN_LTD_Cursor_Website_Build_Spec.md`.

## Stack

- Node.js 24 LTS + npm 11+
- Next.js (App Router) + TypeScript 5.9 + React 19
- Tailwind CSS v4
- Zod server-side form validation
- Vitest for route/content and form validation tests
- AWS Amplify Hosting recommended (see `DEPLOYMENT.md`)

## Local setup

Requires **Node.js 24+** (see `.nvmrc`). On macOS with Homebrew:

```bash
brew install node@24
brew unlink node@20 node@22 2>/dev/null || true
brew link --force --overwrite node@24
node -v   # expect v24.x
```

Then:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Production build (also runs placeholder warning check) |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest suite |
| `npm run check:placeholders` | List unresolved `[INSERT ...]` company fields |

## Environment variables

See `.env.example`:

- `NEXT_PUBLIC_SITE_URL` — canonical site URL
- `CONTACT_NOTIFY_EMAIL` — notification mailbox (server-side)
- `CONTACT_WEBHOOK_URL` — server webhook that receives validated enquiries
- `FAIL_ON_PLACEHOLDERS` — set `true` to fail builds when placeholders remain

No secrets belong in client-side code.

## Site map

- `/` Home
- `/about`
- `/services` + `/services/[slug]` for each capability
- `/public-sector`
- `/technology-partner`
- `/how-we-work`
- `/trust`
- `/policies`
- `/contact`
- `/privacy` `/cookies` `/terms`

## Content integrity

Company details and partner identity live in `src/config/company.ts`. Unverified values use `[INSERT ...]` placeholders and must be replaced before launch. See `PRE_LAUNCH_CHECKLIST.md`.

## Hosting decision

**Amazon S3 static website hosting in `eu-west-2` (London)** is the selected option.

- Buckets: `occasionfun.co.uk` (+ `www.occasionfun.co.uk` redirect)
- Route 53 apex/www alias to the S3 website endpoint
- GitHub Actions / Azure Pipelines run `npm ci`, static export to `out/`, then `aws s3 sync`
- Details: `DEPLOYMENT.md`

## Important constraints

- Do not invent clients, certifications, staff bios, or delivery history
- Do not claim Cyber Essentials / ISO / framework status without evidence
- Do not publish registered office or contact details until verified/approved
- Legal pages are drafts marked for review

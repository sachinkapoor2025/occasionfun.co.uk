# Deployment guide — OCCASIONFUN LTD

## Hosting recommendation

**Selected option: AWS Amplify Hosting**

### Why Amplify (not S3 + CloudFront static hosting)

This site is a Next.js App Router application with:

- A server-side `/api/contact` route (Zod validation, rate limiting, webhook notification)
- Dynamic metadata helpers and App Router conventions
- Runtime environment variables for enquiry delivery

Those features need a Next.js-compatible server/runtime. A pure S3 static export would drop the contact API unless a separate backend was maintained in parallel.

Use **Amazon S3 + CloudFront** only if the contact form is later moved to an external managed form/API and the Next.js app is converted to a fully static export.

## Environments

Maintain at least:

| Environment | Purpose |
| --- | --- |
| Development | Local `npm run dev` |
| Staging | Amplify branch preview / staging app |
| Production | Live custom domain |

## Required environment variables

Copy `.env.example` and set:

- `NEXT_PUBLIC_SITE_URL` — canonical public URL (include `https://`)
- `CONTACT_NOTIFY_EMAIL` — verified company mailbox for notifications
- `CONTACT_WEBHOOK_URL` — HTTPS endpoint that receives validated enquiries (API Gateway + Lambda, or equivalent)
- `FAIL_ON_PLACEHOLDERS` — set `true` in production CI once placeholders are replaced

Never commit secrets. Prefer Amplify environment variables / AWS Secrets Manager for credentials used by the webhook worker (for example SES credentials).

## Packages are installed in the pipeline — never commit `node_modules`

- `node_modules/` is gitignored and must stay out of GitHub.
- Commit `package.json` and `package-lock.json` only.
- Amplify (`amplify.yml`) and GitHub Actions (`.github/workflows/ci.yml`) both run `npm ci` so dependencies are built/installed during the pipeline.
- Do not upload or vendor `node_modules` into the repository.

## Amplify setup (high level)

1. Create an Amplify Hosting app connected to this repository.
2. Confirm Amplify’s current Next.js SSR/runtime support for the installed Next.js version before go-live.
3. Use the repo `amplify.yml` build settings (Node 24 → `npm ci` → test/lint/typecheck → `npm run build`).
4. Configure environment variables per environment.
5. Attach the custom domain and request an ACM certificate through Amplify/DNS guidance for the domain region workflow Amplify requires.
6. Point DNS (Route 53 or external DNS) to the Amplify domain targets.
7. Enforce HTTPS only.
8. Enable branch previews for pull requests if desired.

## Contact form backend pattern

Recommended production pattern:

1. Browser posts to `/api/contact`
2. Route validates with Zod, applies rate limiting, ignores honeypot spam
3. Route forwards a minimised payload to `CONTACT_WEBHOOK_URL`
4. Lambda (or equivalent) stores the enquiry securely and sends email via Amazon SES to `CONTACT_NOTIFY_EMAIL`
5. Retention/deletion process is defined before collecting real personal data

Do not expose AWS keys, SES credentials or mailbox credentials in frontend code.

## Security headers and operations

- Prefer Amplify/CloudFront security headers (CSP as practical, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`)
- Use least-privilege IAM roles for build and runtime services
- Enable monitoring/error logging without collecting unnecessary personal data
- Keep dependencies updated; run `npm audit` as part of maintenance

## Rollback

1. In Amplify, redeploy the previous successful job/artifact for the production branch.
2. If a bad DNS change was made, revert DNS to the last known good Amplify target.
3. If the contact webhook misbehaves, disable `CONTACT_WEBHOOK_URL` only as an emergency measure and communicate downtime; validated submissions will not be forwarded until restored.

## Cost note

Do not treat any figure as a guaranteed monthly cost. After Amplify app size, traffic, SES volume and log retention are known, estimate from current AWS pricing for Amplify Hosting, SES, Lambda/API Gateway (if used), Route 53 and certificate/DNS charges.

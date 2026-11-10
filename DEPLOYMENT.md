# Deployment guide — OCCASIONFUN LTD

The site is a **static Next.js export** (`output: "export"`). The build writes `out/`.

## Planned hosting

AWS Amplify Hosting in `eu-west-2` (London), with Amplify-managed CloudFront, is the planned platform. No Amplify application has been created, connected, or deployed.

| Branch | Role and URL |
| --- | --- |
| `demo` | Preview and staging. Set `NEXT_PUBLIC_SITE_URL` to the Amplify-generated preview URL before that build. |
| `main` | Production. Use `https://occasionfun.co.uk` only after approved changes are merged into `main` and DNS is confirmed. |

GitHub Actions (`.github/workflows/ci.yml`) is CI only. It runs `npm ci`, lint, typecheck, tests, and `npm run build`, then uploads the `out/` artifact. It does not deploy the website.

Azure Pipelines does not start on branch pushes. Its Build stage runs the same checks. It does not deploy.

## Existing website records

These records describe the current website setup. They are not the deployment path in this repository.

| Resource | Value |
| --- | --- |
| Region | `eu-west-2` (London) |
| Apex bucket | `occasionfun.co.uk` |
| WWW bucket | `www.occasionfun.co.uk` (redirects to apex) |
| Website endpoint | `http://occasionfun.co.uk.s3-website.eu-west-2.amazonaws.com` |
| Route 53 zone | `occasionfun.co.uk` (`Z01121381OR3CHAAZGTH7`) |

### HTTPS note

S3 website endpoints serve **HTTP only**. For HTTPS on the live domain, place CloudFront (+ ACM certificate in `us-east-1`) in front of the bucket later. Route 53 currently aliases the apex to the S3 website endpoint. Do not attach `occasionfun.co.uk` to Amplify until the production deployment is authorized.

## Packages are installed in the pipeline — never commit `node_modules`

- `node_modules/` is gitignored.
- Commit `package.json` and `package-lock.json` only.
- GitHub Actions and Azure Pipelines run `npm ci` then `npm run build` (static `out/`). They do not sync the site to S3.

## Local build

```bash
npm ci
NEXT_PUBLIC_SITE_URL=https://occasionfun.co.uk npm run build
```

For a `demo` preview build, set `NEXT_PUBLIC_SITE_URL` to that branch's Amplify URL instead of the production domain.

## Contact form on static hosting

There is no server `/api/contact` on the static export. The form validates in the browser and either:

1. Posts to `NEXT_PUBLIC_CONTACT_ENDPOINT` if configured, or
2. Opens a `mailto:` draft to `enquiries@occasionfun.co.uk`.

A reference Lambda-style handler remains in `src/server/contact-api.reference.ts` if you later add API Gateway.

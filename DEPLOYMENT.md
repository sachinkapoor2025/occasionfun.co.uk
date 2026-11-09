# Deployment guide — OCCASIONFUN LTD (S3 static hosting)

## Selected hosting: Amazon S3 (eu-west-2 / London)

The site is a **static Next.js export** (`output: "export"`) synced to S3 website hosting.

| Resource | Value |
| --- | --- |
| Region | `eu-west-2` (London) |
| Apex bucket | `occasionfun.co.uk` |
| WWW bucket | `www.occasionfun.co.uk` (redirects to apex) |
| Website endpoint | `http://occasionfun.co.uk.s3-website.eu-west-2.amazonaws.com` |
| Route 53 zone | `occasionfun.co.uk` (`Z01121381OR3CHAAZGTH7`) |

Amplify / Cloud Run are not required for this static setup.

### HTTPS note

S3 website endpoints serve **HTTP only**. For HTTPS on the live domain, place CloudFront (+ ACM certificate in `us-east-1`) in front of the bucket later. Route 53 currently aliases the apex to the S3 website endpoint.

## Packages are installed in the pipeline — never commit `node_modules`

- `node_modules/` is gitignored.
- Commit `package.json` and `package-lock.json` only.
- GitHub Actions and Azure Pipelines both run `npm ci` then `npm run build` (static `out/`) then `aws s3 sync`.

## GitHub Actions secrets

Set these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | Permanent IAM access key id (exact name — not `WS_ACCESS_KEY_ID`) |
| `AWS_SECRET_ACCESS_KEY` | Permanent IAM secret access key |

Do **not** set `AWS_SESSION_TOKEN` when using permanent IAM user keys.

One-time S3 bucket + Route 53 alias setup was done with temporary admin credentials. Ongoing deploys only need S3 sync permission via the permanent keys above.

## Azure Pipelines

See `azure-pipelines.yml`. Configure the same AWS variables as secret pipeline variables.

## Local build and manual deploy

```bash
npm ci
NEXT_PUBLIC_SITE_URL=https://occasionfun.co.uk npm run build
aws s3 sync out/ s3://occasionfun.co.uk/ --delete --region eu-west-2
```

## Contact form on static hosting

There is no server `/api/contact` on S3. The form validates in the browser and either:

1. Posts to `NEXT_PUBLIC_CONTACT_ENDPOINT` if configured, or
2. Opens a `mailto:` draft to `enquiries@occasionfun.co.uk`.

A reference Lambda-style handler remains in `src/server/contact-api.reference.ts` if you later add API Gateway.

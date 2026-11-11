# Deployment guide — OCCASIONFUN LTD

The site is a static Next.js export (`output: "export"`). The build writes `out/`.

GitHub Actions is the CI/CD path. AWS SAM / CloudFormation deploys the contact API in `eu-west-2`. AWS Amplify hosts the frontend. This repository does not deploy from the AWS console, and it does not use `sam deploy --guided` or GitHub OIDC.

Nothing in this change has been deployed. The workflows below are ready for review. Pushing `demo` or `main` is what starts them.

## What is implemented

| Workflow | File | What it does now |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | Validates pull requests and pushes to `demo`, `main`, and the existing `master` trigger. |
| Deploy demo | `.github/workflows/deploy-demo.yml` | After CI succeeds, updates stack `occasionfun-co-uk-contact` and starts the Amplify `demo` build. |
| Deploy production | `.github/workflows/deploy-production.yml` | Prepared, and blocked until production is explicitly authorized. |
| Smoke test | `.github/workflows/smoke-test.yml` | Checks the live demo site and the existing demo API without submitting an enquiry. |

Azure Pipelines remains CI-only. Its triggers are disabled and it does not deploy.

## CI

`.github/workflows/ci.yml` runs on:

- pull requests
- pushes to `demo` and `main` (the existing `master` push trigger is still present)
- manual dispatch

It installs Node.js 24, installs the frontend and contact API dependencies, then runs frontend lint, typecheck, tests, backend typecheck, backend tests, `sam build`, `sam validate --lint`, and the static export. It uploads `out/` as an artifact. It does not deploy.

The static export in CI uses `NEXT_PUBLIC_SITE_URL=https://occasionfun.co.uk`. The demo deployment builds again with the demo site URL and the demo API endpoint.

## Demo deployment

`.github/workflows/deploy-demo.yml` runs on a push to `demo` and on manual dispatch. A second demo deployment waits until the current one finishes.

Sequence:

1. Check Amplify app `d2oib89bmco9su`, branch `demo`, before CI or either deployment. If `enableAutoBuild` is already false, leave it unchanged. If it is true, list the visible jobs, wait until a running job belongs to another commit or has no full commit id, disable auto-build for that demo branch only, and read it back with `get-branch`. A job with a missing or short commit id is never treated as this commit. A failed verification stops the workflow before the backend and frontend run.
2. Wait until the CI workflow has succeeded for the same commit.
3. Check out that commit.
4. Require `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
5. Configure those credentials for `eu-west-2` and require account `796174527529`.
6. Install SAM CLI and Node.js 24, then install frontend and contact API dependencies.
7. Build the contact API and run `sam build`.
8. Create a CloudFormation change set for `occasionfun-co-uk-contact` with `sam deploy --no-execute-changeset --role-arn arn:aws:iam::796174527529:role/occasionfun-cloudformation-demo`. The script adds that role on every demo run, including when the caller omits `--role-arn`. A different role ARN is rejected before AWS is called. The parameters are `Environment=demo`, the existing SMTP secret ARN, and the current demo origin list:
   `https://occasionfun.co.uk`, `https://www.occasionfun.co.uk`, `https://d2oib89bmco9su.amplifyapp.com`, `https://demo.d2oib89bmco9su.amplifyapp.com`.
9. Write the aggregated change set, including later pages, to a `.json` file and pass that path to `scripts/assert-safe-change-set.mjs`. The checker reads that file. It stops when the file is missing, unreadable, invalid JSON, or has no `Changes` array. An empty `Changes` array is refused. The job deletes the change set and stops when any resource would be added, removed, replaced, or conditionally replaced. That includes `LeadsTable`, `ContactFunction`, `ContactRetryFunction`, `ContactHttpApi`, `ContactLogGroup`, and `ContactRetryLogGroup`.
10. Execute the change set only after that check, then wait for the stack update. SAM's `No changes to deploy` message is the only successful path that skips execution.
11. Require the existing physical names and the endpoint `https://0e6zpkvbkj.execute-api.eu-west-2.amazonaws.com/contact`.
12. Build the frontend with that endpoint and `NEXT_PUBLIC_SITE_URL=https://demo.d2oib89bmco9su.amplifyapp.com`.
13. Publish one Amplify `RELEASE` for the full 40-character GitHub SHA. The step refuses to start unless auto-build is still false. It adopts an existing job for that exact SHA when one is already running or has succeeded. A missing job status, a missing commit id, or a commit id that is not exactly this SHA fails the step. After success, this commit must be the latest successful job. If another commit is the latest deployment, the step fails and does not start a second release.
14. After that deploy job succeeds, a separate smoke job checks the demo site. That job has no AWS credentials.

The demo stack is not created when it is missing. The workflow does not create or update the SMTP secret. Lambda artifacts go to the SAM CLI managed bucket, and the job stops if that bucket is one of the website buckets.

Every demo change set is created with execution role `arn:aws:iam::796174527529:role/occasionfun-cloudformation-demo`. This repository does not create that role. After CloudFormation associates it with `occasionfun-co-uk-contact`, later updates of that stack keep using it. The production script path does not pass this role. A production run that supplies it stops before AWS is called. The stack name, API `0e6zpkvbkj`, table `occasionfun-co-uk-leads`, endpoint, SMTP secret, and existing physical names stay the same. Additions, removals, and replacements are still rejected before the change set is executed.

### Amplify auto-build

The current demo branch configuration is app `d2oib89bmco9su`, branch `demo`, with automatic builds enabled. A push to `demo` therefore starts an Amplify webhook build as well as this workflow. The production branch is not changed. Production hosting remains disabled.

The authorized demo deployment workflow turns `enableAutoBuild` off for `demo` only. That is the transition to GitHub Actions as the only publisher:

- A later push does not start an Amplify build by itself. The site changes only when this workflow reaches the release step.
- If the auto-build check fails, CI and both deployments do not start, and automatic builds stay on.
- If CI fails after auto-build was disabled, the previous Amplify deployment stays in place.
- If the workflow fails after disabling automatic builds, the previous Amplify deployment stays in place until a later run publishes a release. The Amplify console will not rebuild that push on its own.
- `amplify.yml` still builds the frontend inside the `RELEASE` job started by GitHub Actions.
- `aws amplify start-job --job-type RELEASE` continues to work. This workflow uses it only after auto-build reads back as disabled.
- Re-enabling automatic builds is a separate Amplify change. This workflow does not turn the setting back on.
- The `main` branch, if added later, keeps its own setting. This step never calls `update-branch` for it.

A webhook Amplify accepted before `get-branch` showed `enableAutoBuild: false` can still finish. The workflow waits for a build it can see. If that build becomes the latest successful deployment, the release step fails. A job that appears only after the workflow has exited is outside what that run can prove.

## Production deployment

`.github/workflows/deploy-production.yml` triggers on a push to `main` and on manual dispatch. With the current repository settings it only prints that production is not authorized. It does not call AWS.

Backend deployment starts only when both of these are true:

1. Repository variable `PRODUCTION_DEPLOYMENTS_ENABLED` is `true`.
2. The job is attached to the GitHub Environment named `production`, and that environment has a required-reviewer protection rule. The workflow reads the environment and stops if the rule is missing.

Those steps are not a substitute for configuring the environment. Create the environment and its reviewers before setting the variable. A missing environment does not approve a deployment: the reviewer check fails before AWS credentials are configured.

The production stack is `occasionfun-co-uk-prod-contact`. Production does not use `occasionfun-cloudformation-demo`. Its parameters are `Environment=prod`, the same SMTP secret ARN, and only:

- `https://occasionfun.co.uk`
- `https://www.occasionfun.co.uk`

The production names are `occasionfun-co-uk-prod-contact`, `occasionfun-co-uk-prod-contact-retry`, and `occasionfun-co-uk-prod-leads`, with a new API Gateway and table. The change-set guard is the same as demo. Afterward the endpoint must be a different `eu-west-2` API, not `0e6zpkvbkj`.

`describe-stacks` creates the production stack only when CloudFormation returns the ValidationError line `Stack with id occasionfun-co-uk-prod-contact does not exist` and the production workflow has already passed its environment and variable checks. Access denied, invalid credentials, network errors, throttling, and any other describe error stop the job. An existing stack is updated and is never deleted or recreated. Demo still refuses to create a missing stack.

### Production frontend — not enabled

The production Amplify job does not call Amplify and does not publish the site. These items are still open:

- Confirm or create the Amplify branch for `main` on app `d2oib89bmco9su`.
- After the production stack exists, set that branch's `NEXT_PUBLIC_CONTACT_ENDPOINT` to the production API only.
- Set `NEXT_PUBLIC_SITE_URL` to `https://occasionfun.co.uk` for that branch.
- Keep the demo API and demo DynamoDB table off the production branch.
- DNS for `occasionfun.co.uk` is unchanged by these workflows.
- Enable the production frontend job only after the items above are reviewed.

`amplify.yml` runs `scripts/amplify-public-env.mjs`. The demo branch uses the existing demo API and `https://demo.d2oib89bmco9su.amplifyapp.com` when those console variables are empty. Every other branch, including `main` and `master`, fails if a `NEXT_PUBLIC_` value contains the demo API id `0e6zpkvbkj`. Those branches do not receive the demo API as a fallback. `main` and `master` default `NEXT_PUBLIC_SITE_URL` to `https://occasionfun.co.uk`. A production API URL is used only when that branch already has one. Until it is configured, the contact form shows its existing configuration message.

## GitHub configuration

Repository secrets, already expected:

| Secret | Use |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | IAM access key for account `796174527529`. |
| `AWS_SECRET_ACCESS_KEY` | Matching secret key. |

The workflows do not print those values. Do not create an OIDC role for this path.

Repository variable, not set by this repository:

| Variable | Value when production backend deploys are allowed |
| --- | --- |
| `PRODUCTION_DEPLOYMENTS_ENABLED` | `true` |

GitHub Environment, created in the repository settings:

| Environment | Protection |
| --- | --- |
| `production` | Required reviewers. Add this before setting the variable above. |

Region for every AWS step: `eu-west-2`.

## Resource separation

| | Demo | Production |
| --- | --- | --- |
| Stack | `occasionfun-co-uk-contact` | `occasionfun-co-uk-prod-contact` |
| CloudFormation role | `occasionfun-cloudformation-demo` | Not this role |
| API | `0e6zpkvbkj` | A new API created by the production stack |
| Contact Lambda | `occasionfun-co-uk-contact` | `occasionfun-co-uk-prod-contact` |
| Retry Lambda | `occasionfun-co-uk-contact-retry` | `occasionfun-co-uk-prod-contact-retry` |
| DynamoDB | `occasionfun-co-uk-leads` | `occasionfun-co-uk-prod-leads` |
| SMTP secret | `occasionfun-co-uk/contact/smtp` | The same secret |
| Subject prefix | `[DEMO]` | `[PROD]` |
| Website | `https://demo.d2oib89bmco9su.amplifyapp.com` | `https://occasionfun.co.uk` after DNS is approved |

## Smoke tests

`Smoke test` can be run manually from the Actions tab. It also runs after a successful `Deploy demo` once that workflow file is on the default branch. `Deploy demo` runs the same checks in a later job that does not receive AWS credentials. A failed check fails that job after the deployment job has already finished.

The checks are a GET of the demo site, an OPTIONS preflight from the demo origin, and a POST of `{}`. They expect a client error for the POST. They do not submit a valid enquiry and they do not send email. A response or page that contains an access key, the SMTP secret id, or a private key fails the job. The check prints status codes only.

Locally, the same script calls the live demo site:

```bash
node scripts/smoke-demo.mjs
```

The safety rules themselves are covered by `npm test` without calling AWS.

## Inspecting a failed deployment

1. Open the failed Actions run. CI failures stay in the `CI` workflow. Demo deployment failures stay in `Deploy demo`.
2. If the log says the change set was not executed, CloudFormation did not apply it. The resource lines name the logical id, action, and replacement flag. Fix the template or parameters before running the job again. Do not execute that change set from the console.
3. A missing AWS secret fails before `aws` is called.
4. An account or region mismatch fails before the change set is created.
5. A demo endpoint other than `https://0e6zpkvbkj.execute-api.eu-west-2.amazonaws.com/contact` fails the job after the stack operation.
6. Amplify failures leave the API update in place and fail the workflow. If the log says auto-build is disabled and no release was started, re-run after the older build finishes. If another commit is the latest deployment, the release was not accepted. The Amplify console for app `d2oib89bmco9su`, branch `demo`, shows the build log. These workflow logs do not download Amplify log streams.
7. Production runs that say deployment is not authorized have not called AWS. A production run that stops on the reviewer check has also not configured AWS credentials.

## Local build

```bash
npm ci
npm ci --prefix infra/contact-api
NEXT_PUBLIC_SITE_URL=https://occasionfun.co.uk npm run build
```

For a demo-equivalent frontend build, set `NEXT_PUBLIC_SITE_URL` to `https://demo.d2oib89bmco9su.amplifyapp.com` and `NEXT_PUBLIC_CONTACT_ENDPOINT` to the demo API above.

## Contact form

There is no server `/api/contact` on the static export. The form reads `NEXT_PUBLIC_CONTACT_ENDPOINT` at build time. The URL is not hardcoded in the application source. If that variable is missing, the form shows a configuration error and does not submit the enquiry.

The form shows the received-success message only when the API responds that the lead was saved and `notification` is `sent`. A saved enquiry whose notification is still `pending` or `sending`, including HTTP 202, stays on the delayed-delivery message.

## Legacy website records

These records describe an older S3 website path. They are not the deployment path.

| Resource | Value |
| --- | --- |
| Region | `eu-west-2` (London) |
| Apex bucket | `occasionfun.co.uk` |
| WWW bucket | `www.occasionfun.co.uk` (redirects to apex) |
| Website endpoint | `http://occasionfun.co.uk.s3-website.eu-west-2.amazonaws.com` |
| Route 53 zone | `occasionfun.co.uk` (`Z01121381OR3CHAAZGTH7`) |

S3 website endpoints serve HTTP only. Do not attach `occasionfun.co.uk` to Amplify until the production deployment is authorized.

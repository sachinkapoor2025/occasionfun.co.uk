# Deployment guide — OCCASIONFUN LTD

The site is a static Next.js export (`output: "export"`). The build writes `out/`.

GitHub Actions is the CI/CD path. AWS SAM / CloudFormation deploys the contact API in `eu-west-2`. AWS Amplify hosts the frontend. This repository does not deploy from the AWS console, and it does not use `sam deploy --guided` or GitHub OIDC.

Nothing in this change has been deployed. The workflows below are ready for review. Pushing `demo` or `main` is what starts them.

## What is implemented

| Workflow | File | What it does now |
| --- | --- | --- |
| CI/CD | `.github/workflows/ci-cd.yml` | Validates every pull request and push. A successful validation of a `demo` push deploys that commit and then runs smoke tests. A `main` push can deploy production only after required reviewer approval. Both jobs use `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` and keep separate targets, templates, stacks, and CloudFormation roles. |

Azure Pipelines remains CI-only. Its triggers are disabled and it does not deploy.

## CI

`.github/workflows/ci-cd.yml` is the only deployment workflow. Its `validate` job runs on:

- pull requests to `demo` and `main`
- pushes to `demo`, `main`, and `master`

It installs Node.js 24, installs the frontend and contact API dependencies, then runs frontend lint, typecheck, tests, backend typecheck, backend tests, `sam build`, `sam validate --lint`, and the static export. It does not deploy. A failed `validate` job skips `deploy-demo`, `deploy-production`, and `smoke-test`.

The static export in validation uses `NEXT_PUBLIC_SITE_URL=https://occasionfun.co.uk`. The demo deployment builds again with the demo site URL and the demo API endpoint.

Pull requests never deploy. There is no manual dispatch.

## Demo deployment

A push to `demo` runs `validate`, then `deploy-demo` for `github.sha`, then `smoke-test`. A second run for the same ref waits until the current one finishes.

Sequence:

1. `validate` checks the pushed commit. If it fails, deployment does not start.
2. Check out that same commit.
3. Require `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
4. Configure those credentials for `eu-west-2` and require account `796174527529`.
5. Check Amplify app `d2oib89bmco9su`, branch `demo`. If `enableAutoBuild` is already false, leave it unchanged. If it is true, list the visible jobs, wait until a running job belongs to another commit or has no full commit id, disable auto-build for that demo branch only, and read it back with `get-branch`. A job with a missing or short commit id is never treated as this commit. A failed verification stops the job before the backend and frontend run.
6. Install SAM CLI and Node.js 24, then install frontend and contact API dependencies.
7. Build the contact API and run `sam build`.
8. Create a CloudFormation change set for `occasionfun-co-uk-contact` with `sam deploy --no-execute-changeset --role-arn arn:aws:iam::796174527529:role/occasionfun-cloudformation-demo`. The script adds that role on every demo run, including when the caller omits `--role-arn`. A different role ARN is rejected before AWS is called. The parameters are `Environment=demo`, the existing SMTP secret ARN, and the current demo origin list:
   `https://occasionfun.co.uk`, `https://www.occasionfun.co.uk`, `https://d2oib89bmco9su.amplifyapp.com`, `https://demo.d2oib89bmco9su.amplifyapp.com`.
9. Write the aggregated change set, including later pages, to a `.json` file and pass that path to `scripts/assert-safe-change-set.mjs`. The checker reads that file. It stops when the file is missing, unreadable, invalid JSON, or has no `Changes` array. An empty `Changes` array is refused. The job deletes the change set and stops when any resource would be added, removed, replaced, or conditionally replaced. That includes `LeadsTable`, `ContactFunction`, `ContactRetryFunction`, `ContactHttpApi`, `ContactLogGroup`, and `ContactRetryLogGroup`.
10. Execute the change set only after that check, then wait for the stack update. SAM's `No changes to deploy` message is the only successful path that skips execution.
11. Require the existing physical names and the endpoint `https://0e6zpkvbkj.execute-api.eu-west-2.amazonaws.com/contact`.
12. Build the frontend with that endpoint and `NEXT_PUBLIC_SITE_URL=https://demo.d2oib89bmco9su.amplifyapp.com`.
13. Publish one Amplify `RELEASE` for the full 40-character GitHub SHA. The step refuses to start unless auto-build is still false. It adopts an existing job for that exact SHA when one is already running or has succeeded. A missing job status, a missing commit id, or a commit id that is not exactly this SHA fails the step. After success, this commit must be the latest successful job. If another commit is the latest deployment, the step fails and does not start a second release.
14. After `deploy-demo` succeeds, `smoke-test` checks the demo site. That job has no AWS credentials. It does not run for a pull request or for a production deployment.

The demo stack is not created when it is missing. The workflow does not create or update the SMTP secret. Lambda artifacts go to the SAM CLI managed bucket, and the job stops if that bucket is one of the website buckets.

Every demo change set is created with execution role `arn:aws:iam::796174527529:role/occasionfun-cloudformation-demo`. This repository does not create that role. After CloudFormation associates it with `occasionfun-co-uk-contact`, later updates of that stack keep using it. Production passes `arn:aws:iam::796174527529:role/occasionfun-cloudformation-production` and rejects the demo role before AWS is called. The stack name, API `0e6zpkvbkj`, table `occasionfun-co-uk-leads`, endpoint, SMTP secret, and existing physical names stay the same. Additions, removals, and replacements are still rejected before the change set is executed.

### Amplify auto-build

The current demo branch configuration is app `d2oib89bmco9su`, branch `demo`, with automatic builds enabled. A push to `demo` therefore starts an Amplify webhook build as well as this workflow. The production branch is not changed. Production hosting remains disabled.

The authorized demo deployment workflow turns `enableAutoBuild` off for `demo` only. That is the transition to GitHub Actions as the only publisher:

- A later push does not start an Amplify build by itself. The site changes only when this workflow reaches the release step.
- If validation fails, auto-build is left unchanged and deployment does not start.
- If the auto-build check fails, the backend and frontend steps in that job do not start, and automatic builds stay on.
- If the workflow fails after disabling automatic builds, the previous Amplify deployment stays in place until a later run publishes a release. The Amplify console will not rebuild that push on its own.
- `amplify.yml` still builds the frontend inside the `RELEASE` job started by GitHub Actions.
- `aws amplify start-job --job-type RELEASE` continues to work. This workflow uses it only after auto-build reads back as disabled.
- Re-enabling automatic builds is a separate Amplify change. This workflow does not turn the setting back on.
- The `main` branch, if added later, keeps its own setting. This step never calls `update-branch` for it.

A webhook Amplify accepted before `get-branch` showed `enableAutoBuild: false` can still finish. The workflow waits for a build it can see. If that build becomes the latest successful deployment, the release step fails. A job that appears only after the workflow has exited is outside what that run can prove.

## Production deployment

A pull request into `main` runs `validate` only. After that pull request is merged, the push to `main` runs `validate` again. `deploy-production` stays skipped until `PRODUCTION_DEPLOYMENTS_ENABLED` is `true`. When it runs, it authenticates with the existing repository secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, the same secrets `deploy-demo` uses.

Backend deployment starts only when all of these are true:

1. The commit was pushed to `main` and `validate` succeeded.
2. Repository variable `PRODUCTION_DEPLOYMENTS_ENABLED` is `true`.
3. The job is attached to the GitHub Environment named `production`, and that environment has a required-reviewer protection rule. The workflow reads the environment and stops if the rule is missing.
4. `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set. Production has no separate credential check.

Those steps are not a substitute for configuring the environment. Create the environment and its reviewers before setting the variable. A missing environment does not approve a deployment: the reviewer check fails before AWS credentials are configured.

Demo and production use those credentials and retain separate deployment targets, templates, stacks, and CloudFormation execution-role configuration. Demo builds `template.demo.yaml`, deploys stack `occasionfun-co-uk-contact`, and passes execution role `arn:aws:iam::796174527529:role/occasionfun-cloudformation-demo`. Production builds `template.production.yaml`, deploys stack `occasionfun-co-uk-prod-contact`, and passes execution role `arn:aws:iam::796174527529:role/occasionfun-cloudformation-production`. A production run that supplies the demo role, or any other role, stops before AWS is called. The production role must already exist. This repository does not create it. Its trust policy allows only `cloudformation.amazonaws.com` to assume it. `occasionfun-github-deploy` may pass only that role to CloudFormation, and the production `CreateChangeSet` call must name it.

The production stack is `occasionfun-co-uk-prod-contact`. Its parameters are `Environment=prod`, the same SMTP secret ARN, and only:

- `https://occasionfun.co.uk`
- `https://www.occasionfun.co.uk`

The production names are `occasionfun-co-uk-prod-contact`, `occasionfun-co-uk-prod-contact-retry`, and `occasionfun-co-uk-prod-leads`, with a new API Gateway and table. `template.yaml` keeps the existing demo names as literals, including `occasionfun-co-uk-contact-retry`. The validate job renders `template.demo.yaml` and `template.production.yaml` and uploads those files. The demo job downloads `template.demo.yaml` and does not render again. The production job downloads `template.production.yaml` and does not render again. Neither template uses a condition for a table name, log group name, or Lambda function name, and neither sets `SourceAccount`. The demo retry rule does not set `Name`, because the existing demo rule already has a generated name. Production rendering sets `Name` to `occasionfun-co-uk-prod-contact-retry`. CloudFormation otherwise shortens the generated rule name below `occasionfun-co-uk-prod-contact-`, which the production execution role is not allowed to describe.

The demo application stack no longer declares `ContactRetryFunctionRetrySchedulePermission`. That statement remains in the separate stack `occasionfun-co-uk-contact-retry-permission`, described by `infra/contact-api/demo-retry-permission.yaml`. CI validates that file and does not import or deploy it. Production rendering adds a permission for the new production rule and function. The change-set guard is the same as demo. Afterward the endpoint must be a different `eu-west-2` API, not `0e6zpkvbkj`.

`describe-stacks` creates the production stack only when CloudFormation returns the ValidationError line `Stack with id occasionfun-co-uk-prod-contact does not exist` and the production workflow has already passed its environment and variable checks. Access denied, invalid credentials, network errors, throttling, and any other describe error stop the job. An existing stack is updated and is never deleted or recreated. Demo still refuses to create a missing stack.

### Production frontend

The GitHub production job does not publish the site. Amplify app `d2oib89bmco9su` builds the connected branch from `amplify.yml`. The `main` branch exists and auto-build is enabled. The `demo` branch remains the demo frontend.

`amplify.yml` installs Node.js 24 before `npm ci`. The frontend does not read Amplify SSM parameters, so the build does not need those secrets.

`scripts/amplify-public-env.mjs` chooses the public contact URL:

- `demo` uses `https://0e6zpkvbkj.execute-api.eu-west-2.amazonaws.com/contact` when its variable is empty, and fails if a `NEXT_PUBLIC_` value contains the production API id `k20xd6a2pd`.
- `main` and `master` use `https://k20xd6a2pd.execute-api.eu-west-2.amazonaws.com/contact` when their variable is empty. Any other contact URL fails the build. A value containing the demo API id `0e6zpkvbkj` fails the build. The site URL defaults to `https://occasionfun.co.uk`.
- The generated file contains only `NEXT_PUBLIC_` values. AWS credentials and the SMTP secret are not written into it.

Amplify branch variables override an app-level variable with the same name. The app-level map is empty, so it cannot inject the demo API. The `main` branch variable is `https://k20xd6a2pd.execute-api.eu-west-2.amazonaws.com/contact`. The `demo` branch variable is `https://0e6zpkvbkj.execute-api.eu-west-2.amazonaws.com/contact`. Custom domains are not changed by this build.

## GitHub configuration

Repository secrets, already expected:

| Secret | Use |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | Existing key for IAM user `occasionfun-github-deploy`. Used by `deploy-demo` and `deploy-production`. |
| `AWS_SECRET_ACCESS_KEY` | Matching secret key. Used by both jobs. |

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
| AWS credentials | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | The same secrets |
| Template | `template.demo.yaml` | `template.production.yaml` |
| Stack | `occasionfun-co-uk-contact` | `occasionfun-co-uk-prod-contact` |
| CloudFormation role | `occasionfun-cloudformation-demo` | `occasionfun-cloudformation-production` |
| API | `0e6zpkvbkj` | A new API created by the production stack |
| Contact Lambda | `occasionfun-co-uk-contact` | `occasionfun-co-uk-prod-contact` |
| Retry Lambda | `occasionfun-co-uk-contact-retry` | `occasionfun-co-uk-prod-contact-retry` |
| DynamoDB | `occasionfun-co-uk-leads` | `occasionfun-co-uk-prod-leads` |
| SMTP secret | `occasionfun-co-uk/contact/smtp` | The same secret |
| Subject prefix | `[DEMO]` | `[PROD]` |
| Website | `https://demo.d2oib89bmco9su.amplifyapp.com` | `https://occasionfun.co.uk` after DNS is approved |

## Smoke tests

`smoke-test` runs after a successful `deploy-demo` job. It does not receive AWS credentials. A failed check fails that job after the deployment job has already finished. Production does not run this demo check.

The checks are a GET of the demo site, an OPTIONS preflight from the demo origin, and a POST of `{}`. They expect a client error for the POST. They do not submit a valid enquiry and they do not send email. A response or page that contains an access key, the SMTP secret id, or a private key fails the job. The check prints status codes only.

Locally, the same script calls the live demo site:

```bash
node scripts/smoke-demo.mjs
```

The safety rules themselves are covered by `npm test` without calling AWS.

## Inspecting a failed deployment

1. Open the failed Actions run of `CI/CD`. Validation failures stay in `validate`. Demo deployment failures stay in `deploy-demo`. Production stays skipped until it is separately authorized.
2. If the log says the change set was not executed, CloudFormation did not apply it. The resource lines name the logical id, action, and replacement flag. Fix the template or parameters before running the job again. Do not execute that change set from the console.
3. A missing AWS secret fails before `aws` is called.
4. An account or region mismatch fails before the change set is created.
5. A demo endpoint other than `https://0e6zpkvbkj.execute-api.eu-west-2.amazonaws.com/contact` fails the job after the stack operation.
6. Amplify failures leave the API update in place and fail the workflow. If the log says auto-build is disabled and no release was started, re-run after the older build finishes. If another commit is the latest deployment, the release was not accepted. The Amplify console for app `d2oib89bmco9su`, branch `demo`, shows the build log. These workflow logs do not download Amplify log streams.
7. A `main` push with production still blocked skips `deploy-production` and does not call AWS. A production run that stops on the reviewer check has not configured AWS credentials. After that check, production uses `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

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

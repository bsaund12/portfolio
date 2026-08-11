# Terraform

See the [root README](../README.md) for the site itself, and
[backend/README.md](../backend/README.md) for the Lambda application and its
tests. This directory is the infrastructure-as-code for the whole project — both
the backend's AWS resources and the CI/CD identity used by both GitHub Actions
workflows.

## Resources, by file

### Backend infrastructure

- **`dynamodb.tf`** — `aws_dynamodb_table.visitors`: on-demand table, partition
  key `id` (String), `prevent_destroy` set so `terraform destroy` can't wipe the
  counter. `aws_dynamodb_table_item.visitors_seed`: seeds the counter item;
  `ignore_changes = [item]` since the Lambda mutates `count` directly outside
  Terraform.
- **`iam.tf`** — `aws_iam_role.lambda_exec`: the Lambda's execution role,
  assumable only by `lambda.amazonaws.com`. `aws_iam_role_policy.lambda_dynamodb`:
  inline policy granting only `dynamodb:UpdateItem`, scoped to the table's ARN.
  `aws_iam_role_policy_attachment.lambda_basic_execution`: attaches the AWS-managed
  `AWSLambdaBasicExecutionRole` for CloudWatch Logs access.
- **`lambda.tf`** — `data.archive_file.lambda_zip`: zips
  `backend/lambda_function.py`. `aws_lambda_function.visitor_counter`: the
  function itself, `TABLE_NAME` env var set from `var.table_name`.
  `aws_cloudwatch_log_group.lambda_logs`: log group `/aws/lambda/<function-name>`,
  14-day retention.
- **`apigateway.tf`** — `aws_apigatewayv2_api.visitor_api`: HTTP API with CORS
  configured for `var.allowed_origins`. `aws_apigatewayv2_integration` /
  `aws_apigatewayv2_route` (`GET /count`) / `aws_apigatewayv2_stage.default`
  (`$default`, auto-deploy): wire the route to the Lambda.
  `aws_lambda_permission.api_gateway_invoke`: lets this specific API/stage/route
  invoke the function.

### CI/CD identity

- **`github_oidc.tf`** — `aws_iam_openid_connect_provider.github_actions`: trusts
  GitHub's OIDC token issuer, so Actions runs can authenticate without stored AWS
  keys. `aws_iam_role.github_backend` / `aws_iam_role_policy.github_backend_deploy`:
  role the Backend workflow assumes, scoped to `lambda:UpdateFunctionCode` and
  `lambda:GetFunctionConfiguration` on the visitor-counter function only.
  `aws_iam_role.github_frontend` / `aws_iam_role_policy.github_frontend_deploy`:
  role the Frontend workflow assumes, scoped to `s3:PutObject`/`DeleteObject` on
  the site bucket's objects, `s3:ListBucket` on the bucket, and
  `cloudfront:CreateInvalidation`/`GetInvalidation` on the site's distribution.

## Variables (`terraform.tfvars.example`)

| Variable | Purpose |
|---|---|
| `aws_region` | AWS region all resources are deployed into. |
| `project_name` | Prefix used when naming the Lambda, IAM role, and API. |
| `table_name` | DynamoDB table name; also becomes the Lambda's `TABLE_NAME` env var. |
| `lambda_runtime` | Lambda Python runtime identifier. |
| `lambda_architecture` | Lambda instruction set architecture (`arm64` or `x86_64`). |
| `allowed_origins` | Origins allowed via CORS on the API Gateway API. |
| `bucket_name` | Name of the S3 bucket serving the static frontend (provisioned manually, not by Terraform). |
| `cloudfront_distribution_id` | ID of the CloudFront distribution in front of that bucket (provisioned manually, not by Terraform). |

## Usage

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # fill in real values; gitignored
AWS_PROFILE=terraform-admin terraform init
AWS_PROFILE=terraform-admin terraform plan
AWS_PROFILE=terraform-admin terraform apply
```

## What CI touches vs. what stays manual

- **Infrastructure changes** (new/changed resources, permissions, variables) —
  manual only. Run `terraform apply` from a laptop with the `terraform-admin` AWS
  profile. Nothing in either GitHub Actions workflow ever invokes `terraform`.
- **Lambda code changes** — automatic, via the Backend workflow, which calls
  `aws lambda update-function-code` directly, not `terraform apply`. Note that
  `terraform apply` would *also* redeploy the Lambda's code, since
  `source_code_hash` tracks the zipped source — but that is not the intended
  path. Running `terraform apply` from a stale local checkout after CI has
  already shipped a newer version would silently overwrite what CI deployed.
- **Site content changes** — automatic, via the Frontend workflow.
- The two CI roles cannot be assumed by a human. Their trust policy only accepts
  GitHub's OIDC token, scoped to this repo's `main` branch — no AWS access key or
  local `AssumeRole` call can use them; only a GitHub Actions run on that branch
  can.

## State

State is **local only** — there is no remote backend and no locking configured.
That means:

- **Single-operator model.** Only whoever has `terraform.tfstate` on their
  machine can safely run `terraform apply`. Two people (or a person and CI)
  applying concurrently without a shared, locking backend could corrupt state or
  race each other.
- **Losing `terraform.tfstate` means losing Terraform's record of which real AWS
  resources these `.tf` files map to.** Terraform would no longer know the
  DynamoDB table, Lambda, IAM roles, etc. already exist, and either try to
  recreate them (colliding with the live resources) or require re-importing
  everything by hand.

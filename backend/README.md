# Backend

See the [root README](../README.md) for the site itself and local development.

## Architecture

**Frontend:** S3 (static hosting) → CloudFront (CDN/HTTPS) → Route 53 (DNS) → ACM
(TLS certificate). Provisioned by hand in the AWS Console; not managed by Terraform.

**Backend (visitor counter):** API Gateway HTTP API → Lambda → DynamoDB. Fully
managed by Terraform in [`terraform/`](../terraform).

```
browser → CloudFront/S3 (static site)
        → GET /count → API Gateway → Lambda → DynamoDB.UpdateItem
```

The Lambda ([`lambda_function.py`](lambda_function.py)) atomically increments a
single DynamoDB item (`id = "visitors"`) via an `ADD` update expression and
returns the new count as JSON.

## Backend resources (Terraform)

- **DynamoDB** — on-demand table, partition key `id` (String). `prevent_destroy`
  is set so `terraform destroy` can't wipe the counter. The seed item's `count`
  attribute uses `ignore_changes`, since the Lambda mutates it directly outside
  of Terraform.
- **Lambda** — Python 3.14, arm64, handler `lambda_function.lambda_handler`.
  Reads the table name from the `TABLE_NAME` environment variable, set from
  `var.table_name` — the table name is not hardcoded in the Python source.
- **IAM** — role `cloudresume-lambda-exec`, assumable only by
  `lambda.amazonaws.com`. Two policies:
  - an inline policy granting only `dynamodb:UpdateItem`, scoped to this
    table's ARN via a Terraform resource reference (not a hardcoded ARN)
  - the AWS-managed `AWSLambdaBasicExecutionRole`, for CloudWatch Logs access
- **CloudWatch Logs** — log group `/aws/lambda/<function-name>`, 14-day
  retention.
- **API Gateway** — HTTP API, route `GET /count`, `$default` stage with
  auto-deploy, `AWS_PROXY` Lambda integration (payload format `2.0`). CORS is
  configured on the API itself, not in the Lambda — don't return
  `Access-Control-Allow-Origin` from the handler, or the duplicate header will
  make the browser reject the response. The Lambda's resource policy scopes
  invoke access to this specific API/stage/method/route.

## Deploying the backend

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # fill in real values; gitignored
terraform init
terraform plan
terraform apply
```

## Deploying the frontend

The frontend isn't Terraform-managed. After changing a static asset:

```bash
aws s3 cp script.js s3://bjsaunders.com/script.js --content-type application/javascript
aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/script.js"
```

## Variables (`terraform.tfvars.example`)

| Variable | Purpose |
|---|---|
| `aws_region` | AWS region all resources are deployed into. |
| `project_name` | Prefix used when naming the Lambda, IAM role, and API. |
| `table_name` | DynamoDB table name; also becomes the Lambda's `TABLE_NAME` env var. |
| `lambda_runtime` | Lambda Python runtime identifier. |
| `lambda_architecture` | Lambda instruction set architecture (`arm64` or `x86_64`). |
| `allowed_origins` | Origins allowed via CORS on the API Gateway API. |

## Tests

`backend/tests/conftest.py` sets `TABLE_NAME` before collection, since
`lambda_function.py` reads it at import time.

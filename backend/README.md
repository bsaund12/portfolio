# Visitor Counter Lambda

## What it does

Atomically increments a visitor count each time the homepage is loaded and
returns the updated count.

## Runtime

- Python 3.14
- Architecture: arm64

## DynamoDB

- Table: `cloudresume-visitors`
- Partition key: `id`
- The function updates a single item with `id = "visitors"`.

## IAM

- Policy: `cloudresume-dynamodb-update`
- Grants `dynamodb:UpdateItem`, scoped to the ARN of the `cloudresume-visitors`
  table only.

## Deployment

Currently deployed by hand through the AWS Console. Terraform is planned to
replace this manual process.

## Region

All resources live in `us-east-1`.

## Invocation

- API: `cloudresume-api` (HTTP API in API Gateway)
- Route: `GET /count`
- Payload format version: `2.0`
- Stage: `$default` (auto-deploy enabled)
- Invoke URL: `https://01vqqbm7qi.execute-api.us-east-1.amazonaws.com/count`
- API Gateway is authorized to invoke this function via a resource-based policy
  on the Lambda, with `SourceArn` scoped to this API.

## CORS

CORS is configured **on the API Gateway**, not in this handler. Allowed origins:
`https://bjsaunders.com` and `https://www.bjsaunders.com`. Method: `GET`. Credentials: not allowed.

Do not return `Access-Control-Allow-Origin` from the Lambda — setting it in both
places produces duplicate headers and the browser rejects the response.
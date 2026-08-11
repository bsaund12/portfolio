# Backend

See the [root README](../README.md) for the site itself and local development, and
[terraform/README.md](../terraform/README.md) for infrastructure and CI/CD IAM.

## What it does

[`lambda_function.py`](lambda_function.py) handles `GET /count` behind API
Gateway. On each invocation it atomically increments a single DynamoDB item
(`id = "visitors"`) via an `ADD` update expression and returns the new count.

CORS is handled by API Gateway, not this handler — don't add
`Access-Control-Allow-Origin` here, or the duplicate header will make the browser
reject the response.

## `TABLE_NAME`

The DynamoDB table name is read from the `TABLE_NAME` environment variable at
import time — it is not hardcoded in the source. Terraform sets it from
`var.table_name` when deploying; tests set it in `conftest.py` before the module
is imported (see below).

## Response shape

```json
{ "count": 102 }
```

`statusCode: 200`, header `Content-Type: application/json`, body is a JSON string
containing a single integer `count` field.

## Tests

Tests use `pytest` with `moto` mocking DynamoDB, so they never touch real AWS.

- **`requirements-dev.txt`** — `pytest`, `moto`, `boto3`.
- **`pyproject.toml`** — `pythonpath = ["."]` so `import lambda_function` resolves
  without a `sys.path` hack or a relative import; `testpaths = ["tests"]` scopes
  collection to `tests/`.
- **`tests/conftest.py`** — sets bogus AWS credentials/region and `TABLE_NAME` by
  assignment (not `setdefault`) before anything else imports `boto3`, so a real
  value from the shell can't leak in. The `dynamodb_table` fixture starts moto's
  `mock_aws`, creates the table, and seeds it. The `lambda_function` fixture
  imports `lambda_function` *inside* the fixture body, after the mock is active —
  the module builds its DynamoDB `Table` resource at import time, so importing it
  before the mock starts would bind it to real AWS instead.
- **`tests/test_lambda_function.py`** — `test_returns_200`,
  `test_body_has_integer_count`, `test_count_increments_between_calls`.

Run locally:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest -v
```

This is exactly what the Backend GitHub Actions workflow runs on every push and
pull request touching `backend/**`.

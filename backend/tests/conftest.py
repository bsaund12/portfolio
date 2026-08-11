import os

# Set these at module scope, before boto3/lambda_function are imported anywhere
# in the test session. boto3 resolves credentials and region as soon as a
# client/resource is constructed, so a real value from the shell environment
# (e.g. a developer's own AWS_PROFILE credentials) must never be visible here -
# use assignment, not setdefault, so nothing real can leak through.
os.environ["AWS_ACCESS_KEY_ID"] = "testing"
os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
os.environ["AWS_SESSION_TOKEN"] = "testing"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
os.environ["TABLE_NAME"] = "cloudresume-visitors-test"

import boto3
import pytest
from moto import mock_aws


@pytest.fixture
def dynamodb_table():
    with mock_aws():
        table = boto3.resource("dynamodb").create_table(
            TableName=os.environ["TABLE_NAME"],
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        table.put_item(Item={"id": "visitors", "count": 0})
        yield table


@pytest.fixture
def lambda_function(dynamodb_table):
    # Imported here, inside the fixture, rather than at module top: the mock_aws
    # context started by dynamodb_table must already be active before
    # lambda_function is imported, because lambda_function creates its boto3
    # DynamoDB Table resource at *module import time* (not inside the handler).
    # Importing at module top would bind that resource to real AWS (or fail
    # outright) before the mock ever starts.
    import lambda_function

    yield lambda_function

import json


def test_returns_200(lambda_function):
    """The handler should respond with HTTP 200 on a normal invocation."""
    response = lambda_function.lambda_handler({}, None)

    assert response["statusCode"] == 200


def test_body_has_integer_count(lambda_function):
    """The response body should be JSON containing an integer "count" field."""
    response = lambda_function.lambda_handler({}, None)
    body = json.loads(response["body"])

    assert "count" in body
    assert isinstance(body["count"], int)


def test_count_increments_between_calls(lambda_function):
    """Each invocation should atomically increment the counter by one."""
    first_response = lambda_function.lambda_handler({}, None)
    first_count = json.loads(first_response["body"])["count"]

    second_response = lambda_function.lambda_handler({}, None)
    second_count = json.loads(second_response["body"])["count"]

    assert second_count == first_count + 1

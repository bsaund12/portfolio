resource "aws_apigatewayv2_api" "visitor_api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = var.allowed_origins
    allow_methods     = ["GET"]
    allow_credentials = false
  }
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id = aws_apigatewayv2_api.visitor_api.id

  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.visitor_counter.invoke_arn

  # AWS_PROXY integrations always invoke the Lambda via POST, regardless of
  # the HTTP method the route itself is exposed under.
  integration_method = "POST"

  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "visitor_route" {
  api_id = aws_apigatewayv2_api.visitor_api.id

  route_key = "GET /count"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.visitor_api.id

  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.visitor_counter.function_name
  principal     = "apigateway.amazonaws.com"

  # Scoped to this API's $default stage, GET method, and /count route
  # specifically - as tight as an HTTP API's execution ARN allows.
  source_arn = "${aws_apigatewayv2_api.visitor_api.execution_arn}/${aws_apigatewayv2_stage.default.name}/GET/count"
}

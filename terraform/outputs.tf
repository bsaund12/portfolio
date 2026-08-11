output "api_invoke_url" {
  description = "Invoke URL of the API Gateway stage, used by the front end to call the visitor counter."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "table_name" {
  description = "Name of the DynamoDB table storing the visitor count."
  value       = aws_dynamodb_table.visitors.name
}

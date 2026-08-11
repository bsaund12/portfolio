output "api_invoke_url" {
  description = "Invoke URL of the API Gateway stage, used by the front end to call the visitor counter."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "table_name" {
  description = "Name of the DynamoDB table storing the visitor count."
  value       = aws_dynamodb_table.visitors.name
}

output "github_backend_role_arn" {
  description = "ARN of the IAM role GitHub Actions assumes to deploy the backend (Lambda)."
  value       = aws_iam_role.github_backend.arn
}

output "github_frontend_role_arn" {
  description = "ARN of the IAM role GitHub Actions assumes to deploy the frontend (S3 + CloudFront)."
  value       = aws_iam_role.github_frontend.arn
}

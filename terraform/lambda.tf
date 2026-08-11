data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../backend/lambda_function.py"
  output_path = "${path.module}/build/lambda_function.zip"
}

resource "aws_lambda_function" "visitor_counter" {
  function_name = "${var.project_name}-visitor-counter"
  role          = aws_iam_role.lambda_exec.arn
  filename      = data.archive_file.lambda_zip.output_path

  runtime       = var.lambda_runtime
  architectures = [var.lambda_architecture]
  handler       = "lambda_function.lambda_handler"

  environment {
    variables = {
      TABLE_NAME = var.table_name
    }
  }

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}

resource "aws_cloudwatch_log_group" "lambda_logs" {
  # Lambda automatically writes to a log group named /aws/lambda/<function
  # name>; creating it explicitly lets Terraform manage its retention
  # instead of AWS defaulting to "never expire".
  name = "/aws/lambda/${aws_lambda_function.visitor_counter.function_name}"

  retention_in_days = 14
}

variable "aws_region" {
  type        = string
  description = "AWS region to deploy the Cloud Resume Challenge backend into."
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Short name used to prefix and tag the resources created for this project."
}

variable "table_name" {
  type        = string
  description = "Name of the DynamoDB table that stores the visitor counter item."
}

variable "lambda_runtime" {
  type        = string
  description = "Identifier of the Lambda runtime to run backend/lambda_function.py on (e.g. a Python version string)."
}

variable "lambda_architecture" {
  type        = string
  description = "Instruction set architecture for the Lambda function (e.g. x86_64 or arm64)."
}

variable "allowed_origins" {
  type        = list(string)
  description = "List of origins allowed to call the API via CORS (e.g. the site's domain(s))."
}

variable "bucket_name" {
  type        = string
  description = "Name of the S3 bucket serving the static frontend (provisioned manually, not by Terraform)."
}

variable "cloudfront_distribution_id" {
  type        = string
  description = "ID of the CloudFront distribution in front of the frontend bucket (provisioned manually, not by Terraform)."
}

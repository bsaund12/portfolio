data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "github_backend" {
  name = "cloudresume-github-backend"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRoleWithWebIdentity"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Security boundary: this is what stops any other GitHub repo (or
            # any branch/PR in this one) from assuming this role. Without it,
            # the trust policy would only check that the token came from
            # GitHub's OIDC issuer for AWS STS - not which repo or branch.
            "token.actions.githubusercontent.com:sub" = "repo:bsaund12/portfolio:ref:refs/heads/main"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role" "github_frontend" {
  name = "cloudresume-github-frontend"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRoleWithWebIdentity"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Same security boundary as the backend role's trust policy: locks
            # this role to Actions runs on bsaund12/portfolio's main branch only.
            "token.actions.githubusercontent.com:sub" = "repo:bsaund12/portfolio:ref:refs/heads/main"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "github_backend_deploy" {
  name = "cloudresume-github-backend-deploy"
  role = aws_iam_role.github_backend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:UpdateFunctionCode"
        Resource = aws_lambda_function.visitor_counter.arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "github_frontend_deploy" {
  name = "cloudresume-github-frontend-deploy"
  role = aws_iam_role.github_frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = "arn:aws:s3:::${var.bucket_name}/*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = "arn:aws:s3:::${var.bucket_name}"
      },
      {
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
        Resource = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${var.cloudfront_distribution_id}"
      }
    ]
  })
}

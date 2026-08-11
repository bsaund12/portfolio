resource "aws_dynamodb_table" "visitors" {
  name = var.table_name

  billing_mode = "PAY_PER_REQUEST"

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  lifecycle {
    prevent_destroy = true
    # Protects the visitor counter table from being destroyed by an
    # accidental `terraform destroy` or a plan that would replace the
    # resource, which would permanently wipe the visitor count.
  }
}

resource "aws_dynamodb_table_item" "visitors_seed" {
  table_name = aws_dynamodb_table.visitors.name
  hash_key   = aws_dynamodb_table.visitors.hash_key

  item = jsonencode({
    id    = { S = "visitors" }
    count = { N = "101" }
  })

  lifecycle {
    ignore_changes = [item]
    # The Lambda mutates this item's count via UpdateItem on every
    # invocation. Without ignore_changes, Terraform would see the live
    # value drift from this seed value and try to reset the counter back
    # to the seed on every apply.
  }
}

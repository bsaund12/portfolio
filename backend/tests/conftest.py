import os

# lambda_function.py reads TABLE_NAME at import time (module-level
# dynamodb.Table() call), so it must be set before pytest collects/imports
# any test that pulls in that module.
os.environ.setdefault("TABLE_NAME", "cloudresume-visitors-test")

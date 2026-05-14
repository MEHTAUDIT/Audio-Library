#!/bin/bash
# Setup GitLab OIDC Provider and Deployment Roles in AWS
#
# Prerequisites:
# - AWS CLI configured with admin credentials
# - jq installed
#
# Usage:
#   ./setup-gitlab-oidc.sh <AWS_ACCOUNT_ID> <GITLAB_NAMESPACE>
#
# Example:
#   ./setup-gitlab-oidc.sh 123456789012 mycompany/audio-library

set -e

AWS_ACCOUNT_ID="${1:?Error: AWS_ACCOUNT_ID required as first argument}"
GITLAB_NAMESPACE="${2:?Error: GITLAB_NAMESPACE required (e.g., mycompany/audio-library)}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "=============================================="
echo "GitLab OIDC Setup for AWS"
echo "=============================================="
echo "AWS Account: $AWS_ACCOUNT_ID"
echo "GitLab Namespace: $GITLAB_NAMESPACE"
echo "AWS Region: $AWS_REGION"
echo ""

# Step 1: Create OIDC Provider (if not exists)
echo "Step 1: Creating OIDC Provider..."
OIDC_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/gitlab.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" 2>/dev/null; then
  echo "  OIDC Provider already exists: $OIDC_ARN"
else
  echo "  Creating new OIDC Provider..."
  
  # Get GitLab's OIDC thumbprint
  THUMBPRINT=$(echo | openssl s_client -servername gitlab.com -connect gitlab.com:443 2>/dev/null | \
    openssl x509 -fingerprint -sha1 -noout | \
    sed 's/://g' | \
    sed 's/SHA1 Fingerprint=//' | \
    tr '[:upper:]' '[:lower:]')
  
  aws iam create-open-id-connect-provider \
    --url "https://gitlab.com" \
    --client-id-list "https://gitlab.com" \
    --thumbprint-list "$THUMBPRINT"
  
  echo "  Created OIDC Provider: $OIDC_ARN"
fi

# Step 2: Create the deployment policy
echo ""
echo "Step 2: Creating/Updating deployment policy..."
POLICY_NAME="AudioLibraryCDKDeployment"
POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${POLICY_NAME}"

# Check if policy exists
if aws iam get-policy --policy-arn "$POLICY_ARN" 2>/dev/null; then
  echo "  Policy exists, creating new version..."
  
  # Delete oldest version if we have 5 versions (AWS limit)
  VERSIONS=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text)
  VERSION_COUNT=$(echo "$VERSIONS" | wc -w)
  
  if [ "$VERSION_COUNT" -ge 4 ]; then
    OLDEST=$(echo "$VERSIONS" | awk '{print $NF}')
    aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$OLDEST"
  fi
  
  aws iam create-policy-version \
    --policy-arn "$POLICY_ARN" \
    --policy-document file://iam-deployment-policy.json \
    --set-as-default
else
  echo "  Creating new policy..."
  aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document file://iam-deployment-policy.json
fi

echo "  Policy ARN: $POLICY_ARN"

# Step 3: Create roles for each environment
echo ""
echo "Step 3: Creating deployment roles..."

create_role() {
  local ENV_NAME=$1
  local ROLE_NAME="AudioLibGitLabDeploy${ENV_NAME}"
  local BRANCH_PATTERN=$2
  
  echo ""
  echo "  Creating role: $ROLE_NAME"
  
  # Create trust policy
  cat > /tmp/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/gitlab.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "gitlab.com:aud": "https://gitlab.com"
        },
        "StringLike": {
          "gitlab.com:sub": "project_path:${GITLAB_NAMESPACE}:ref_type:branch:ref:${BRANCH_PATTERN}"
        }
      }
    }
  ]
}
EOF

  # Create or update role
  if aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null; then
    echo "    Role exists, updating trust policy..."
    aws iam update-assume-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-document file:///tmp/trust-policy.json
  else
    echo "    Creating new role..."
    aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document file:///tmp/trust-policy.json \
      --description "GitLab OIDC role for Audio Library ${ENV_NAME} deployments"
  fi
  
  # Attach the deployment policy
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "$POLICY_ARN" 2>/dev/null || true
  
  echo "    Role ARN: arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"
}

# Create roles for each environment
create_role "Dev" "*"                    # Dev can deploy from any branch
create_role "Staging" "main"             # Staging only from main
create_role "Prod" "main"                # Prod only from main

# Cleanup
rm -f /tmp/trust-policy.json

echo ""
echo "=============================================="
echo "Setup Complete!"
echo "=============================================="
echo ""
echo "Created roles:"
echo "  - AudioLibGitLabDeployDev (any branch)"
echo "  - AudioLibGitLabDeployStaging (main branch only)"
echo "  - AudioLibGitLabDeployProd (main branch only)"
echo ""
echo "Next steps:"
echo "1. Add this variable to GitLab CI/CD Settings:"
echo "   AWS_ACCOUNT_ID = $AWS_ACCOUNT_ID"
echo ""
echo "2. Your .gitlab-ci.yml is already configured to use OIDC!"
echo ""
echo "3. Test by running a pipeline on main branch"
echo ""


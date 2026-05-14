# Audio Library Infrastructure

AWS CDK infrastructure for the Audio Library application.

## GitLab CI/CD with OIDC (Recommended)

This project uses **OIDC authentication** for GitLab CI/CD - no stored AWS credentials needed!

### Quick Setup

```bash
cd infra

# Run the setup script (requires AWS CLI with admin access)
chmod +x scripts/setup-gitlab-oidc.sh
./scripts/setup-gitlab-oidc.sh YOUR_AWS_ACCOUNT_ID your-gitlab-namespace/audio-library-project
```

### Manual Setup

1. **Create OIDC Provider in AWS IAM**:
   - Provider URL: `https://gitlab.com`
   - Audience: `https://gitlab.com`

2. **Create IAM Roles** with trust policy for GitLab:
   - `AudioLibGitLabDeployDev`
   - `AudioLibGitLabDeployStaging`  
   - `AudioLibGitLabDeployProd`

3. **Add GitLab CI/CD Variable**:
   - `AWS_ACCOUNT_ID` = Your AWS account ID

See `scripts/setup-gitlab-oidc.sh` for the complete setup.

---

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
   ```bash
   aws configure
   ```

2. **Node.js** 18+ installed

3. **AWS CDK CLI** (installed via npm)
   ```bash
   npm install -g aws-cdk
   ```

## Setup

```bash
cd infra
npm install
```

## First-Time Bootstrap

Before deploying for the first time, you need to bootstrap CDK in your AWS account:

```bash
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
```

## Deployment

### Development Environment

```bash
npm run deploy:dev
```

Or with more control:

```bash
npx cdk deploy AudioLibrary-Dev --require-approval never
```

### Production Environment

```bash
npm run deploy:prod
```

This will prompt for approval before making changes.

## After Deployment

After deploying, CDK will output the configuration you need for your backend:

```
Outputs:
AudioLibrary-Dev.BucketName = audio-library-development-123456789
AudioLibrary-Dev.Region = us-east-1
AudioLibrary-Dev.AccessKeyId = AKIAIOSFODNN7EXAMPLE
AudioLibrary-Dev.SecretAccessKey = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### Configure Your Backend

**Option 1: Environment Variables (recommended for dev)**

```bash
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
export AWS_REGION=us-east-1
export AWS_S3_BUCKET=audio-library-development-123456789
```

Then update `application.yml`:

```yaml
app:
  s3:
    enabled: true
    bucket: ${AWS_S3_BUCKET}
    region: ${AWS_REGION}
```

**Option 2: application-local.yml (for local dev only)**

```yaml
app:
  s3:
    enabled: true
    bucket: audio-library-development-123456789
    region: us-east-1
    access-key: AKIAIOSFODNN7EXAMPLE
    secret-key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

⚠️ **Never commit credentials to git!**

**Option 3: AWS Secrets Manager (production)**

For production, credentials are stored in Secrets Manager. Configure your app to read from there, or use IAM roles if running on AWS (EC2, ECS, Lambda).

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run synth` | Synthesize CloudFormation templates |
| `npm run diff` | Show pending changes |
| `npm run deploy:dev` | Deploy development stack |
| `npm run deploy:prod` | Deploy production stack |
| `npm run destroy:dev` | Delete development stack |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     S3 Bucket                                │
│  audio-library-{environment}-{account-id}                   │
│                                                              │
│  ├── staging/           ← Temporary uploads                 │
│  │   └── {tenant-id}/      (auto-deleted after 7 days)     │
│  │                                                          │
│  └── audio/             ← Permanent storage                 │
│      └── {tenant-id}/      (transitions to Glacier in 1yr) │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Features:                                                   │
│  ✓ Versioning enabled (recover deleted files)               │
│  ✓ Encryption at rest (S3-managed keys)                     │
│  ✓ SSL enforced                                              │
│  ✓ Public access blocked                                     │
│  ✓ CORS configured for browser uploads                      │
│  ✓ Lifecycle policies for cost optimization                 │
└─────────────────────────────────────────────────────────────┘
```

## Cost Optimization

The stack includes lifecycle policies to minimize storage costs:

1. **Staging cleanup**: Abandoned uploads deleted after 7 days
2. **Version cleanup**: Old versions deleted after 30 days
3. **Intelligent tiering**: Files move to cheaper storage after 90 days
4. **Glacier archival**: Rarely accessed files archived after 1 year

Estimated costs for 1TB of audio:
- First 90 days: ~$23/month (S3 Standard)
- After 90 days: ~$12/month (Intelligent Tiering)
- After 1 year: ~$4/month (Glacier)

## Customization

Edit `src/app.ts` to customize:

- Allowed CORS origins for your domains
- Retention periods
- Region
- Bucket naming

## Troubleshooting

### "Bucket already exists"

S3 bucket names are globally unique. Either:
- Delete the existing bucket
- Provide a custom `bucketName` in the stack props

### "Access Denied" when uploading

1. Check CORS origins match your frontend URL exactly
2. Verify the access key/secret are correct
3. Check the IAM policy allows the operation

### Bootstrap errors

If you see "This stack uses assets", run:

```bash
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/YOUR_REGION
```


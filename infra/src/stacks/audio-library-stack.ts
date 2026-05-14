import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface AudioLibraryStackProps extends cdk.StackProps {
  /**
   * Environment name (development, staging, production)
   */
  environment: string;

  /**
   * Allowed origins for CORS (frontend URLs)
   */
  allowedOrigins: string[];

  /**
   * Optional: Custom bucket name. If not provided, will be auto-generated.
   */
  bucketName?: string;

  /**
   * Days to keep abandoned staging files before deletion
   * @default 7
   */
  stagingRetentionDays?: number;

  /**
   * Days before moving audio files to Glacier storage
   * @default 365
   */
  glacierTransitionDays?: number;
}

export class AudioLibraryStack extends cdk.Stack {
  /**
   * The S3 bucket for audio storage
   */
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: AudioLibraryStackProps) {
    super(scope, id, props);

    const {
      environment,
      allowedOrigins,
      bucketName,
      stagingRetentionDays = 7,
      glacierTransitionDays = 365,
    } = props;

    const isProd = environment === 'production';

    // ==================== S3 BUCKET ====================

    this.bucket = new s3.Bucket(this, 'AudioStorage', {
      bucketName: bucketName || `audio-library-${environment}-${this.account}`,
      
      // Versioning - recover accidentally deleted files
      versioned: true,
      
      // Encryption at rest
      encryption: s3.BucketEncryption.S3_MANAGED,
      
      // Block all public access
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      
      // Enforce SSL
      enforceSSL: true,

      // CORS configuration for direct browser uploads
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: allowedOrigins,
          exposedHeaders: ['ETag', 'Content-Length', 'Content-Type'],
          maxAge: 3600,
        },
      ],

      // Lifecycle rules for cost optimization
      lifecycleRules: [
        {
          // Delete abandoned staging files
          id: 'cleanup-staging',
          prefix: 'staging/',
          expiration: cdk.Duration.days(stagingRetentionDays),
          enabled: true,
        },
        {
          // Delete non-current versions after 30 days
          id: 'cleanup-old-versions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
          enabled: true,
        },
        {
          // Move old audio to Glacier for cost savings
          id: 'archive-old-audio',
          prefix: 'audio/',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(glacierTransitionDays),
            },
          ],
          enabled: isProd, // Only enable in production
        },
      ],

      // Removal policy
      removalPolicy: isProd 
        ? cdk.RemovalPolicy.RETAIN  // Keep bucket in prod even if stack deleted
        : cdk.RemovalPolicy.DESTROY, // Allow deletion in dev
      autoDeleteObjects: !isProd, // Auto-delete contents in dev
    });

    // ==================== SSM PARAMETERS ====================
    // Store non-sensitive config in Parameter Store.
    // Note: S3 access is granted via ECS task role (see backend-stack.ts),
    // not via static IAM credentials. This follows AWS SOP best practices.
    new ssm.StringParameter(this, 'BucketNameParam', {
      parameterName: `/audio-library/${environment}/s3/bucket-name`,
      stringValue: this.bucket.bucketName,
      description: 'S3 bucket name for audio storage',
    });

    new ssm.StringParameter(this, 'RegionParam', {
      parameterName: `/audio-library/${environment}/s3/region`,
      stringValue: this.region,
      description: 'AWS region for S3 bucket',
    });

    // ==================== OUTPUTS ====================

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket name',
      exportName: `${id}-BucketName`,
    });

    new cdk.CfnOutput(this, 'BucketArn', {
      value: this.bucket.bucketArn,
      description: 'S3 bucket ARN',
      exportName: `${id}-BucketArn`,
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS region',
      exportName: `${id}-Region`,
    });
  }
}


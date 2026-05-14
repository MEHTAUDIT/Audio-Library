import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * =============================================================================
 * FRONTEND STACK
 * =============================================================================
 * 
 * Creates the frontend hosting infrastructure using S3 and CloudFront.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                               Internet                                  │
 * │                                   │                                     │
 * │                                   ▼                                     │
 * │  ┌─────────────────────────────────────────────────────────────────┐   │
 * │  │                 CloudFront Distribution                         │   │
 * │  │  • Global CDN with edge locations                               │   │
 * │  │  • HTTPS/SSL termination                                        │   │
 * │  │  • Caching & compression                                        │   │
 * │  │  • DDoS protection (AWS Shield Standard)                        │   │
 * │  └─────────────────────────────────────────────────────────────────┘   │
 * │                          │                 │                            │
 * │           ┌──────────────┘                 └──────────────┐             │
 * │           ▼                                               ▼             │
 * │  ┌─────────────────────────┐           ┌─────────────────────────┐     │
 * │  │    S3 Bucket (Origin)   │           │   Backend API (ALB)     │     │
 * │  │  • Static files (HTML,  │           │   • /api/* routes       │     │
 * │  │    CSS, JS, images)     │           │                         │     │
 * │  │  • Private (OAC only)   │           │                         │     │
 * │  └─────────────────────────┘           └─────────────────────────┘     │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * Features:
 * - S3 bucket for static file hosting (private, CloudFront-only access)
 * - CloudFront CDN for global, low-latency delivery
 * - Origin Access Control (OAC) for secure S3 access
 * - API proxy to backend via CloudFront (same domain, no CORS issues)
 * - Custom error pages for SPA routing
 * - Gzip/Brotli compression
 * - Cache optimization with different TTLs for different file types
 */

export interface FrontendStackProps extends cdk.StackProps {
  /**
   * Environment name (development, staging, production)
   */
  environment: string;

  /**
   * Backend API URL (ALB DNS name or custom domain)
   * Used to proxy /api/* requests to the backend
   */
  backendApiUrl: string;

  /**
   * ACM certificate ARN for HTTPS (must be in us-east-1 for CloudFront)
   * @default undefined (uses CloudFront default certificate)
   */
  certificateArn?: string;

  /**
   * Custom domain names for CloudFront
   * @default undefined
   */
  domainNames?: string[];

  /**
   * Path to the frontend build directory for deployment
   * @default undefined (no deployment)
   */
  frontendBuildPath?: string;

  /**
   * Enable WAF (Web Application Firewall)
   * @default true for production
   */
  enableWaf?: boolean;
}

export class FrontendStack extends cdk.Stack {
  /**
   * S3 bucket for static files
   */
  public readonly bucket: s3.Bucket;

  /**
   * CloudFront distribution
   */
  public readonly distribution: cloudfront.Distribution;

  /**
   * CloudFront domain name
   */
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const {
      environment,
      backendApiUrl,
      certificateArn,
      domainNames,
      frontendBuildPath,
    } = props;

    const isProd = environment === 'production';

    // ==================== S3 BUCKET ====================
    // Stores the static frontend files (HTML, CSS, JS, images).
    // The bucket is PRIVATE - only CloudFront can access it via OAC.

    this.bucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `audio-library-${environment}-frontend-${this.account}`,
      
      // Block ALL public access - CloudFront uses OAC
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      
      // Encryption at rest
      encryption: s3.BucketEncryption.S3_MANAGED,
      
      // Enforce HTTPS
      enforceSSL: true,
      
      // Versioning for rollback capability
      versioned: isProd,
      
      // Lifecycle rules for cost optimization
      lifecycleRules: [
        {
          // Delete old versions after 30 days
          id: 'cleanup-old-versions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
          enabled: isProd,
        },
      ],
      
      // Removal policy
      removalPolicy: isProd 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // ==================== CLOUDFRONT ORIGIN ACCESS CONTROL ====================
    // OAC is the modern, secure way for CloudFront to access S3.
    // It replaces the older Origin Access Identity (OAI).

    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      signing: cloudfront.Signing.SIGV4_ALWAYS,
      description: `OAC for Audio Library ${environment} frontend`,
    });

    // ==================== CACHE POLICIES ====================
    // Define how long different types of content are cached.

    // Cache policy for static assets (JS, CSS, images)
    // These files have content hashes in filenames, so they can be cached forever
    const staticAssetsCachePolicy = new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
      cachePolicyName: `AudioLibrary-${environment}-StaticAssets`,
      comment: 'Long-term caching for hashed static assets',
      defaultTtl: cdk.Duration.days(365),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.days(1),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Cache policy for HTML files
    // HTML should have shorter TTL to pick up new deployments
    const htmlCachePolicy = new cloudfront.CachePolicy(this, 'HtmlCachePolicy', {
      cachePolicyName: `AudioLibrary-${environment}-HTML`,
      comment: 'Short-term caching for HTML files',
      defaultTtl: cdk.Duration.minutes(5),
      maxTtl: cdk.Duration.hours(1),
      minTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // ==================== RESPONSE HEADERS POLICY ====================
    // Security headers for the frontend.

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      responseHeadersPolicyName: `AudioLibrary-${environment}-SecurityHeaders`,
      comment: 'Security headers for Audio Library frontend',
      
      securityHeadersBehavior: {
        // Prevent clickjacking
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true,
        },
        
        // Prevent MIME type sniffing
        contentTypeOptions: {
          override: true,
        },
        
        // Enable XSS protection in older browsers
        xssProtection: {
          protection: true,
          modeBlock: true,
          override: true,
        },
        
        // Referrer policy
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        
        // HSTS - force HTTPS
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        
        // Content Security Policy
        contentSecurityPolicy: {
          contentSecurityPolicy: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust based on your needs
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' https:",
            "media-src 'self' blob:",
            "object-src 'none'",
            "frame-ancestors 'none'",
          ].join('; '),
          override: true,
        },
      },
    });

    // ==================== CLOUDFRONT DISTRIBUTION ====================
    // The CDN that serves the frontend globally with low latency.

    // S3 origin with OAC
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
      originAccessControl: oac,
    });

    // Backend API origin for proxying /api/* requests
    const apiOrigin = new origins.HttpOrigin(backendApiUrl, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, // ALB handles HTTPS
      httpPort: 80,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      // Default behavior - serve static files from S3
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: htmlCachePolicy,
        responseHeadersPolicy,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress: true,
      },
      
      // Additional behaviors for specific paths
      additionalBehaviors: {
        // Static assets with long cache TTL
        'assets/*': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
          responseHeadersPolicy,
          compress: true,
        },
        
        // JS files with long cache TTL
        '*.js': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
          responseHeadersPolicy,
          compress: true,
        },
        
        // CSS files with long cache TTL
        '*.css': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
          responseHeadersPolicy,
          compress: true,
        },
        
        // API proxy - forward /api/* to backend
        'api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // Don't cache API responses
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER, // Forward all headers
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // Allow all HTTP methods
          compress: true,
        },
      },
      
      // Default root object
      defaultRootObject: 'index.html',
      
      // Custom error responses for SPA routing
      // When S3 returns 403/404, serve index.html so React Router can handle it
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      
      // SSL certificate and domains
      certificate: certificateArn
        ? acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn)
        : undefined,
      domainNames,
      
      // Price class - use all edge locations for best performance
      priceClass: isProd 
        ? cloudfront.PriceClass.PRICE_CLASS_ALL 
        : cloudfront.PriceClass.PRICE_CLASS_100, // US/Europe only for dev
      
      // HTTP/2 and HTTP/3 for better performance
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      
      // Enable logging
      enableLogging: isProd,
      
      // Minimum SSL/TLS protocol version
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      
      // Enable IPv6
      enableIpv6: true,
      
      comment: `Audio Library ${environment} frontend distribution`,
    });

    this.distributionDomainName = this.distribution.distributionDomainName;

    // ==================== S3 BUCKET POLICY ====================
    // Grant CloudFront access to the S3 bucket via OAC.
    
    this.bucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowCloudFrontOAC',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [this.bucket.arnForObjects('*')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
        },
      },
    }));

    // ==================== S3 DEPLOYMENT ====================
    // Deploy frontend files to S3 if a build path is provided.

    if (frontendBuildPath) {
      new s3deploy.BucketDeployment(this, 'DeployWebsite', {
        sources: [s3deploy.Source.asset(frontendBuildPath)],
        destinationBucket: this.bucket,
        distribution: this.distribution,
        distributionPaths: ['/*'], // Invalidate all paths on deployment
        
        // Memory for the Lambda that does the deployment
        memoryLimit: 512,
        
        // Prune old files
        prune: true,
      });
    }

    // ==================== SSM PARAMETERS ====================

    new ssm.StringParameter(this, 'DistributionIdParam', {
      parameterName: `/audio-library/${environment}/frontend/distribution-id`,
      stringValue: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    new ssm.StringParameter(this, 'BucketNameParam', {
      parameterName: `/audio-library/${environment}/frontend/bucket-name`,
      stringValue: this.bucket.bucketName,
      description: 'Frontend S3 bucket name',
    });

    // ==================== OUTPUTS ====================

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `${id}-DistributionId`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: `${id}-DistributionDomain`,
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${domainNames?.[0] || this.distributionDomainName}`,
      description: 'Website URL',
      exportName: `${id}-WebsiteUrl`,
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket name for frontend files',
      exportName: `${id}-BucketName`,
    });

    // Deployment commands output
    new cdk.CfnOutput(this, 'DeployCommand', {
      value: [
        'To deploy frontend manually:',
        `aws s3 sync ./dist s3://${this.bucket.bucketName} --delete`,
        `aws cloudfront create-invalidation --distribution-id ${this.distribution.distributionId} --paths "/*"`,
      ].join('\n'),
      description: 'Manual deployment commands',
    });
  }
}


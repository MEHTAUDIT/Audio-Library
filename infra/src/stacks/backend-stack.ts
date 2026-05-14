import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

/**
 * =============================================================================
 * BACKEND STACK
 * =============================================================================
 * 
 * Creates the backend application infrastructure using ECS Fargate.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                               Internet                                  │
 * │                                   │                                     │
 * │                                   ▼                                     │
 * │  ┌─────────────────────────────────────────────────────────────────┐   │
 * │  │              Application Load Balancer (Public)                 │   │
 * │  │                    HTTPS Termination                            │   │
 * │  └─────────────────────────────────────────────────────────────────┘   │
 * │                          │                 │                            │
 * │           ┌──────────────┘                 └──────────────┐             │
 * │           ▼                                               ▼             │
 * │  ┌─────────────────────────┐           ┌─────────────────────────┐     │
 * │  │     ECS Task (AZ-A)     │           │     ECS Task (AZ-B)     │     │
 * │  │  ┌───────────────────┐  │           │  ┌───────────────────┐  │     │
 * │  │  │  Spring Boot App  │  │           │  │  Spring Boot App  │  │     │
 * │  │  │  Container        │  │           │  │  Container        │  │     │
 * │  │  └───────────────────┘  │           │  └───────────────────┘  │     │
 * │  └─────────────────────────┘           └─────────────────────────┘     │
 * │                                                                         │
 * │                          Private Subnets                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * Features:
 * - Serverless containers with Fargate (no EC2 management)
 * - Auto-scaling based on CPU/Memory utilization
 * - Health checks and automatic container replacement
 * - Centralized logging to CloudWatch
 * - Secrets injection from Secrets Manager
 * - X-Ray tracing for distributed debugging
 */

export interface BackendStackProps extends cdk.StackProps {
  /**
   * Environment name (development, staging, production)
   */
  environment: string;

  /**
   * VPC to deploy the backend in
   */
  vpc: ec2.IVpc;

  /**
   * Security group for the ALB
   */
  albSecurityGroup: ec2.ISecurityGroup;

  /**
   * Security group for the ECS tasks
   */
  appSecurityGroup: ec2.ISecurityGroup;

  /**
   * Database secret for connection credentials
   */
  databaseSecret: secretsmanager.ISecret;

  /**
   * Database endpoint
   */
  databaseEndpoint: string;

  /**
   * S3 bucket for audio storage
   */
  audioBucket: s3.IBucket;

  /**
   * Docker image URI for the backend
   * @default Uses ECR repository
   */
  imageUri?: string;

  /**
   * Desired number of tasks
   * @default 1 for dev, 2 for staging/prod
   */
  desiredCount?: number;

  /**
   * CPU units for each task (256, 512, 1024, 2048, 4096)
   * @default 256 for dev, 512 for staging, 1024 for prod
   */
  cpu?: number;

  /**
   * Memory in MB for each task
   * @default 512 for dev, 1024 for staging, 2048 for prod
   */
  memoryMiB?: number;

  /**
   * ACM certificate ARN for HTTPS
   * @default undefined (HTTP only)
   */
  certificateArn?: string;

  /**
   * Domain name for the backend API
   * @default undefined
   */
  domainName?: string;

  /**
   * Assign public IP to ECS tasks (for deployments without NAT Gateway)
   * @default false
   */
  assignPublicIp?: boolean;

  /**
   * CORS allowed origins (comma-separated)
   * Automatically includes CloudFront distribution domain
   * @default undefined
   */
  corsAllowedOrigins?: string;

  /**
   * Auto-shutdown configuration for cost savings
   * @default undefined (no auto-shutdown)
   */
  autoShutdown?: {
    enabled: boolean;
    stopCron: string;
    startCron: string;
    timezone?: string;
  };
}

export class BackendStack extends cdk.Stack {
  /**
   * The ECS cluster
   */
  public readonly cluster: ecs.Cluster;

  /**
   * The Fargate service
   */
  public readonly service: ecs.FargateService;

  /**
   * The Application Load Balancer
   */
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  /**
   * The ALB DNS name
   */
  public readonly loadBalancerDnsName: string;

  /**
   * CloudWatch log group for application logs
   */
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const {
      environment,
      vpc,
      albSecurityGroup,
      appSecurityGroup,
      databaseSecret,
      databaseEndpoint,
      audioBucket,
      certificateArn,
    } = props;

    const isProd = environment === 'production';
    const isStaging = environment === 'staging';

    // Determine resource sizing based on environment
    const cpu = props.cpu || (isProd ? 1024 : isStaging ? 512 : 256);
    const memoryMiB = props.memoryMiB || (isProd ? 2048 : isStaging ? 1024 : 512);
    const desiredCount = props.desiredCount || (isProd || isStaging ? 2 : 1);

    // ==================== ECS CLUSTER ====================
    // The cluster is a logical grouping of tasks and services.
    // With Fargate, we don't need to manage EC2 instances.

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: `audio-library-${environment}`,
      
      // Container Insights provides detailed metrics for containers
      containerInsightsV2: isProd ? ecs.ContainerInsights.ENHANCED : ecs.ContainerInsights.DISABLED,
      
      // Enable execute command for debugging (access container shell)
      enableFargateCapacityProviders: true,
    });

    // ==================== LOG GROUP ====================
    // Centralized logging for application containers.
    // All stdout/stderr from containers goes here.

    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/audio-library/${environment}/backend`,
      retention: isProd
        ? logs.RetentionDays.THREE_MONTHS
        : logs.RetentionDays.ONE_DAY,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // ==================== JWT SECRET ====================
    // Auto-generated secure JWT signing key stored in Secrets Manager.
    // This is used to sign and verify authentication tokens.

    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `audio-library/${environment}/jwt-secret`,
      description: 'JWT signing key for Audio Library authentication',
      generateSecretString: {
        // Generate a secure 64-character hex string (256 bits)
        passwordLength: 64,
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    // ==================== TASK DEFINITION ====================
    // Defines what containers run and their resource requirements.

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu,
      memoryLimitMiB: memoryMiB,
      
      // Task role: what AWS services the container can access
      // Execution role: what ECS needs to run the task (pulling images, etc.)
    });

    // Grant the task access to required AWS services
    // S3 bucket for audio files
    audioBucket.grantReadWrite(taskDefinition.taskRole);
    
    // Secrets Manager for database credentials and JWT secret
    databaseSecret.grantRead(taskDefinition.taskRole);
    jwtSecret.grantRead(taskDefinition.taskRole);

    // Allow reading SSM parameters
    taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/audio-library/${environment}/*`],
    }));

    // ==================== GITLAB REGISTRY SECRET (if using private registry) ====================
    // For pulling images from GitLab Container Registry
    let registrySecret: secretsmanager.ISecret | undefined;

    if (props.imageUri && props.imageUri.includes('registry.gitlab.com')) {
      // Use GitLab registry credentials from Secrets Manager
      registrySecret = secretsmanager.Secret.fromSecretNameV2(
        this,
        'GitLabRegistrySecret',
        `audio-library/${environment}/gitlab-registry`
      );

      // Grant task execution role permission to read the secret
      registrySecret.grantRead(taskDefinition.executionRole!);
    }

    // ==================== CONTAINER IMAGE ====================
    // Resolve the container image from ECR, external registry, or placeholder.

    let containerImage: ecs.ContainerImage;
    if (props.imageUri && props.imageUri.includes('.dkr.ecr.')) {
      // ECR image — parse repo name and tag, use fromEcrRepository for proper IAM
      const ecrMatch = props.imageUri.match(/\.amazonaws\.com\/(.+?)(?::(.+))?$/);
      const repoName = ecrMatch?.[1] || 'audio-library-backend';
      const imageTag = ecrMatch?.[2] || 'latest';
      const ecrRepo = ecr.Repository.fromRepositoryName(this, 'EcrRepo', repoName);
      containerImage = ecs.ContainerImage.fromEcrRepository(ecrRepo, imageTag);
    } else if (props.imageUri) {
      // External registry (e.g. GitLab Container Registry)
      containerImage = ecs.ContainerImage.fromRegistry(props.imageUri, {
        credentials: registrySecret,
      });
    } else {
      // Placeholder for infra-only deployment
      containerImage = ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample');
    }

    // ==================== CONTAINER DEFINITION ====================
    // The actual container configuration.

    const container = taskDefinition.addContainer('Backend', {
      image: containerImage,
      
      // Logging configuration
      logging: ecs.LogDrivers.awsLogs({
        logGroup: this.logGroup,
        streamPrefix: 'backend',
      }),

      // Environment variables (non-sensitive)
      environment: {
        // Spring profile mapping: development→dev, staging→uat, production→prod
        SPRING_PROFILES_ACTIVE: environment === 'development' ? 'dev' 
          : environment === 'staging' ? 'uat' 
          : 'prod',
        SERVER_PORT: '8080',
        
        // Database connection (host, not credentials)
        SPRING_DATASOURCE_URL: `jdbc:postgresql://${databaseEndpoint}:5432/audiolibrary`,
        
        // S3 configuration
        // Note: No AWS_ACCESS_KEY_ID/SECRET needed - ECS task role provides access!
        APP_S3_ENABLED: 'true',
        APP_S3_BUCKET: audioBucket.bucketName,
        APP_S3_REGION: this.region,
        AWS_REGION: this.region,
        
        // Java options for container environment
        JAVA_OPTS: `-Xms${Math.floor(memoryMiB * 0.5)}m -Xmx${Math.floor(memoryMiB * 0.75)}m`,

        // CORS allowed origins (CloudFront domain + any custom domains)
        ...(props.corsAllowedOrigins ? { APP_CORS_ALLOWED_ORIGINS: props.corsAllowedOrigins } : {}),
      },

      // Secrets (injected from Secrets Manager)
      // These are securely fetched at container start, not baked into the image
      secrets: {
        // Database credentials
        SPRING_DATASOURCE_USERNAME: ecs.Secret.fromSecretsManager(databaseSecret, 'username'),
        SPRING_DATASOURCE_PASSWORD: ecs.Secret.fromSecretsManager(databaseSecret, 'password'),
        // JWT signing key for authentication
        JWT_SECRET_KEY: ecs.Secret.fromSecretsManager(jwtSecret),
      },

      // Health check — only enabled when a real app image is provided.
      // The placeholder image (amazon-ecs-sample) doesn't expose /actuator/health,
      // so enabling it would trigger the ECS circuit breaker.
      ...(props.imageUri ? {
        healthCheck: {
          command: ['CMD-SHELL', 'wget --quiet --tries=1 --spider http://localhost:8080/actuator/health || exit 1'],
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          retries: 3,
          startPeriod: cdk.Duration.seconds(120), // Grace period for Spring Boot startup
        },
      } : {}),

      // Container will be essential (task fails if this container fails)
      essential: true,
    });

    // Map container port
    container.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    // ==================== APPLICATION LOAD BALANCER ====================
    // The ALB distributes incoming traffic across healthy containers.

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      
      // Enable access logging
      // Note: You'll need an S3 bucket for ALB logs in production
    });

    this.loadBalancerDnsName = this.loadBalancer.loadBalancerDnsName;

    // ==================== TARGET GROUP ====================
    // Target group defines health checks and routing to containers.

    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      
      // Health check configuration
      // Uses /actuator/health for real Spring Boot app, / for placeholder image
      healthCheck: {
        path: props.imageUri ? '/actuator/health' : '/',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      
      // Deregistration delay - time to drain connections before removing target
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // ==================== LISTENERS ====================
    // Listeners handle incoming connections on specific ports.

    // HTTP Listener - redirect to HTTPS in production
    const httpListener = this.loadBalancer.addListener('HttpListener', {
      port: 80,
      defaultAction: certificateArn
        ? elbv2.ListenerAction.redirect({
            protocol: 'HTTPS',
            port: '443',
            permanent: true,
          })
        : elbv2.ListenerAction.forward([targetGroup]),
    });

    // HTTPS Listener (only if certificate is provided)
    if (certificateArn) {
      this.loadBalancer.addListener('HttpsListener', {
        port: 443,
        certificates: [
          elbv2.ListenerCertificate.fromArn(certificateArn),
        ],
        defaultAction: elbv2.ListenerAction.forward([targetGroup]),
      });
    }

    // ==================== FARGATE SERVICE ====================
    // The service maintains the desired number of tasks running.

    // HYBRID PHASE 1: Support public subnets when NAT Gateway is disabled
    const usePublicSubnets = props.assignPublicIp === true;

    this.service = new ecs.FargateService(this, 'Service', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount,

      // Deploy in public subnets if assignPublicIp=true (no NAT), otherwise private
      vpcSubnets: {
        subnetType: usePublicSubnets
          ? ec2.SubnetType.PUBLIC
          : ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [appSecurityGroup],

      // Assign public IP when using public subnets (required for internet access without NAT)
      assignPublicIp: usePublicSubnets,

      // Enable ECS Exec for debugging (SSH into containers)
      enableExecuteCommand: true,

      // Circuit breaker rolls back failed deployments automatically
      circuitBreaker: {
        rollback: true,
      },

      // Minimum healthy percent during deployments
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
    });

    // Register service with target group
    this.service.attachToApplicationTargetGroup(targetGroup);

    // ==================== AUTO SCALING ====================
    // Automatically adjust the number of tasks based on load.

    const scaling = this.service.autoScaleTaskCount({
      minCapacity: desiredCount,
      maxCapacity: isProd ? 10 : isStaging ? 5 : 2,
    });

    // Scale based on CPU utilization
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Scale based on memory utilization
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // Scale based on request count per target
    scaling.scaleOnRequestCount('RequestScaling', {
      targetGroup,
      requestsPerTarget: 1000,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(2),
    });

    // ==================== SSM PARAMETERS ====================

    new ssm.StringParameter(this, 'AlbDnsParam', {
      parameterName: `/audio-library/${environment}/backend/alb-dns`,
      stringValue: this.loadBalancerDnsName,
      description: 'Backend ALB DNS name',
    });

    new ssm.StringParameter(this, 'ClusterArnParam', {
      parameterName: `/audio-library/${environment}/backend/cluster-arn`,
      stringValue: this.cluster.clusterArn,
      description: 'ECS cluster ARN',
    });

    // ==================== OUTPUTS ====================

    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: this.loadBalancerDnsName,
      description: 'Application Load Balancer DNS name',
      exportName: `${id}-AlbDns`,
    });

    new cdk.CfnOutput(this, 'LoadBalancerUrl', {
      value: certificateArn 
        ? `https://${this.loadBalancerDnsName}` 
        : `http://${this.loadBalancerDnsName}`,
      description: 'Application Load Balancer URL',
      exportName: `${id}-AlbUrl`,
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: this.cluster.clusterArn,
      description: 'ECS cluster ARN',
      exportName: `${id}-ClusterArn`,
    });

    new cdk.CfnOutput(this, 'ServiceArn', {
      value: this.service.serviceArn,
      description: 'ECS service ARN',
      exportName: `${id}-ServiceArn`,
    });

    new cdk.CfnOutput(this, 'LogGroupName', {
      value: this.logGroup.logGroupName,
      description: 'CloudWatch log group for backend logs',
      exportName: `${id}-LogGroup`,
    });

    new cdk.CfnOutput(this, 'JwtSecretArn', {
      value: jwtSecret.secretArn,
      description: 'JWT secret ARN in Secrets Manager',
      exportName: `${id}-JwtSecretArn`,
    });

    // ==================== AUTO-SHUTDOWN (PHASE 1 COST OPTIMIZATION) ====================
    // Lambda functions to start/stop ECS service on schedule
    // Saves ~75% on compute costs by shutting down during off-hours

    if (props.autoShutdown?.enabled) {
      const { stopCron, startCron } = props.autoShutdown;

      // Lambda function to control ECS service desired count
      const shutdownLambda = new lambda.Function(this, 'AutoShutdownLambda', {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
import boto3
import os

ecs = boto3.client('ecs')
cluster_name = os.environ['CLUSTER_NAME']
service_name = os.environ['SERVICE_NAME']

def handler(event, context):
    action = event.get('action', 'stop')
    desired_count = 1 if action == 'start' else 0

    response = ecs.update_service(
        cluster=cluster_name,
        service=service_name,
        desiredCount=desired_count
    )

    print(f"Service {service_name} desired count set to {desired_count}")
    return {
        'statusCode': 200,
        'body': f'Service {action}ed successfully'
    }
`),
        environment: {
          CLUSTER_NAME: this.cluster.clusterName,
          SERVICE_NAME: this.service.serviceName,
        },
        timeout: cdk.Duration.seconds(30),
        description: `Auto-shutdown Lambda for ${environment} environment`,
      });

      // Grant Lambda permissions to update ECS service
      shutdownLambda.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecs:UpdateService',
          'ecs:DescribeServices',
        ],
        resources: [this.service.serviceArn],
      }));

      // EventBridge rule to STOP the service (evening)
      const stopRule = new events.Rule(this, 'StopRule', {
        schedule: events.Schedule.expression(`cron(${stopCron})`),
        description: `Stop ECS service at ${stopCron}`,
      });

      stopRule.addTarget(new targets.LambdaFunction(shutdownLambda, {
        event: events.RuleTargetInput.fromObject({
          action: 'stop',
        }),
      }));

      // EventBridge rule to START the service (morning)
      const startRule = new events.Rule(this, 'StartRule', {
        schedule: events.Schedule.expression(`cron(${startCron})`),
        description: `Start ECS service at ${startCron}`,
      });

      startRule.addTarget(new targets.LambdaFunction(shutdownLambda, {
        event: events.RuleTargetInput.fromObject({
          action: 'start',
        }),
      }));

      // Output the schedule info
      new cdk.CfnOutput(this, 'AutoShutdownSchedule', {
        value: `Stop: ${stopCron} | Start: ${startCron}`,
        description: 'Auto-shutdown schedule (UTC)',
      });
    }
  }
}


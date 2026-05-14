import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * =============================================================================
 * DATABASE STACK
 * =============================================================================
 * 
 * Creates a PostgreSQL RDS database for the Audio Library application.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                         Private/Isolated Subnets                        │
 * │  ┌─────────────────────────┐    ┌─────────────────────────┐            │
 * │  │   Availability Zone A   │    │   Availability Zone B   │            │
 * │  │  ┌───────────────────┐  │    │  ┌───────────────────┐  │            │
 * │  │  │  Primary DB       │◄─┼────┼──│  Standby DB       │  │            │
 * │  │  │  (Read/Write)     │  │    │  │  (Failover)       │  │  (Prod)    │
 * │  │  └───────────────────┘  │    │  └───────────────────┘  │            │
 * │  └─────────────────────────┘    └─────────────────────────┘            │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * Features:
 * - Multi-AZ deployment for production (automatic failover)
 * - Encrypted storage at rest
 * - Automated backups with point-in-time recovery
 * - CloudWatch logging for slow queries and errors
 * - Credentials stored in Secrets Manager
 * - Performance Insights enabled for query analysis
 */

export interface DatabaseStackProps extends cdk.StackProps {
  /**
   * Environment name (development, staging, production)
   */
  environment: string;

  /**
   * VPC to deploy the database in
   */
  vpc: ec2.IVpc;

  /**
   * Security group for the database
   */
  securityGroup: ec2.ISecurityGroup;

  /**
   * Database instance class
   * @default t3.micro for dev, t3.small for staging, t3.medium for prod
   */
  instanceClass?: ec2.InstanceClass;

  /**
   * Database instance size
   * @default MICRO for dev, SMALL for staging, MEDIUM for prod
   */
  instanceSize?: ec2.InstanceSize;

  /**
   * Allocated storage in GB
   * @default 20
   */
  allocatedStorage?: number;

  /**
   * Maximum storage in GB (for autoscaling)
   * @default 100
   */
  maxAllocatedStorage?: number;

  /**
   * Backup retention period in days
   * @default 7 for dev, 14 for staging, 30 for prod
   */
  backupRetentionDays?: number;

  /**
   * Enable Multi-AZ deployment for high availability
   * @default true for production, false otherwise
   */
  multiAz?: boolean;
}

export class DatabaseStack extends cdk.Stack {
  /**
   * The RDS database instance
   */
  public readonly database: rds.DatabaseInstance;

  /**
   * Secret containing database credentials
   */
  public readonly secret: secretsmanager.ISecret;

  /**
   * Database endpoint address
   */
  public readonly endpoint: string;

  /**
   * Database port
   */
  public readonly port: number;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const {
      environment,
      vpc,
      securityGroup,
      allocatedStorage = 20,
      maxAllocatedStorage = 100,
    } = props;

    const isProd = environment === 'production';
    const isStaging = environment === 'staging';

    // Determine instance size based on environment
    const instanceClass = props.instanceClass || ec2.InstanceClass.T3;
    const instanceSize = props.instanceSize || (
      isProd ? ec2.InstanceSize.MEDIUM :
      isStaging ? ec2.InstanceSize.SMALL :
      ec2.InstanceSize.MICRO
    );

    // Backup retention varies by environment
    const backupRetentionDays = props.backupRetentionDays || (
      isProd ? 30 :
      isStaging ? 14 :
      7
    );

    // ==================== DATABASE CREDENTIALS ====================
    // Credentials are automatically generated and stored in Secrets Manager.
    // The application retrieves them at runtime - never hardcoded!

    const credentials = rds.Credentials.fromGeneratedSecret('audiolib_admin', {
      secretName: `audio-library/${environment}/database/credentials`,
    });

    // ==================== PARAMETER GROUP ====================
    // Parameter groups allow customizing database engine settings.
    // We enable logging for debugging and performance analysis.

    const parameterGroup = new rds.ParameterGroup(this, 'ParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      description: `Audio Library ${environment} PostgreSQL parameters`,
      parameters: {
        // Log slow queries (queries taking longer than 1 second)
        'log_min_duration_statement': '1000',
        
        // Log all DDL statements (CREATE, ALTER, DROP)
        'log_statement': 'ddl',
        
        // Enable query statistics collection
        'shared_preload_libraries': 'pg_stat_statements',
        
        // Connection logging
        'log_connections': '1',
        'log_disconnections': '1',
      },
    });

    // ==================== SUBNET GROUP ====================
    // Defines which subnets the database can be placed in.
    // We use isolated subnets for maximum security.

    const subnetGroup = new rds.SubnetGroup(this, 'SubnetGroup', {
      vpc,
      description: `Audio Library ${environment} database subnet group`,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // ==================== RDS INSTANCE ====================
    // The PostgreSQL database instance itself.

    this.database = new rds.DatabaseInstance(this, 'Database', {
      // --- Engine Configuration ---
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      
      // --- Instance Configuration ---
      instanceType: ec2.InstanceType.of(instanceClass, instanceSize),
      
      // --- Network Configuration ---
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      subnetGroup,
      securityGroups: [securityGroup],
      
      // --- Database Configuration ---
      databaseName: 'audiolibrary',
      credentials,
      parameterGroup,
      port: 5432,

      // --- Storage Configuration ---
      // General Purpose SSD provides a good balance of price and performance
      storageType: rds.StorageType.GP3,
      allocatedStorage,
      maxAllocatedStorage, // Enables storage autoscaling
      storageEncrypted: true, // Encrypt data at rest

      // --- High Availability ---
      // Multi-AZ creates a standby replica in another AZ.
      // Automatic failover if the primary fails (~60 seconds).
      // PHASE 1: Disable for dev to save costs (~2x cost reduction)
      multiAz: props.multiAz !== undefined ? props.multiAz : isProd,

      // --- Backup Configuration ---
      // Automated backups enable point-in-time recovery
      backupRetention: cdk.Duration.days(backupRetentionDays),
      // Run backups during low-traffic window (UTC)
      preferredBackupWindow: '03:00-04:00',
      // Run maintenance during low-traffic window (UTC)
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      // Delete automated backups when instance is deleted
      deleteAutomatedBackups: !isProd,

      // --- Monitoring ---
      // Performance Insights helps identify performance bottlenecks
      enablePerformanceInsights: true,
      performanceInsightRetention: isProd 
        ? rds.PerformanceInsightRetention.MONTHS_3 
        : rds.PerformanceInsightRetention.DEFAULT,
      
      // Enhanced Monitoring provides OS-level metrics
      monitoringInterval: cdk.Duration.seconds(isProd ? 30 : 60),
      
      // CloudWatch Logs exports
      cloudwatchLogsExports: ['postgresql', 'upgrade'],
      cloudwatchLogsRetention: isProd 
        ? logs.RetentionDays.THREE_MONTHS 
        : logs.RetentionDays.ONE_WEEK,

      // --- Lifecycle ---
      // Prevent accidental deletion in production
      deletionProtection: isProd,
      removalPolicy: isProd 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,

      // --- Public Access ---
      // NEVER make the database publicly accessible
      publiclyAccessible: false,
    });

    // Store references for other stacks
    this.secret = this.database.secret!;
    this.endpoint = this.database.dbInstanceEndpointAddress;
    this.port = 5432; // PostgreSQL default port

    // ==================== SSM PARAMETERS ====================
    // Store non-sensitive configuration in Parameter Store
    // for easy access by the application.

    new ssm.StringParameter(this, 'EndpointParam', {
      parameterName: `/audio-library/${environment}/database/endpoint`,
      stringValue: this.endpoint,
      description: 'RDS database endpoint',
    });

    new ssm.StringParameter(this, 'PortParam', {
      parameterName: `/audio-library/${environment}/database/port`,
      stringValue: this.port.toString(),
      description: 'RDS database port',
    });

    new ssm.StringParameter(this, 'DatabaseNameParam', {
      parameterName: `/audio-library/${environment}/database/name`,
      stringValue: 'audiolibrary',
      description: 'Database name',
    });

    // ==================== OUTPUTS ====================

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.endpoint,
      description: 'RDS database endpoint',
      exportName: `${id}-Endpoint`,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.port.toString(),
      description: 'RDS database port',
      exportName: `${id}-Port`,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: this.secret.secretArn,
      description: 'Secrets Manager ARN for database credentials',
      exportName: `${id}-SecretArn`,
    });

    new cdk.CfnOutput(this, 'DatabaseIdentifier', {
      value: this.database.instanceIdentifier,
      description: 'RDS instance identifier',
      exportName: `${id}-InstanceId`,
    });
  }
}


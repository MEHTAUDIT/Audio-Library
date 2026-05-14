#!/usr/bin/env node
/**
 * =============================================================================
 * AUDIO LIBRARY - CDK APPLICATION ENTRY POINT
 * =============================================================================
 * 
 * This file orchestrates all infrastructure stacks for the Audio Library.
 * Configuration is loaded from config.yml in the project root.
 * 
 * Stack Dependencies:
 * 
 *   ┌─────────────────┐
 *   │   Networking    │ ◄── VPC, Subnets, Security Groups
 *   └────────┬────────┘
 *            │
 *   ┌────────▼────────┐
 *   │   AudioLibrary  │ ◄── S3 bucket for audio files
 *   └────────┬────────┘
 *            │
 *   ┌────────▼────────┐
 *   │    Database     │ ◄── RDS PostgreSQL
 *   └────────┬────────┘
 *            │
 *   ┌────────▼────────┐
 *   │    Backend      │ ◄── ECS Fargate, ALB
 *   └────────┬────────┘
 *            │
 *   ┌────────▼────────┐
 *   │    Frontend     │ ◄── S3, CloudFront
 *   └────────┬────────┘
 *            │
 *   ┌────────▼────────┐
 *   │   Monitoring    │ ◄── CloudWatch, Alarms, SNS
 *   └─────────────────┘
 * 
 * Usage:
 *   cdk deploy AudioLibrary-Dev-*     # Deploy all dev stacks
 *   cdk deploy AudioLibrary-Prod-*    # Deploy all prod stacks
 *   cdk deploy AudioLibrary-Dev-Backend  # Deploy single stack
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AudioLibraryStack } from './stacks/audio-library-stack';
import { NetworkingStack } from './stacks/networking-stack';
import { DatabaseStack } from './stacks/database-stack';
import { BackendStack } from './stacks/backend-stack';
import { FrontendStack } from './stacks/frontend-stack';
import { MonitoringStack } from './stacks/monitoring-stack';

// =============================================================================
// LOAD CONFIGURATION
// =============================================================================

interface Config {
  global: {
    appName: string;
    defaultRegion: string;
  };
  development: EnvironmentConfig;
  staging: EnvironmentConfig;
  production: EnvironmentConfig;
}

interface EnvironmentConfig {
  allowedOrigins: string[];
  alertEmails: string[];
  domainName?: string;
  certificateArn?: string;
  networking: {
    maxAzs: number;
    natGateways: number;
  };
  database: {
    instanceClass: string;
    instanceSize: string;
    allocatedStorage: number;
    maxAllocatedStorage: number;
    backupRetentionDays: number;
    multiAz?: boolean;
  };
  backend: {
    cpu: number;
    memory: number;
    desiredCount: number;
    minCapacity?: number;
    maxCapacity?: number;
    imageUri?: string;
    assignPublicIp?: boolean;
  };
  storage: {
    stagingRetentionDays: number;
    glacierTransitionDays?: number;
  };
  jumpHost?: {
    enabled: boolean;
  };
  autoShutdown?: {
    enabled: boolean;
    stopCron: string;
    startCron: string;
    timezone?: string;
  };
}

// Load config from YAML file
const configPath = path.join(__dirname, '..', 'config.yml');
const configFile = fs.readFileSync(configPath, 'utf8');
const config = yaml.load(configFile) as Config;

// Get AWS account and region from environment or config
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || config.global.defaultRegion;

// Validate required configuration
if (!account) {
  console.warn('Warning: AWS account ID not set. Set AWS_ACCOUNT_ID or configure AWS CLI.');
}

const app = new cdk.App();

// =============================================================================
// STACK FACTORY
// =============================================================================

// Common tags for all resources
const getCommonTags = (environment: string) => ({
  Environment: environment,
  Application: config.global.appName,
  ManagedBy: 'cdk',
});

/**
 * Creates all infrastructure stacks for a given environment.
 */
function createEnvironmentStacks(environment: 'development' | 'staging' | 'production') {
  const envConfig = config[environment];
  const stackPrefix = `AudioLibrary-${capitalize(environment)}`;
  const commonProps = {
    env: { account, region },
    tags: getCommonTags(environment),
  };

  // ---------------------------------------------------------------------------
  // 1. NETWORKING STACK
  // ---------------------------------------------------------------------------
  const networkingStack = new NetworkingStack(app, `${stackPrefix}-Networking`, {
    ...commonProps,
    environment,
    maxAzs: envConfig.networking.maxAzs,
    natGateways: envConfig.networking.natGateways,
    jumpHostEnabled: envConfig.jumpHost?.enabled ?? false,
  });

  // ---------------------------------------------------------------------------
  // 2. AUDIO LIBRARY STACK (S3 for audio storage)
  // ---------------------------------------------------------------------------
  const audioLibraryStack = new AudioLibraryStack(app, `${stackPrefix}-Storage`, {
    ...commonProps,
    environment,
    allowedOrigins: envConfig.allowedOrigins,
    stagingRetentionDays: envConfig.storage.stagingRetentionDays,
    glacierTransitionDays: envConfig.storage.glacierTransitionDays,
  });

  // ---------------------------------------------------------------------------
  // 3. DATABASE STACK
  // ---------------------------------------------------------------------------
  const databaseStack = new DatabaseStack(app, `${stackPrefix}-Database`, {
    ...commonProps,
    environment,
    vpc: networkingStack.vpc,
    securityGroup: networkingStack.databaseSecurityGroup,
    allocatedStorage: envConfig.database.allocatedStorage,
    maxAllocatedStorage: envConfig.database.maxAllocatedStorage,
    backupRetentionDays: envConfig.database.backupRetentionDays,
    multiAz: envConfig.database.multiAz,
  });
  databaseStack.addDependency(networkingStack);

  // ---------------------------------------------------------------------------
  // 4. BACKEND STACK
  // ---------------------------------------------------------------------------
  const backendStack = new BackendStack(app, `${stackPrefix}-Backend`, {
    ...commonProps,
    environment,
    vpc: networkingStack.vpc,
    albSecurityGroup: networkingStack.albSecurityGroup,
    appSecurityGroup: networkingStack.appSecurityGroup,
    databaseSecret: databaseStack.secret,
    databaseEndpoint: databaseStack.endpoint,
    audioBucket: audioLibraryStack.bucket,
    cpu: envConfig.backend.cpu,
    memoryMiB: envConfig.backend.memory,
    desiredCount: envConfig.backend.desiredCount,
    imageUri: envConfig.backend.imageUri,
    certificateArn: envConfig.certificateArn,
    assignPublicIp: envConfig.backend.assignPublicIp,
    corsAllowedOrigins: envConfig.allowedOrigins?.join(','),
    autoShutdown: envConfig.autoShutdown,
  });
  backendStack.addDependency(networkingStack);
  backendStack.addDependency(databaseStack);
  backendStack.addDependency(audioLibraryStack);

  // ---------------------------------------------------------------------------
  // 5. FRONTEND STACK
  // ---------------------------------------------------------------------------
  const frontendStack = new FrontendStack(app, `${stackPrefix}-Frontend`, {
    ...commonProps,
    environment,
    backendApiUrl: backendStack.loadBalancerDnsName,
    domainNames: envConfig.domainName ? [envConfig.domainName] : undefined,
    certificateArn: envConfig.certificateArn,
  });
  frontendStack.addDependency(backendStack);

  // ---------------------------------------------------------------------------
  // 6. MONITORING STACK
  // ---------------------------------------------------------------------------
  const monitoringStack = new MonitoringStack(app, `${stackPrefix}-Monitoring`, {
    ...commonProps,
    environment,
    ecsCluster: backendStack.cluster,
    ecsService: backendStack.service,
    database: databaseStack.database,
    loadBalancer: backendStack.loadBalancer,
    audioBucket: audioLibraryStack.bucket,
    backendLogGroup: backendStack.logGroup,
    criticalAlertEmails: envConfig.alertEmails,
    warningAlertEmails: envConfig.alertEmails,
  });
  monitoringStack.addDependency(backendStack);
  monitoringStack.addDependency(databaseStack);

  return {
    networkingStack,
    audioLibraryStack,
    databaseStack,
    backendStack,
    frontendStack,
    monitoringStack,
  };
}

// =============================================================================
// CREATE STACKS FOR ALL ENVIRONMENTS
// =============================================================================

const devStacks = createEnvironmentStacks('development');
const stagingStacks = createEnvironmentStacks('staging');
const prodStacks = createEnvironmentStacks('production');

// =============================================================================
// SYNTHESIZE
// =============================================================================

app.synth();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

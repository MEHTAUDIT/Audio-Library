import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * =============================================================================
 * NETWORKING STACK
 * =============================================================================
 * 
 * Creates the foundational network infrastructure for the Audio Library.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                              VPC (10.0.0.0/16)                          │
 * │  ┌─────────────────────────┐    ┌─────────────────────────┐            │
 * │  │   Availability Zone A   │    │   Availability Zone B   │            │
 * │  │  ┌───────────────────┐  │    │  ┌───────────────────┐  │            │
 * │  │  │  Public Subnet    │  │    │  │  Public Subnet    │  │            │
 * │  │  │  (ALB, NAT GW)    │  │    │  │  (ALB)            │  │            │
 * │  │  └───────────────────┘  │    │  └───────────────────┘  │            │
 * │  │  ┌───────────────────┐  │    │  ┌───────────────────┐  │            │
 * │  │  │  Private Subnet   │  │    │  │  Private Subnet   │  │            │
 * │  │  │  (ECS, RDS)       │  │    │  │  (ECS, RDS)       │  │            │
 * │  │  └───────────────────┘  │    │  └───────────────────┘  │            │
 * │  └─────────────────────────┘    └─────────────────────────┘            │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * Components:
 * - VPC with DNS support
 * - Public subnets for load balancers and NAT gateways
 * - Private subnets for application servers and databases
 * - NAT Gateway for outbound internet access from private subnets
 * - Security groups for each tier (ALB, App, Database)
 */

export interface NetworkingStackProps extends cdk.StackProps {
  /**
   * Environment name (development, staging, production)
   */
  environment: string;

  /**
   * Number of Availability Zones to use
   * @default 2
   */
  maxAzs?: number;

  /**
   * Number of NAT Gateways (1 for dev, 2 for prod for HA)
   * @default 1
   */
  natGateways?: number;

  /**
   * Enable SSM jump host for DBeaver / psql access to RDS
   * @default false
   */
  jumpHostEnabled?: boolean;
}

export class NetworkingStack extends cdk.Stack {
  /**
   * The VPC for all resources
   */
  public readonly vpc: ec2.Vpc;

  /**
   * Security group for the Application Load Balancer
   * Allows inbound HTTP/HTTPS from the internet
   */
  public readonly albSecurityGroup: ec2.SecurityGroup;

  /**
   * Security group for backend ECS tasks
   * Allows inbound traffic only from the ALB
   */
  public readonly appSecurityGroup: ec2.SecurityGroup;

  /**
   * Security group for the RDS database
   * Allows inbound traffic only from the app tier
   */
  public readonly databaseSecurityGroup: ec2.SecurityGroup;

  /**
   * SSM jump host instance ID (if jumpHostEnabled)
   * Use with: aws ssm start-session --target <id> --document-name AWS-StartPortForwardingSessionToRemoteHost
   */
  public readonly jumpHostInstanceId?: string;

  constructor(scope: Construct, id: string, props: NetworkingStackProps) {
    super(scope, id, props);

    const {
      environment,
      maxAzs = 2,
      natGateways = environment === 'production' ? 2 : 1,
      jumpHostEnabled = false,
    } = props;

    // ==================== VPC ====================
    // The Virtual Private Cloud is the foundation of our network.
    // It provides isolation and controls all network traffic.

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      // CIDR block defines the IP address range for the entire VPC
      // /16 gives us 65,536 IP addresses to work with
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      
      // Spread across multiple AZs for high availability
      maxAzs,
      
      // NAT Gateways allow private subnets to access the internet
      // (e.g., for pulling Docker images, API calls)
      // Using 1 in dev to save costs, 2 in prod for HA
      natGateways,

      // Define subnet configuration
      subnetConfiguration: [
        {
          // PUBLIC SUBNETS
          // - Directly accessible from the internet
          // - Hosts: ALB, NAT Gateway
          // - /24 gives us 256 IPs per AZ
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          // PRIVATE SUBNETS (with NAT access)
          // - Not directly accessible from internet
          // - Can make outbound connections via NAT Gateway
          // - Hosts: ECS tasks (backend application)
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          // ISOLATED SUBNETS (no internet access)
          // - Completely isolated from internet
          // - Most secure tier
          // - Hosts: RDS database
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],

      // Enable DNS support for service discovery
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // ==================== SECURITY GROUPS ====================
    // Security groups act as virtual firewalls, controlling inbound
    // and outbound traffic at the instance level.

    // --- ALB Security Group ---
    // The Application Load Balancer is the entry point for all traffic.
    // It needs to accept HTTP/HTTPS from anywhere on the internet.
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    // Allow HTTP (for redirect to HTTPS)
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from anywhere (redirects to HTTPS)'
    );

    // Allow HTTPS
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from anywhere'
    );

    // --- Application Security Group ---
    // Backend containers run in this security group.
    // They should ONLY accept traffic from the ALB, not directly from internet.
    this.appSecurityGroup = new ec2.SecurityGroup(this, 'AppSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS backend tasks',
      allowAllOutbound: true, // Needed for API calls, S3 access, etc.
    });

    // Only allow traffic from ALB on the application port
    this.appSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(8080),
      'Allow traffic from ALB on port 8080'
    );

    // --- Database Security Group ---
    // The database is the most protected tier.
    // It should ONLY accept connections from the application tier.
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS PostgreSQL database',
      allowAllOutbound: false, // Database doesn't need outbound access
    });

    // Only allow PostgreSQL connections from app tier
    this.databaseSecurityGroup.addIngressRule(
      this.appSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from application tier'
    );

    // ==================== SSM JUMP HOST ====================
    // A small EC2 instance used exclusively as an SSM port-forwarding target.
    // Allows developers to tunnel DBeaver → localhost → RDS without opening
    // any inbound ports or managing SSH keys.
    //
    // Usage (keep terminal open while using DBeaver):
    //   aws ssm start-session \
    //     --target <JumpHostInstanceId output> \
    //     --document-name AWS-StartPortForwardingSessionToRemoteHost \
    //     --parameters '{"host":["<RDS endpoint>"],"portNumber":["5432"],"localPortNumber":["15432"]}'
    //
    // Then connect DBeaver to: localhost:15432

    if (jumpHostEnabled) {
      const jumpHostRole = new iam.Role(this, 'JumpHostRole', {
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        ],
      });

      // No inbound rules — SSM agent connects outbound to the SSM service
      const jumpHostSg = new ec2.SecurityGroup(this, 'JumpHostSecurityGroup', {
        vpc: this.vpc,
        description: 'Security group for SSM jump host (no inbound rules)',
        allowAllOutbound: true,
      });

      // Dev has no NAT gateways, so the instance needs a public subnet to reach
      // the SSM service endpoints. Staging/prod use private subnets via NAT.
      const jumpHostSubnet = environment === 'development'
        ? ec2.SubnetType.PUBLIC
        : ec2.SubnetType.PRIVATE_WITH_EGRESS;

      const jumpHost = new ec2.Instance(this, 'JumpHost', {
        vpc: this.vpc,
        vpcSubnets: { subnetType: jumpHostSubnet },
        securityGroup: jumpHostSg,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.NANO),
        machineImage: ec2.MachineImage.latestAmazonLinux2023(),
        role: jumpHostRole,
        instanceName: `audio-library-${environment}-jump-host`,
      });

      // Allow the jump host to reach the database
      this.databaseSecurityGroup.addIngressRule(
        jumpHostSg,
        ec2.Port.tcp(5432),
        'Allow PostgreSQL from SSM jump host'
      );

      this.jumpHostInstanceId = jumpHost.instanceId;

      new cdk.CfnOutput(this, 'JumpHostInstanceId', {
        value: jumpHost.instanceId,
        description: 'SSM jump host instance ID — use in aws ssm start-session',
        exportName: `${id}-JumpHostInstanceId`,
      });
    }

    // ==================== VPC FLOW LOGS ====================
    // Flow logs capture information about IP traffic going to/from
    // network interfaces in the VPC. Essential for security auditing.

    this.vpc.addFlowLog('FlowLog', {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // ==================== OUTPUTS ====================
    
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${id}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PublicSubnets', {
      value: this.vpc.publicSubnets.map(s => s.subnetId).join(','),
      description: 'Public subnet IDs',
      exportName: `${id}-PublicSubnets`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnets', {
      value: this.vpc.privateSubnets.map(s => s.subnetId).join(','),
      description: 'Private subnet IDs',
      exportName: `${id}-PrivateSubnets`,
    });
  }
}


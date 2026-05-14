import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * =============================================================================
 * MONITORING STACK
 * =============================================================================
 * 
 * Creates comprehensive monitoring, alerting, and observability infrastructure.
 * 
 * Components:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        CLOUDWATCH MONITORING                            │
 * │                                                                         │
 * │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
 * │  │   Metrics   │    │    Logs     │    │  Dashboards │                 │
 * │  │  • CPU/Mem  │    │  • App logs │    │  • Overview │                 │
 * │  │  • Requests │    │  • DB logs  │    │  • Detailed │                 │
 * │  │  • Errors   │    │  • Errors   │    │             │                 │
 * │  └──────┬──────┘    └──────┬──────┘    └─────────────┘                 │
 * │         │                  │                                            │
 * │         ▼                  ▼                                            │
 * │  ┌─────────────────────────────────────────────┐                       │
 * │  │              CLOUDWATCH ALARMS              │                       │
 * │  │  • High CPU/Memory                          │                       │
 * │  │  • Error rate thresholds                    │                       │
 * │  │  • Latency thresholds                       │                       │
 * │  │  • Database connections                     │                       │
 * │  │  • 5xx error rates                          │                       │
 * │  └──────────────────┬──────────────────────────┘                       │
 * │                     │                                                   │
 * │                     ▼                                                   │
 * │  ┌─────────────────────────────────────────────┐                       │
 * │  │               SNS TOPICS                    │                       │
 * │  │  • Critical alerts → PagerDuty/Slack       │                       │
 * │  │  • Warning alerts → Email                   │                       │
 * │  └─────────────────────────────────────────────┘                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * Alarm Categories:
 * - CRITICAL: Immediate attention required (production down, data at risk)
 * - WARNING: Investigate soon (performance degradation, approaching limits)
 * - INFO: For tracking/correlation (deployments, scaling events)
 */

export interface MonitoringStackProps extends cdk.StackProps {
  /**
   * Environment name (development, staging, production)
   */
  environment: string;

  /**
   * ECS cluster to monitor
   */
  ecsCluster: ecs.ICluster;

  /**
   * ECS service to monitor
   */
  ecsService: ecs.IService;

  /**
   * RDS database instance to monitor
   */
  database: rds.IDatabaseInstance;

  /**
   * Application Load Balancer to monitor
   */
  loadBalancer: elbv2.ApplicationLoadBalancer;

  /**
   * S3 bucket for audio storage to monitor
   */
  audioBucket: s3.IBucket;

  /**
   * Backend log group
   */
  backendLogGroup: logs.ILogGroup;

  /**
   * Email addresses for critical alerts
   * @default []
   */
  criticalAlertEmails?: string[];

  /**
   * Email addresses for warning alerts
   * @default []
   */
  warningAlertEmails?: string[];

  /**
   * Slack webhook URL for alerts
   * @default undefined
   */
  slackWebhookUrl?: string;
}

export class MonitoringStack extends cdk.Stack {
  /**
   * SNS topic for critical alerts
   */
  public readonly criticalAlertsTopic: sns.Topic;

  /**
   * SNS topic for warning alerts
   */
  public readonly warningAlertsTopic: sns.Topic;

  /**
   * Main operational dashboard
   */
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const {
      environment,
      ecsCluster,
      ecsService,
      database,
      loadBalancer,
      audioBucket,
      backendLogGroup,
      criticalAlertEmails = [],
      warningAlertEmails = [],
    } = props;

    const isProd = environment === 'production';

    // ==================== SNS TOPICS ====================
    // Notification channels for different severity levels.

    // Critical alerts - production issues requiring immediate attention
    this.criticalAlertsTopic = new sns.Topic(this, 'CriticalAlerts', {
      topicName: `audio-library-${environment}-critical-alerts`,
      displayName: `Audio Library ${environment} Critical Alerts`,
    });

    // Warning alerts - issues that should be investigated
    this.warningAlertsTopic = new sns.Topic(this, 'WarningAlerts', {
      topicName: `audio-library-${environment}-warning-alerts`,
      displayName: `Audio Library ${environment} Warning Alerts`,
    });

    // Subscribe email addresses to topics
    criticalAlertEmails.forEach((email, index) => {
      this.criticalAlertsTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(email)
      );
    });

    warningAlertEmails.forEach((email, index) => {
      this.warningAlertsTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(email)
      );
    });

    // ==================== METRIC FILTERS ====================
    // Extract custom metrics from application logs.

    // Count application errors in logs
    const errorMetricFilter = new logs.MetricFilter(this, 'ErrorMetricFilter', {
      logGroup: backendLogGroup,
      filterPattern: logs.FilterPattern.anyTerm('ERROR', 'Exception', 'FATAL'),
      metricNamespace: `AudioLibrary/${environment}`,
      metricName: 'ApplicationErrors',
      metricValue: '1',
      defaultValue: 0,
    });

    // Count slow requests (for Spring Boot apps logging slow requests)
    const slowRequestFilter = new logs.MetricFilter(this, 'SlowRequestFilter', {
      logGroup: backendLogGroup,
      filterPattern: logs.FilterPattern.literal('[timestamp, ..., duration>1000]'),
      metricNamespace: `AudioLibrary/${environment}`,
      metricName: 'SlowRequests',
      metricValue: '1',
      defaultValue: 0,
    });

    // ==================== ECS ALARMS ====================
    // Monitor container health and resource utilization.

    // High CPU utilization alarm
    const ecsCpuAlarm = new cloudwatch.Alarm(this, 'EcsCpuAlarm', {
      alarmName: `${environment}-ecs-high-cpu`,
      alarmDescription: 'ECS service CPU utilization is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ClusterName: ecsCluster.clusterName,
          ServiceName: ecsService.serviceName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    ecsCpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlertsTopic));

    // Critical CPU alarm
    const ecsCpuCriticalAlarm = new cloudwatch.Alarm(this, 'EcsCpuCriticalAlarm', {
      alarmName: `${environment}-ecs-critical-cpu`,
      alarmDescription: 'ECS service CPU utilization is critically high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ClusterName: ecsCluster.clusterName,
          ServiceName: ecsService.serviceName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 95,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    ecsCpuCriticalAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.criticalAlertsTopic));

    // High memory utilization alarm
    const ecsMemoryAlarm = new cloudwatch.Alarm(this, 'EcsMemoryAlarm', {
      alarmName: `${environment}-ecs-high-memory`,
      alarmDescription: 'ECS service memory utilization is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'MemoryUtilization',
        dimensionsMap: {
          ClusterName: ecsCluster.clusterName,
          ServiceName: ecsService.serviceName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    ecsMemoryAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlertsTopic));

    // No running tasks alarm (service down)
    const ecsNoTasksAlarm = new cloudwatch.Alarm(this, 'EcsNoTasksAlarm', {
      alarmName: `${environment}-ecs-no-running-tasks`,
      alarmDescription: 'CRITICAL: No ECS tasks running - service is down!',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'RunningTaskCount',
        dimensionsMap: {
          ClusterName: ecsCluster.clusterName,
          ServiceName: ecsService.serviceName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    });
    ecsNoTasksAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.criticalAlertsTopic));

    // ==================== ALB ALARMS ====================
    // Monitor load balancer and request patterns.

    // High 5xx error rate alarm
    const alb5xxAlarm = new cloudwatch.Alarm(this, 'Alb5xxAlarm', {
      alarmName: `${environment}-alb-high-5xx-rate`,
      alarmDescription: 'High rate of 5xx errors from the backend',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_Target_5XX_Count',
        dimensionsMap: {
          LoadBalancer: loadBalancer.loadBalancerFullName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: isProd ? 50 : 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alb5xxAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.criticalAlertsTopic));

    // High latency alarm
    const albLatencyAlarm = new cloudwatch.Alarm(this, 'AlbLatencyAlarm', {
      alarmName: `${environment}-alb-high-latency`,
      alarmDescription: 'Response latency is higher than expected',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'TargetResponseTime',
        dimensionsMap: {
          LoadBalancer: loadBalancer.loadBalancerFullName,
        },
        statistic: 'p95',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 2, // 2 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    albLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlertsTopic));

    // Unhealthy targets alarm
    const albUnhealthyAlarm = new cloudwatch.Alarm(this, 'AlbUnhealthyAlarm', {
      alarmName: `${environment}-alb-unhealthy-targets`,
      alarmDescription: 'ALB has unhealthy targets',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'UnHealthyHostCount',
        dimensionsMap: {
          LoadBalancer: loadBalancer.loadBalancerFullName,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 0,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    albUnhealthyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlertsTopic));

    // ==================== RDS ALARMS ====================
    // Monitor database health and performance.

    // High CPU alarm
    const rdsCpuAlarm = new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
      alarmName: `${environment}-rds-high-cpu`,
      alarmDescription: 'RDS CPU utilization is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          DBInstanceIdentifier: database.instanceIdentifier,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    rdsCpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlertsTopic));

    // Low storage alarm
    const rdsStorageAlarm = new cloudwatch.Alarm(this, 'RdsStorageAlarm', {
      alarmName: `${environment}-rds-low-storage`,
      alarmDescription: 'RDS free storage space is running low',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'FreeStorageSpace',
        dimensionsMap: {
          DBInstanceIdentifier: database.instanceIdentifier,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5 * 1024 * 1024 * 1024, // 5 GB in bytes
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    });
    rdsStorageAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.criticalAlertsTopic));

    // High database connections alarm
    const rdsConnectionsAlarm = new cloudwatch.Alarm(this, 'RdsConnectionsAlarm', {
      alarmName: `${environment}-rds-high-connections`,
      alarmDescription: 'High number of database connections',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'DatabaseConnections',
        dimensionsMap: {
          DBInstanceIdentifier: database.instanceIdentifier,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: isProd ? 100 : 20,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    rdsConnectionsAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlertsTopic));

    // Read latency alarm
    const rdsReadLatencyAlarm = new cloudwatch.Alarm(this, 'RdsReadLatencyAlarm', {
      alarmName: `${environment}-rds-high-read-latency`,
      alarmDescription: 'RDS read latency is high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'ReadLatency',
        dimensionsMap: {
          DBInstanceIdentifier: database.instanceIdentifier,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 0.02, // 20ms
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    rdsReadLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlertsTopic));

    // ==================== APPLICATION ALARMS ====================
    // Monitor custom application metrics from logs.

    const appErrorsAlarm = new cloudwatch.Alarm(this, 'AppErrorsAlarm', {
      alarmName: `${environment}-application-errors`,
      alarmDescription: 'High number of application errors in logs',
      metric: new cloudwatch.Metric({
        namespace: `AudioLibrary/${environment}`,
        metricName: 'ApplicationErrors',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: isProd ? 20 : 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    appErrorsAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.warningAlertsTopic));

    // ==================== CLOUDWATCH DASHBOARD ====================
    // Operational dashboard for at-a-glance monitoring.

    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `AudioLibrary-${environment}`,
    });

    // Dashboard Header
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# Audio Library - ${environment.toUpperCase()} Environment\nReal-time operational metrics and health status`,
        width: 24,
        height: 1,
      })
    );

    // Row 1: Service Health Overview
    this.dashboard.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        title: 'Alarm Status',
        alarms: [
          ecsCpuAlarm,
          ecsMemoryAlarm,
          ecsNoTasksAlarm,
          alb5xxAlarm,
          albLatencyAlarm,
          rdsCpuAlarm,
          rdsStorageAlarm,
        ],
        width: 8,
        height: 4,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Running Tasks',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'RunningTaskCount',
            dimensionsMap: {
              ClusterName: ecsCluster.clusterName,
              ServiceName: ecsService.serviceName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 4,
        height: 4,
      }),
      new cloudwatch.GraphWidget({
        title: 'Request Count',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'RequestCount',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 12,
        height: 4,
      })
    );

    // Row 2: ECS Metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ECS CPU Utilization',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              ClusterName: ecsCluster.clusterName,
              ServiceName: ecsService.serviceName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        leftYAxis: { min: 0, max: 100 },
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Memory Utilization',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'MemoryUtilization',
            dimensionsMap: {
              ClusterName: ecsCluster.clusterName,
              ServiceName: ecsService.serviceName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        leftYAxis: { min: 0, max: 100 },
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Task Count',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'RunningTaskCount',
            dimensionsMap: {
              ClusterName: ecsCluster.clusterName,
              ServiceName: ecsService.serviceName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ECS',
            metricName: 'DesiredTaskCount',
            dimensionsMap: {
              ClusterName: ecsCluster.clusterName,
              ServiceName: ecsService.serviceName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
        height: 6,
      })
    );

    // Row 3: Load Balancer Metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Response Time (p95)',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'TargetResponseTime',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            statistic: 'p95',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'HTTP Responses',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_2XX_Count',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
            label: '2xx',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_4XX_Count',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
            label: '4xx',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_5XX_Count',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
            label: '5xx',
          }),
        ],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Healthy vs Unhealthy Targets',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HealthyHostCount',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
            label: 'Healthy',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'UnHealthyHostCount',
            dimensionsMap: {
              LoadBalancer: loadBalancer.loadBalancerFullName,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
            label: 'Unhealthy',
          }),
        ],
        width: 8,
        height: 6,
      })
    );

    // Row 4: Database Metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'RDS CPU Utilization',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              DBInstanceIdentifier: database.instanceIdentifier,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        leftYAxis: { min: 0, max: 100 },
        width: 6,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Database Connections',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'DatabaseConnections',
            dimensionsMap: {
              DBInstanceIdentifier: database.instanceIdentifier,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 6,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'RDS Free Storage',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'FreeStorageSpace',
            dimensionsMap: {
              DBInstanceIdentifier: database.instanceIdentifier,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 6,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'RDS Read/Write Latency',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'ReadLatency',
            dimensionsMap: {
              DBInstanceIdentifier: database.instanceIdentifier,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
            label: 'Read',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'WriteLatency',
            dimensionsMap: {
              DBInstanceIdentifier: database.instanceIdentifier,
            },
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
            label: 'Write',
          }),
        ],
        width: 6,
        height: 6,
      })
    );

    // Row 5: Application Metrics (from logs)
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Application Errors (from logs)',
        left: [
          new cloudwatch.Metric({
            namespace: `AudioLibrary/${environment}`,
            metricName: 'ApplicationErrors',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 12,
        height: 6,
      }),
      new cloudwatch.LogQueryWidget({
        title: 'Recent Errors',
        logGroupNames: [backendLogGroup.logGroupName],
        queryLines: [
          'fields @timestamp, @message',
          'filter @message like /ERROR|Exception|FATAL/',
          'sort @timestamp desc',
          'limit 20',
        ],
        width: 12,
        height: 6,
      })
    );

    // ==================== OUTPUTS ====================

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: `${id}-DashboardUrl`,
    });

    new cdk.CfnOutput(this, 'CriticalAlertsTopicArn', {
      value: this.criticalAlertsTopic.topicArn,
      description: 'SNS topic ARN for critical alerts',
      exportName: `${id}-CriticalAlertsArn`,
    });

    new cdk.CfnOutput(this, 'WarningAlertsTopicArn', {
      value: this.warningAlertsTopic.topicArn,
      description: 'SNS topic ARN for warning alerts',
      exportName: `${id}-WarningAlertsArn`,
    });
  }
}


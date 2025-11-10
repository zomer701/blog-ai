import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export interface MonitoringStackProps extends cdk.StackProps {
  scraperFunction: lambda.IFunction;
  adminApiFunction: lambda.IFunction;
  articlesTable: dynamodb.ITable;
  analyticsTable: dynamodb.ITable;
  alarmEmail: string;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // ========================================
    // SNS Topic for Alarms
    // ========================================

    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'AI Blog System Alarms',
      topicName: 'ai-blog-alarms',
    });

    // Subscribe email to alarm topic
    alarmTopic.addSubscription(
      new subscriptions.EmailSubscription(props.alarmEmail)
    );

    // ========================================
    // Lambda Alarms
    // ========================================

    // Scraper Lambda Errors
    const scraperErrorAlarm = new cloudwatch.Alarm(this, 'ScraperErrorAlarm', {
      alarmName: 'ai-blog-scraper-errors',
      alarmDescription: 'Alert when scraper Lambda has errors',
      metric: props.scraperFunction.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    scraperErrorAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // Scraper Lambda Duration (timeout warning)
    const scraperDurationAlarm = new cloudwatch.Alarm(this, 'ScraperDurationAlarm', {
      alarmName: 'ai-blog-scraper-duration',
      alarmDescription: 'Alert when scraper is taking too long',
      metric: props.scraperFunction.metricDuration({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 600000, // 10 minutes (in milliseconds)
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    scraperDurationAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // Admin API Lambda Errors
    const adminApiErrorAlarm = new cloudwatch.Alarm(this, 'AdminApiErrorAlarm', {
      alarmName: 'ai-blog-admin-api-errors',
      alarmDescription: 'Alert when admin API has errors',
      metric: props.adminApiFunction.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    adminApiErrorAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // Admin API Lambda Throttles
    const adminApiThrottleAlarm = new cloudwatch.Alarm(this, 'AdminApiThrottleAlarm', {
      alarmName: 'ai-blog-admin-api-throttles',
      alarmDescription: 'Alert when admin API is being throttled',
      metric: props.adminApiFunction.metricThrottles({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    adminApiThrottleAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // ========================================
    // DynamoDB Alarms
    // ========================================

    // Articles Table Read Throttles
    const articlesReadThrottleAlarm = new cloudwatch.Alarm(this, 'ArticlesReadThrottleAlarm', {
      alarmName: 'ai-blog-articles-read-throttles',
      alarmDescription: 'Alert when Articles table reads are throttled',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'UserErrors',
        dimensionsMap: {
          TableName: props.articlesTable.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    articlesReadThrottleAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // ========================================
    // CloudWatch Dashboard
    // ========================================

    const dashboard = new cloudwatch.Dashboard(this, 'AIBlogDashboard', {
      dashboardName: 'AI-Blog-System',
    });

    // Lambda Metrics Row
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Scraper Lambda Invocations',
        left: [
          props.scraperFunction.metricInvocations({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Scraper Lambda Errors',
        left: [
          props.scraperFunction.metricErrors({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
          }),
        ],
        width: 12,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Scraper Lambda Duration',
        left: [
          props.scraperFunction.metricDuration({
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Admin API Invocations',
        left: [
          props.adminApiFunction.metricInvocations({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
      })
    );

    // DynamoDB Metrics Row
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Articles Table Read/Write Units',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: {
              TableName: props.articlesTable.tableName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: 'Read Units',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: {
              TableName: props.articlesTable.tableName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: 'Write Units',
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB User Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'UserErrors',
            dimensionsMap: {
              TableName: props.articlesTable.tableName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            color: cloudwatch.Color.RED,
          }),
        ],
        width: 12,
      })
    );

    // Custom Metrics Row (if you add custom metrics in your code)
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Total Articles Scraped (24h)',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AIBlog',
            metricName: 'ArticlesScraped',
            statistic: 'Sum',
            period: cdk.Duration.hours(24),
          }),
        ],
        width: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Articles Pending Review',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AIBlog',
            metricName: 'ArticlesPending',
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Translation Success Rate',
        metrics: [
          new cloudwatch.MathExpression({
            expression: '(success / (success + failures)) * 100',
            usingMetrics: {
              success: new cloudwatch.Metric({
                namespace: 'AIBlog',
                metricName: 'TranslationSuccess',
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
              }),
              failures: new cloudwatch.Metric({
                namespace: 'AIBlog',
                metricName: 'TranslationFailure',
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
              }),
            },
          }),
        ],
        width: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Avg Scrape Duration (min)',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AIBlog',
            metricName: 'ScrapeDuration',
            statistic: 'Average',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 6,
      })
    );

    // ========================================
    // Outputs
    // ========================================

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';

export class AiBlogInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // DynamoDB Tables
    // ========================================

    // Articles Table
    const articlesTable = new dynamodb.Table(this, 'ArticlesTable', {
      tableName: 'ArticlesTable',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // Add GSI for status-based queries
    articlesTable.addGlobalSecondaryIndex({
      indexName: 'status-created_at-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
    });

    // Analytics Table
    const analyticsTable = new dynamodb.Table(this, 'AnalyticsTable', {
      tableName: 'AnalyticsTable',
      partitionKey: { name: 'article_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl', // Auto-delete old analytics after 90 days
    });

    // ========================================
    // S3 Buckets
    // ========================================

    // Content Bucket (images, HTML files)
    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      bucketName: `ai-blog-content-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // // Public Website Bucket (with staging, production, backups)
    // const publicWebsiteBucket = new s3.Bucket(this, 'PublicWebsiteBucket', {
    //   bucketName: `ai-blog-public-${this.account}`,
    //   versioned: true,
    //   encryption: s3.BucketEncryption.S3_MANAGED,
    //   blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    //   removalPolicy: cdk.RemovalPolicy.RETAIN,
    //   lifecycleRules: [
    //     {
    //       // Keep backups for 30 days
    //       prefix: 'backups/',
    //       expiration: cdk.Duration.days(30),
    //     },
    //   ],
    // });

    // Admin UI Bucket
    // const adminUiBucket = new s3.Bucket(this, 'AdminUiBucket', {
    //   bucketName: `ai-blog-admin-ui-${this.account}`,
    //   websiteIndexDocument: 'index.html',
    //   websiteErrorDocument: 'index.html',
    //   publicReadAccess: false,
    //   blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    //   removalPolicy: cdk.RemovalPolicy.RETAIN,
    // });

    // ========================================
    // Cognito User Pool
    // ========================================

    // const userPool = new cognito.UserPool(this, 'AdminUserPool', {
    //   userPoolName: 'ai-blog-admin-users',
    //   selfSignUpEnabled: false,
    //   signInAliases: {
    //     email: true,
    //   },
    //   autoVerify: {
    //     email: true,
    //   },
    //   passwordPolicy: {
    //     minLength: 8,
    //     requireLowercase: true,
    //     requireUppercase: true,
    //     requireDigits: true,
    //     requireSymbols: false,
    //   },
    //   accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    //   removalPolicy: cdk.RemovalPolicy.RETAIN,
    // });

    // const userPoolClient = new cognito.UserPoolClient(this, 'AdminUserPoolClient', {
    //   userPool,
    //   authFlows: {
    //     userPassword: true,
    //     userSrp: true,
    //   },
    //   generateSecret: false,
    // });

    // ========================================
    // IAM Roles
    // ========================================

    // Lambda Execution Role
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant permissions to Lambda role
    articlesTable.grantReadWriteData(lambdaExecutionRole);
    analyticsTable.grantReadWriteData(lambdaExecutionRole);
    contentBucket.grantReadWrite(lambdaExecutionRole);
    // publicWebsiteBucket.grantReadWrite(lambdaExecutionRole);

    // Grant Bedrock permissions
    lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: ['*'],
    }));

    // ========================================
    // Lambda Functions
    // ========================================

    // Scraper Lambda Function
    const scraperLambda = new lambda.Function(this, 'ScraperFunction', {
      functionName: 'ai-blog-scraper',
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../scraper-rust/target/lambda/scraper')),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 256,
      environment: {
        TABLE_NAME: articlesTable.tableName,
        BUCKET_NAME: contentBucket.bucketName,
        ANALYTICS_TABLE: analyticsTable.tableName,
        RUST_LOG: 'debug',
      },
    });

    // Admin API Lambda Function
    // const adminApiLambda = new lambda.Function(this, 'AdminApiFunction', {
    //   functionName: 'ai-blog-admin-api',
    //   runtime: lambda.Runtime.PROVIDED_AL2,
    //   handler: 'bootstrap',
    //   code: lambda.Code.fromAsset(path.join(__dirname, '../../blog-service-rust/target/lambda/admin-api')),
    //   role: lambdaExecutionRole,
    //   timeout: cdk.Duration.seconds(30),
    //   memorySize: 256,
    //   environment: {
    //     TABLE_NAME: articlesTable.tableName,
    //     ANALYTICS_TABLE: analyticsTable.tableName,
    //     COGNITO_USER_POOL_ID: userPool.userPoolId,
    //     COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
    //     RUST_LOG: 'info',
    //   },
    // });

    // ========================================
    // API Gateway
    // ========================================

    // const api = new apigateway.RestApi(this, 'AdminApi', {
    //   restApiName: 'AI Blog Admin API',
    //   description: 'API for AI Blog admin operations',
    //   defaultCorsPreflightOptions: {
    //     allowOrigins: apigateway.Cors.ALL_ORIGINS,
    //     allowMethods: apigateway.Cors.ALL_METHODS,
    //     allowHeaders: ['Content-Type', 'Authorization'],
    //   },
    // });

    // Lambda integration
    // const lambdaIntegration = new apigateway.LambdaIntegration(adminApiLambda);

    // // Add routes
    // api.root.addMethod('ANY', lambdaIntegration);
    // api.root.addProxy({
    //   defaultIntegration: lambdaIntegration,
    // });

    // ========================================
    // CloudFront Distribution for Admin UI
    // ========================================

    // const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'AdminUiOAI');
    // adminUiBucket.grantRead(originAccessIdentity);

    // const distribution = new cloudfront.Distribution(this, 'AdminUiDistribution', {
    //   defaultBehavior: {
    //     origin: new origins.S3Origin(adminUiBucket, {
    //       originAccessIdentity,
    //     }),
    //     viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    //     cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    //   },
    //   defaultRootObject: 'index.html',
    //   errorResponses: [
    //     {
    //       httpStatus: 404,
    //       responseHttpStatus: 200,
    //       responsePagePath: '/index.html',
    //     },
    //   ],
    // });

    // // Deploy Admin UI to S3
    // new s3deploy.BucketDeployment(this, 'DeployAdminUi', {
    //   sources: [s3deploy.Source.asset(path.join(__dirname, '../../admin-ui/build'))],
    //   destinationBucket: adminUiBucket,
    //   distribution,
    //   distributionPaths: ['/*'],
    // });

    // ========================================
    // CloudFront Distributions
    // ========================================

    // const publicWebsiteOAI = new cloudfront.OriginAccessIdentity(this, 'PublicWebsiteOAI');
    // publicWebsiteBucket.grantRead(publicWebsiteOAI);

    // // Staging Distribution (Private - for admin preview)
    // const stagingDistribution = new cloudfront.Distribution(this, 'StagingDistribution', {
    //   comment: 'Staging environment for preview',
    //   defaultBehavior: {
    //     origin: new origins.S3Origin(publicWebsiteBucket, {
    //       originPath: '/staging',
    //       originAccessIdentity: publicWebsiteOAI,
    //     }),
    //     viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    //     cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // Always fresh for testing
    //     allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    //   },
    //   defaultRootObject: 'index.html',
    //   errorResponses: [
    //     {
    //       httpStatus: 404,
    //       responseHttpStatus: 200,
    //       responsePagePath: '/index.html',
    //     },
    //   ],
    // });

    // // Production Distribution (Public - live site)
    // const productionDistribution = new cloudfront.Distribution(this, 'ProductionDistribution', {
    //   comment: 'Production environment (public)',
    //   defaultBehavior: {
    //     origin: new origins.S3Origin(publicWebsiteBucket, {
    //       originPath: '/production',
    //       originAccessIdentity: publicWebsiteOAI,
    //     }),
    //     viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    //     cachePolicy: new cloudfront.CachePolicy(this, 'ProductionCachePolicy', {
    //       cachePolicyName: 'BlogProductionCache',
    //       defaultTtl: cdk.Duration.hours(1),
    //       maxTtl: cdk.Duration.days(1),
    //       minTtl: cdk.Duration.minutes(5),
    //       enableAcceptEncodingGzip: true,
    //       enableAcceptEncodingBrotli: true,
    //     }),
    //     allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    //   },
    //   defaultRootObject: 'index.html',
    //   errorResponses: [
    //     {
    //       httpStatus: 404,
    //       responseHttpStatus: 200,
    //       responsePagePath: '/index.html',
    //     },
    //     {
    //       httpStatus: 403,
    //       responseHttpStatus: 200,
    //       responsePagePath: '/index.html',
    //     },
    //   ],
    // });

    // ========================================
    // EventBridge Rule for Scheduled Scraping
    // ========================================

    const scraperRule = new events.Rule(this, 'ScraperScheduleRule', {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      description: 'Trigger scraper every hour',
    });

    scraperRule.addTarget(new targets.LambdaFunction(scraperLambda));

    // ========================================
    // Outputs
    // ========================================

    new cdk.CfnOutput(this, 'ArticlesTableName', {
      value: articlesTable.tableName,
      description: 'DynamoDB Articles Table Name',
    });

    new cdk.CfnOutput(this, 'AnalyticsTableName', {
      value: analyticsTable.tableName,
      description: 'DynamoDB Analytics Table Name',
    });

    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.bucketName,
      description: 'S3 Content Bucket Name',
    });

    // new cdk.CfnOutput(this, 'AdminUiBucketName', {
    //   value: adminUiBucket.bucketName,
    //   description: 'S3 Admin UI Bucket Name',
    // });

    // new cdk.CfnOutput(this, 'UserPoolId', {
    //   value: userPool.userPoolId,
    //   description: 'Cognito User Pool ID',
    // });

    // new cdk.CfnOutput(this, 'UserPoolClientId', {
    //   value: userPoolClient.userPoolClientId,
    //   description: 'Cognito User Pool Client ID',
    // });

    // new cdk.CfnOutput(this, 'ApiUrl', {
    //   value: api.url,
    //   description: 'Admin API Gateway URL',
    // });

    // new cdk.CfnOutput(this, 'AdminUiUrl', {
    //   value: `https://${distribution.distributionDomainName}`,
    //   description: 'Admin UI CloudFront URL',
    // });

    new cdk.CfnOutput(this, 'ScraperFunctionName', {
      value: scraperLambda.functionName,
      description: 'Scraper Lambda Function Name',
    });

    // new cdk.CfnOutput(this, 'AdminApiFunctionName', {
    //   value: adminApiLambda.functionName,
    //   description: 'Admin API Lambda Function Name',
    // });

    // new cdk.CfnOutput(this, 'PublicWebsiteBucketName', {
    //   value: publicWebsiteBucket.bucketName,
    //   description: 'Public Website S3 Bucket Name',
    // });

    // new cdk.CfnOutput(this, 'StagingUrl', {
    //   value: `https://${stagingDistribution.distributionDomainName}`,
    //   description: 'Staging Website URL (Private Preview)',
    //   exportName: 'StagingWebsiteUrl',
    // });

    // new cdk.CfnOutput(this, 'StagingDistributionId', {
    //   value: stagingDistribution.distributionId,
    //   description: 'Staging CloudFront Distribution ID',
    //   exportName: 'StagingDistributionId',
    // });

    // new cdk.CfnOutput(this, 'ProductionUrl', {
    //   value: `https://${productionDistribution.distributionDomainName}`,
    //   description: 'Production Website URL (Public)',
    //   exportName: 'ProductionWebsiteUrl',
    // });

    // new cdk.CfnOutput(this, 'ProductionDistributionId', {
    //   value: productionDistribution.distributionId,
    //   description: 'Production CloudFront Distribution ID',
    //   exportName: 'ProductionDistributionId',
    // });
  }
}

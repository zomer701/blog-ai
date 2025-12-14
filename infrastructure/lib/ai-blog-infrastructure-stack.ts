import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cr from 'aws-cdk-lib/custom-resources';
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

    // Snapshot Bucket (private storage for fallback HTML)
    const snapshotBucket = new s3.Bucket(this, 'SnapshotBucket', {
      bucketName: `ai-blog-snapshots-${this.account}`,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Public Site Bucket (static blog pages)
    const publicSiteBucket = new s3.Bucket(this, 'PublicSiteBucket', {
      bucketName: `ai-blog-public-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const oac = new cloudfront.CfnOriginAccessControl(this, 'PublicSiteOAC', {
      originAccessControlConfig: {
        name: `public-site-oac-${this.account}`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    const distribution = new cloudfront.CfnDistribution(this, 'PublicSiteDistribution', {
      distributionConfig: {
        enabled: true,
        defaultRootObject: 'index.html',
        origins: [
          {
            id: 'PublicSiteOrigin',
            domainName: publicSiteBucket.bucketRegionalDomainName,
            originAccessControlId: oac.attrId,
            s3OriginConfig: {
              originAccessIdentity: '',
            },
          },
        ],
        defaultCacheBehavior: {
          targetOriginId: 'PublicSiteOrigin',
          viewerProtocolPolicy: 'redirect-to-https',
          allowedMethods: ['GET', 'HEAD'],
          cachedMethods: ['GET', 'HEAD'],
          cachePolicyId: cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
          compress: true,
        },
        priceClass: 'PriceClass_All',
      },
    });

    // CloudFront is a global service (no region component in ARN)
    const distributionArn = `arn:${cdk.Aws.PARTITION}:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${distribution.ref}`;

    publicSiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [publicSiteBucket.arnForObjects('*')],
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': distributionArn,
          },
        },
      })
    );

    // Allow CloudFront to resolve default root objects without exposing the bucket
    publicSiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [publicSiteBucket.bucketArn],
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': distributionArn,
          },
        },
      })
    );

    // Upload prebuilt Next.js static export (expects blog-public/out to exist)
    const staticDeployment = new s3deploy.BucketDeployment(this, 'PublicSiteDeployment', {
      destinationBucket: publicSiteBucket,
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../blog-public/out'))],
      prune: true, // remove old files so 404s stay in sync
    });

    const articleExtensionlessDeployment = new s3deploy.BucketDeployment(
      this,
      'ArticleExtensionlessMetadataDeployment',
      {
        destinationBucket: publicSiteBucket,
        destinationKeyPrefix: 'article',
        sources: [
          s3deploy.Source.asset(path.join(__dirname, '../../blog-public/out/article'), {
            exclude: ['*.html', '*.txt', '__article_data/*'],
          }),
        ],
        prune: false, // prevent removing the already deployed html/txt variants
        contentType: 'text/html', // ensure extensionless files render as HTML
      }
    );
    articleExtensionlessDeployment.node.addDependency(staticDeployment);

    // CloudFront invalidation after each deploy to pick up fresh HTML/assets
    const invalidate = new cr.AwsCustomResource(this, 'PublicSiteInvalidation', {
      onUpdate: {
        service: 'CloudFront',
        action: 'createInvalidation',
        parameters: {
          DistributionId: distribution.ref,
          InvalidationBatch: {
            CallerReference: `${Date.now()}`,
            Paths: { Quantity: 1, Items: ['/*'] },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of(`PublicSiteInvalidation-${Date.now()}`),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
    invalidate.node.addDependency(staticDeployment);
    invalidate.node.addDependency(articleExtensionlessDeployment);

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
    contentBucket.grantReadWrite(lambdaExecutionRole);
    snapshotBucket.grantRead(lambdaExecutionRole);
    publicSiteBucket.grantReadWrite(lambdaExecutionRole);

    // ========================================
    // Lambda Functions
    // ========================================

    // Scraper Lambda Function (zip, provided.al2 runtime)
    const scraperLambda = new lambda.Function(this, 'ScraperFunction', {
      functionName: 'ai-blog-serverless-scraper',
      runtime: lambda.Runtime.PROVIDED_AL2,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../serverless/target/lambda/serverless')),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 256,
      environment: {
        TABLE_NAME: articlesTable.tableName,
        BUCKET_NAME: contentBucket.bucketName,
        RUST_LOG: 'debug',
        // Provide SCRAPEDO_TOKEN via environment/secrets at deploy time.
        SCRAPEDO_TOKEN: process.env.SCRAPEDO_TOKEN ?? '',
        SNAPSHOT_BUCKET: snapshotBucket.bucketName,
      },
    });

    // Publisher Lambda Function (stub to update static site bucket)
    const publisherLambda = new lambda.Function(this, 'PublisherFunction', {
      functionName: 'ai-blog-site-publisher',
      runtime: lambda.Runtime.PROVIDED_AL2,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../serverless/target/lambda/site_publisher')),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        PUBLIC_SITE_BUCKET: publicSiteBucket.bucketName,
        RUST_LOG: 'info',
      },
    });

    // ========================================
    // Outputs
    // ========================================

    new cdk.CfnOutput(this, 'ArticlesTableName', {
      value: articlesTable.tableName,
      description: 'DynamoDB Articles Table Name',
    });

    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.bucketName,
      description: 'S3 Content Bucket Name',
    });

    new cdk.CfnOutput(this, 'SnapshotBucketName', {
      value: snapshotBucket.bucketName,
      description: 'Private snapshot bucket for fallback crawler',
    });

    new cdk.CfnOutput(this, 'PublicSiteBucketName', {
      value: publicSiteBucket.bucketName,
      description: 'S3 bucket for static blog pages (public site)',
    });
    new cdk.CfnOutput(this, 'PublicSiteBucketRegionalDomain', {
      value: publicSiteBucket.bucketRegionalDomainName,
      description: 'Regional domain name for Cloudflare custom origin',
    });

    new cdk.CfnOutput(this, 'PublicSiteDistributionDomain', {
      value: distribution.attrDomainName,
      description: 'CloudFront domain for the static site',
    });

    new cdk.CfnOutput(this, 'ScraperFunctionName', {
      value: scraperLambda.functionName,
      description: 'Scraper Lambda Function Name',
    });

    new cdk.CfnOutput(this, 'PublisherFunctionName', {
      value: publisherLambda.functionName,
      description: 'Publisher Lambda Function Name',
    });
  }
}

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SmartPublishingStackProps extends cdk.StackProps {
  contentBucket: s3.Bucket;
  productionDistribution: cloudfront.Distribution;
}

export class SmartPublishingStack extends cdk.Stack {
  public readonly stagingDistribution: cloudfront.Distribution;
  
  constructor(scope: Construct, id: string, props: SmartPublishingStackProps) {
    super(scope, id, props);
    
    const { contentBucket, productionDistribution } = props;
    
    // ========================================
    // S3 Lifecycle Rules for Backups
    // ========================================
    
    contentBucket.addLifecycleRule({
      id: 'DeleteOldBackups',
      prefix: 'backups/',
      expiration: cdk.Duration.days(30),
      enabled: true,
    });
    
    // ========================================
    // Staging CloudFront Distribution
    // ========================================
    
    // Origin Access Identity for staging
    const stagingOAI = new cloudfront.OriginAccessIdentity(this, 'StagingOAI', {
      comment: 'OAI for staging distribution',
    });
    
    // Grant read access to staging prefix
    contentBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [contentBucket.arnForObjects('staging/*')],
      principals: [stagingOAI.grantPrincipal],
    }));
    
    // Staging distribution (private, no caching)
    this.stagingDistribution = new cloudfront.Distribution(this, 'StagingDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(contentBucket, {
          originPath: '/staging',
          originAccessIdentity: stagingOAI,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // Always fresh for preview
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress: true,
      },
      defaultRootObject: 'index.html',
      comment: 'Staging environment (private preview)',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });
    
    // ========================================
    // CloudFront Invalidation Permissions
    // ========================================
    
    // Create IAM policy for CloudFront invalidation
    const invalidationPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudfront:CreateInvalidation',
        'cloudfront:GetInvalidation',
        'cloudfront:ListInvalidations',
      ],
      resources: [
        `arn:aws:cloudfront::${this.account}:distribution/${productionDistribution.distributionId}`,
        `arn:aws:cloudfront::${this.account}:distribution/${this.stagingDistribution.distributionId}`,
      ],
    });
    
    // ========================================
    // Outputs
    // ========================================
    
    new cdk.CfnOutput(this, 'StagingDistributionId', {
      value: this.stagingDistribution.distributionId,
      description: 'Staging CloudFront Distribution ID',
      exportName: 'StagingDistributionId',
    });
    
    new cdk.CfnOutput(this, 'StagingDistributionDomain', {
      value: this.stagingDistribution.distributionDomainName,
      description: 'Staging CloudFront Distribution Domain',
      exportName: 'StagingDistributionDomain',
    });
    
    new cdk.CfnOutput(this, 'StagingUrl', {
      value: `https://${this.stagingDistribution.distributionDomainName}`,
      description: 'Staging Environment URL',
    });
    
    new cdk.CfnOutput(this, 'ProductionDistributionId', {
      value: productionDistribution.distributionId,
      description: 'Production CloudFront Distribution ID',
      exportName: 'ProductionDistributionId',
    });
    
    new cdk.CfnOutput(this, 'InvalidationPolicyArn', {
      value: invalidationPolicy.sid || 'CloudFrontInvalidationPolicy',
      description: 'IAM Policy for CloudFront Invalidation',
    });
    
    // ========================================
    // Tags
    // ========================================
    
    cdk.Tags.of(this).add('Component', 'SmartPublishing');
    cdk.Tags.of(this).add('Environment', 'Multi');
  }
}

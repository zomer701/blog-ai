/**
 * Centralized environment configuration for all stacks
 */

export interface EnvironmentConfig {
  // Environment
  environment: 'dev' | 'staging' | 'prod';
  
  // AWS
  region: string;
  account?: string;
  
  // DynamoDB
  articlesTableName: string;
  analyticsTableName: string;
  
  // S3
  contentBucketName: string;
  publicWebsiteBucketName: string;
  adminUiBucketName: string;
  
  // Lambda
  scraperMemorySize: number;
  scraperTimeout: number; // seconds
  adminApiMemorySize: number;
  adminApiTimeout: number;
  
  // Scraper Configuration
  maxArticlesPerSite: number;
  scraperSchedule: string; // EventBridge schedule expression
  
  // Cognito
  userPoolName: string;
  
  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logRetentionDays: number;
  
  // Features
  enablePointInTimeRecovery: boolean;
  enableVersioning: boolean;
  enableAnalytics: boolean;
}

/**
 * Development environment configuration
 */
export const devConfig: EnvironmentConfig = {
  environment: 'dev',
  region: 'us-east-1',
  
  // DynamoDB
  articlesTableName: 'ArticlesTable-Dev',
  analyticsTableName: 'AnalyticsTable-Dev',
  
  // S3
  contentBucketName: 'ai-blog-content-dev',
  publicWebsiteBucketName: 'ai-blog-public-dev',
  adminUiBucketName: 'ai-blog-admin-ui-dev',
  
  // Lambda
  scraperMemorySize: 512,
  scraperTimeout: 900, // 15 minutes
  adminApiMemorySize: 256,
  adminApiTimeout: 30,
  
  // Scraper
  maxArticlesPerSite: 5,
  scraperSchedule: 'rate(6 hours)', // Every 6 hours for dev
  
  // Cognito
  userPoolName: 'ai-blog-admin-users-dev',
  
  // Logging
  logLevel: 'debug',
  logRetentionDays: 3,
  
  // Features
  enablePointInTimeRecovery: false,
  enableVersioning: false,
  enableAnalytics: true,
};

/**
 * Production environment configuration
 */
export const prodConfig: EnvironmentConfig = {
  environment: 'prod',
  region: 'us-east-1',
  
  // DynamoDB
  articlesTableName: 'ArticlesTable',
  analyticsTableName: 'AnalyticsTable',
  
  // S3
  contentBucketName: 'ai-blog-content',
  publicWebsiteBucketName: 'ai-blog-public',
  adminUiBucketName: 'ai-blog-admin-ui',
  
  // Lambda
  scraperMemorySize: 512,
  scraperTimeout: 900,
  adminApiMemorySize: 256,
  adminApiTimeout: 30,
  
  // Scraper
  maxArticlesPerSite: 10,
  scraperSchedule: 'cron(0 9 * * ? *)', // Daily at 9 AM UTC
  
  // Cognito
  userPoolName: 'ai-blog-admin-users',
  
  // Logging
  logLevel: 'info',
  logRetentionDays: 7,
  
  // Features
  enablePointInTimeRecovery: true,
  enableVersioning: true,
  enableAnalytics: true,
};

/**
 * Get configuration for the specified environment
 */
export function getConfig(env?: string): EnvironmentConfig {
  const environment = env || process.env.ENVIRONMENT || 'dev';
  
  switch (environment) {
    case 'prod':
    case 'production':
      return prodConfig;
    case 'dev':
    case 'development':
    default:
      return devConfig;
  }
}

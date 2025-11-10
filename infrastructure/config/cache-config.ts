/**
 * Caching configuration for different environments
 */

export interface CacheConfig {
  // CloudFront
  cloudFrontDefaultTtl: number; // seconds
  cloudFrontMaxTtl: number;
  cloudFrontMinTtl: number;
  
  // API Gateway
  apiGatewayCacheEnabled: boolean;
  apiGatewayCacheTtl: number; // seconds
  apiGatewayCacheSize: string; // '0.5' | '1.6' | '6.1' | '13.5' | '28.4' | '58.2' | '118' | '237'
  
  // Application
  applicationCacheTtl: number; // seconds
  
  // Browser
  browserCacheTtl: number; // seconds
}

/**
 * Development environment - minimal caching
 */
export const devCacheConfig: CacheConfig = {
  // CloudFront
  cloudFrontDefaultTtl: 300, // 5 minutes
  cloudFrontMaxTtl: 3600, // 1 hour
  cloudFrontMinTtl: 60, // 1 minute
  
  // API Gateway
  apiGatewayCacheEnabled: false,
  apiGatewayCacheTtl: 300,
  apiGatewayCacheSize: '0.5',
  
  // Application
  applicationCacheTtl: 300, // 5 minutes
  
  // Browser
  browserCacheTtl: 300, // 5 minutes
};

/**
 * Production environment - aggressive caching
 */
export const prodCacheConfig: CacheConfig = {
  // CloudFront
  cloudFrontDefaultTtl: 3600, // 1 hour
  cloudFrontMaxTtl: 86400, // 24 hours
  cloudFrontMinTtl: 300, // 5 minutes
  
  // API Gateway
  apiGatewayCacheEnabled: true,
  apiGatewayCacheTtl: 300, // 5 minutes
  apiGatewayCacheSize: '0.5',
  
  // Application
  applicationCacheTtl: 600, // 10 minutes
  
  // Browser
  browserCacheTtl: 3600, // 1 hour
};

/**
 * Get cache configuration for environment
 */
export function getCacheConfig(env?: string): CacheConfig {
  const environment = env || process.env.ENVIRONMENT || 'dev';
  
  switch (environment) {
    case 'prod':
    case 'production':
      return prodCacheConfig;
    case 'dev':
    case 'development':
    default:
      return devCacheConfig;
  }
}

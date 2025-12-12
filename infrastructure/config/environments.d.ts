/**
 * Centralized environment configuration for all stacks
 */
export interface EnvironmentConfig {
    environment: 'dev' | 'staging' | 'prod';
    region: string;
    account?: string;
    articlesTableName: string;
    analyticsTableName: string;
    contentBucketName: string;
    publicWebsiteBucketName: string;
    adminUiBucketName: string;
    scraperMemorySize: number;
    scraperTimeout: number;
    adminApiMemorySize: number;
    adminApiTimeout: number;
    maxArticlesPerSite: number;
    scraperSchedule: string;
    userPoolName: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logRetentionDays: number;
    enablePointInTimeRecovery: boolean;
    enableVersioning: boolean;
    enableAnalytics: boolean;
}
/**
 * Development environment configuration
 */
export declare const devConfig: EnvironmentConfig;
/**
 * Production environment configuration
 */
export declare const prodConfig: EnvironmentConfig;
/**
 * Get configuration for the specified environment
 */
export declare function getConfig(env?: string): EnvironmentConfig;

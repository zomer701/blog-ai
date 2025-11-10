#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AiBlogInfrastructureStack } from '../lib/ai-blog-infrastructure-stack';

const app = new cdk.App();

new AiBlogInfrastructureStack(app, 'AiBlogInfrastructureStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'AI Blog Scraper & Republisher - Complete Infrastructure',
});

app.synth();

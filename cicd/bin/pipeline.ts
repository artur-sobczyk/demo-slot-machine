#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SlotMachinePipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

const deployRegion = app.node.tryGetContext('deployRegion') || 'eu-west-1';

new SlotMachinePipelineStack(app, 'SlotMachinePipelineStack', {
  env: {
    region: deployRegion,
  },
});

app.synth();

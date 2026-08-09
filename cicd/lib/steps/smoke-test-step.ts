import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration, pipelines } from 'aws-cdk-lib';

export interface SmokeTestStepProps {
  samStackName: string;
  region: string;
  account: string;
}

export function createSmokeTestStep(props: SmokeTestStepProps): pipelines.CodeBuildStep {
  return new pipelines.CodeBuildStep('SmokeTest', {
    commands: [
      'chmod +x cicd/scripts/smoke-test.sh',
      './cicd/scripts/smoke-test.sh',
    ],
    buildEnvironment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
    },
    env: {
      SAM_STACK_NAME: props.samStackName,
    },
    timeout: Duration.minutes(5),
    rolePolicyStatements: [
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [
          `arn:aws:cloudformation:${props.region}:${props.account}:stack/${props.samStackName}/*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: [
          'amplify:GetApp',
          'amplify:GetBranch',
          'amplify:ListApps',
          'amplify:ListBranches',
        ],
        resources: [
          `arn:aws:amplify:${props.region}:${props.account}:apps/*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [
          `arn:aws:logs:${props.region}:${props.account}:log-group:/aws/codebuild/*`,
        ],
      }),
    ],
  });
}

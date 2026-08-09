import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import { pipelines } from 'aws-cdk-lib';

export interface BuildStepProps {
  input: pipelines.CodePipelineSource;
  samStackName: string;
  region: string;
  account: string;
}

export function createBuildStep(props: BuildStepProps): pipelines.CodeBuildStep {
  return new pipelines.CodeBuildStep('Build', {
    input: props.input,
    commands: [
      'chmod +x cicd/scripts/build.sh',
      './cicd/scripts/build.sh',
    ],
    buildEnvironment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
    },
    env: {
      SAM_STACK_NAME: props.samStackName,
    },
    primaryOutputDirectory: 'backend/.aws-sam/build',
    rolePolicyStatements: [
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [
          `arn:aws:cloudformation:${props.region}:${props.account}:stack/${props.samStackName}/*`,
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

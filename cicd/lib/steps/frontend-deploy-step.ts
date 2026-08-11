import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import { pipelines } from 'aws-cdk-lib';

export interface FrontendDeployStepProps {
  input: pipelines.CodePipelineSource;
  samStackName: string;
  region: string;
  account: string;
}

export function createFrontendDeployStep(props: FrontendDeployStepProps): pipelines.CodeBuildStep {
  return new pipelines.CodeBuildStep('FrontendDeploy', {
    input: props.input,
    commands: [
      'chmod +x cicd/scripts/deploy-frontend.sh',
      './cicd/scripts/deploy-frontend.sh',
    ],
    buildEnvironment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
    },
    env: {
      SAM_STACK_NAME: props.samStackName,
      AWS_DEFAULT_REGION: props.region,
    },
    rolePolicyStatements: [
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [
          `arn:aws:cloudformation:${props.region}:${props.account}:stack/${props.samStackName}/*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: [
          'amplify:CreateDeployment',
          'amplify:StartDeployment',
        ],
        resources: [
          `arn:aws:amplify:${props.region}:${props.account}:apps/*`,
          `arn:aws:amplify:${props.region}:${props.account}:apps/*/branches/*`,
          `arn:aws:amplify:${props.region}:${props.account}:apps/*/branches/*/deployments/*`,
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

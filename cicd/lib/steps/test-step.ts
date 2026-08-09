import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import { pipelines } from 'aws-cdk-lib';

export interface TestStepProps {
  input: pipelines.CodePipelineSource;
  region: string;
  account: string;
}

export function createTestStep(props: TestStepProps): pipelines.CodeBuildStep {
  return new pipelines.CodeBuildStep('Test', {
    input: props.input,
    commands: [
      'chmod +x cicd/scripts/test.sh',
      './cicd/scripts/test.sh',
    ],
    buildEnvironment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
    },
    partialBuildSpec: codebuild.BuildSpec.fromObject({
      reports: {
        BackendTestReports: {
          files: ['backend-results.xml', 'backend-seed-results.xml'],
          'file-format': 'JUNITXML',
        },
        FrontendTestReports: {
          files: ['frontend-results.xml'],
          'file-format': 'JUNITXML',
        },
      },
    }),
    rolePolicyStatements: [
      new iam.PolicyStatement({
        actions: [
          'codebuild:CreateReportGroup',
          'codebuild:CreateReport',
          'codebuild:UpdateReport',
          'codebuild:BatchPutTestCases',
          'codebuild:BatchPutCodeCoverages',
        ],
        resources: [
          `arn:aws:codebuild:${props.region}:${props.account}:report-group/*`,
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

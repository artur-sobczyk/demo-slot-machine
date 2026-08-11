import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import { pipelines } from 'aws-cdk-lib';

export interface BackendDeployStepProps {
  input: pipelines.CodePipelineSource;
  samStackName: string;
  customDomain: string;
  region: string;
  account: string;
}

export function createBackendDeployStep(props: BackendDeployStepProps): pipelines.CodeBuildStep {
  return new pipelines.CodeBuildStep('BackendDeploy', {
    input: props.input,
    commands: [
      'chmod +x cicd/scripts/deploy-backend.sh',
      './cicd/scripts/deploy-backend.sh',
    ],
    buildEnvironment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
    },
    env: {
      SAM_STACK_NAME: props.samStackName,
      CUSTOM_DOMAIN: props.customDomain,
      AWS_DEFAULT_REGION: props.region,
    },
    rolePolicyStatements: [
      new iam.PolicyStatement({
        actions: [
          'cloudformation:CreateStack',
          'cloudformation:UpdateStack',
          'cloudformation:DeleteStack',
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
          'cloudformation:GetTemplate',
          'cloudformation:GetTemplateSummary',
          'cloudformation:CreateChangeSet',
          'cloudformation:DescribeChangeSet',
          'cloudformation:ExecuteChangeSet',
          'cloudformation:DeleteChangeSet',
          'cloudformation:ListStackResources',
          'cloudformation:SetStackPolicy',
          'cloudformation:ValidateTemplate',
        ],
        resources: [
          `arn:aws:cloudformation:${props.region}:${props.account}:stack/${props.samStackName}/*`,
          `arn:aws:cloudformation:${props.region}:${props.account}:stack/aws-sam-cli-managed-default/*`,
          `arn:aws:cloudformation:${props.region}:aws:transform/Serverless-*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: [
          'lambda:CreateFunction',
          'lambda:UpdateFunctionCode',
          'lambda:UpdateFunctionConfiguration',
          'lambda:DeleteFunction',
          'lambda:GetFunction',
          'lambda:GetFunctionConfiguration',
          'lambda:ListTags',
          'lambda:TagResource',
          'lambda:UntagResource',
          'lambda:AddPermission',
          'lambda:RemovePermission',
          'lambda:PublishVersion',
          'lambda:CreateAlias',
          'lambda:UpdateAlias',
          'lambda:DeleteAlias',
        ],
        resources: [
          `arn:aws:lambda:${props.region}:${props.account}:function:${props.samStackName}*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: [
          'dynamodb:CreateTable',
          'dynamodb:UpdateTable',
          'dynamodb:DeleteTable',
          'dynamodb:DescribeTable',
          'dynamodb:ListTagsOfResource',
          'dynamodb:TagResource',
          'dynamodb:UntagResource',
        ],
        resources: [
          `arn:aws:dynamodb:${props.region}:${props.account}:table/${props.samStackName}*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: [
          'cognito-identity:CreateIdentityPool',
          'cognito-identity:DeleteIdentityPool',
          'cognito-identity:DescribeIdentityPool',
          'cognito-identity:UpdateIdentityPool',
          'cognito-identity:SetIdentityPoolRoles',
          'cognito-identity:GetIdentityPoolRoles',
          'cognito-identity:ListTagsForResource',
          'cognito-identity:TagResource',
          'cognito-identity:UntagResource',
        ],
        resources: [
          `arn:aws:cognito-identity:${props.region}:${props.account}:identitypool/${props.samStackName}*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: [
          'iam:CreateRole',
          'iam:DeleteRole',
          'iam:GetRole',
          'iam:UpdateRole',
          'iam:PutRolePolicy',
          'iam:DeleteRolePolicy',
          'iam:GetRolePolicy',
          'iam:AttachRolePolicy',
          'iam:DetachRolePolicy',
          'iam:ListRolePolicies',
          'iam:ListAttachedRolePolicies',
          'iam:TagRole',
          'iam:UntagRole',
          'iam:PassRole',
        ],
        resources: [
          `arn:aws:iam::${props.account}:role/${props.samStackName}*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: [
          'amplify:CreateDeployment',
          'amplify:StartDeployment',
          'amplify:GetApp',
          'amplify:GetBranch',
          'amplify:ListApps',
          'amplify:ListBranches',
          'amplify:CreateApp',
          'amplify:UpdateApp',
          'amplify:DeleteApp',
          'amplify:CreateBranch',
          'amplify:UpdateBranch',
          'amplify:DeleteBranch',
        ],
        resources: [
          `arn:aws:amplify:${props.region}:${props.account}:apps/*`,
          `arn:aws:amplify:${props.region}:${props.account}:apps/*/branches/*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:GetBucketLocation',
          's3:ListBucket',
        ],
        resources: [
          'arn:aws:s3:::aws-sam-cli-managed-default-samclisourcebucket-*',
          'arn:aws:s3:::aws-sam-cli-managed-default-samclisourcebucket-*/*',
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

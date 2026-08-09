import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codestarconnections from 'aws-cdk-lib/aws-codestarconnections';
import * as logs from 'aws-cdk-lib/aws-logs';
import { IAspect, pipelines } from 'aws-cdk-lib';
import { Construct, IConstruct } from 'constructs';
import { DeployStage } from './deploy-stage';
import { createTestStep } from './steps/test-step';
import { createBuildStep } from './steps/build-step';
import { createBackendDeployStep } from './steps/backend-deploy-step';
import { createFrontendDeployStep } from './steps/frontend-deploy-step';
import { createSmokeTestStep } from './steps/smoke-test-step';

/**
 * CDK Aspect that sets 30-day CloudWatch Logs retention on all CodeBuild project log groups.
 */
class CodeBuildLogRetentionAspect implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof codebuild.CfnProject) {
      const logGroup = new logs.LogGroup(node, 'LogRetention', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });

      node.logsConfig = {
        cloudWatchLogs: {
          status: 'ENABLED',
          groupName: logGroup.logGroupName,
        },
      };
    }
  }
}

export class SlotMachinePipelineStack extends cdk.Stack {
  public readonly samStackName: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const samStackName = this.node.tryGetContext('samStackName');
    if (!samStackName) {
      throw new Error('CDK context variable "samStackName" is required');
    }

    const deployRegion = this.node.tryGetContext('deployRegion') || 'eu-west-1';

    this.samStackName = samStackName;

    // CodeStar Connection for GitHub authentication
    const connection = new codestarconnections.CfnConnection(this, 'GitHubConnection', {
      connectionName: 'slot-machine-github-connection',
      providerType: 'GitHub',
    });

    // Source stage: checkout main branch via CodeStar Connection
    // triggerOnPush is disabled because we use V2 pipeline triggers with file path filters
    const source = pipelines.CodePipelineSource.connection('artur-sobczyk/demo-slot-machine', 'main', {
      connectionArn: connection.attrConnectionArn,
      triggerOnPush: false,
    });

    // Pipeline with self-mutating synth step
    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      pipelineName: 'SlotMachinePipeline',
      pipelineType: codepipeline.PipelineType.V2,
      synth: new pipelines.ShellStep('Synth', {
        input: source,
        commands: [
          'cd cicd',
          'npm ci',
          'npx cdk synth',
        ],
        primaryOutputDirectory: 'cicd/cdk.out',
      }),
    });

    // Shared props for step factories
    const stepProps = { region: this.region, account: this.account, samStackName };

    // Test wave
    const testStep = createTestStep({ input: source, ...stepProps });
    pipeline.addWave('TestWave', { pre: [testStep] });

    // Build wave
    const buildStep = createBuildStep({ input: source, ...stepProps });
    pipeline.addWave('BuildWave', { pre: [buildStep] });

    // Deploy stage with manual approval gate
    const deployStage = new DeployStage(this, 'Deploy', {
      samStackName,
      env: { region: deployRegion },
    });

    // Deploy and post-deploy steps
    const backendDeployStep = createBackendDeployStep({ input: source, ...stepProps });
    const frontendDeployStep = createFrontendDeployStep({ input: source, ...stepProps });
    const smokeTestStep = createSmokeTestStep(stepProps);

    // Ordering: frontend after backend, smoke test after frontend
    frontendDeployStep.addStepDependency(backendDeployStep);
    smokeTestStep.addStepDependency(frontendDeployStep);

    pipeline.addStage(deployStage, {
      pre: [new pipelines.ManualApprovalStep('ManualApproval')],
      post: [backendDeployStep, frontendDeployStep, smokeTestStep],
    });

    // Build the underlying pipeline so we can access it for triggers
    pipeline.buildPipeline();

    // Add V2 trigger: only start pipeline when backend/, frontend/, or cicd/ files change on main
    pipeline.pipeline.addTrigger({
      providerType: codepipeline.ProviderType.CODE_STAR_SOURCE_CONNECTION,
      gitConfiguration: {
        sourceAction: pipeline.pipeline.stages[0].actions[0],
        pushFilter: [
          {
            branchesIncludes: ['main'],
            filePathsIncludes: ['backend/**', 'frontend/**', 'cicd/**'],
          },
        ],
      },
    });

    // Apply 30-day CloudWatch Logs retention to all CodeBuild projects
    cdk.Aspects.of(this).add(new CodeBuildLogRetentionAspect());
  }
}

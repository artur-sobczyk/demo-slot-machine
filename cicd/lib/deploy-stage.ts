import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DeployStageProps extends cdk.StageProps {
  readonly samStackName: string;
}

export class DeployStage extends cdk.Stage {
  public readonly samStackName: string;

  constructor(scope: Construct, id: string, props: DeployStageProps) {
    super(scope, id, props);

    this.samStackName = props.samStackName;

    // Placeholder stack required by CDK Pipelines (a Stage must contain at least one Stack).
    // Deploy actions (SAM backend + Amplify frontend) will be added in subsequent tasks.
    new cdk.Stack(this, 'DeployStack', {
      stackName: `${props.samStackName}-deploy`,
    });
  }
}

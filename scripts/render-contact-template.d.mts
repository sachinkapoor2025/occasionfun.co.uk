export function renderContactTemplate(template: string, environment: string): string;

export function retrySchedulePermission(template: string): {
  functionName: string;
  requiresReplacement: boolean;
  risks: string[];
  permission: {
    Type: "AWS::Lambda::Permission";
    Properties: {
      Action: "lambda:InvokeFunction";
      FunctionName: { Ref: "ContactRetryFunction" };
      Principal: "events.amazonaws.com";
      SourceArn: { "Fn::GetAtt": ["ContactRetryFunctionRetrySchedule", "Arn"] };
    };
  };
};

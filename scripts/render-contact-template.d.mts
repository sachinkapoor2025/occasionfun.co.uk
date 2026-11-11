export function renderContactTemplate(template: string, environment: string): string;

export function retrySchedulePermission(template: string): {
  functionName: string;
  declaresPermission: boolean;
  requiresReplacement: boolean;
  risks: string[];
};

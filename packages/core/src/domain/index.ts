import { IDEActionPort, TelemetryPort } from '../ports';
export * from './analysis';
export * from './pr-review';

export interface FeatureContext {
  teamId: string;
  environment: 'vscode' | 'jetbrains' | 'cursor';
}

export function executeFeatureAction(
  port: IDEActionPort,
  telemetry: TelemetryPort,
  action: string,
  payload?: unknown
): Promise<unknown> {
  telemetry.recordEvent('feature_action', { action, payload });
  return port.executeCommand(action, payload);
}

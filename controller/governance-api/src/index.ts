import { TelemetryPort } from '@omni/core';

export interface MetricsEvent {
  eventName: string;
  teamId: string;
  timestamp: string;
  environment: 'vscode' | 'jetbrains' | 'cursor';
  data?: Record<string, unknown>;
}

export function createGovernanceApi(telemetry: TelemetryPort) {
  return {
    ingest(event: MetricsEvent): void {
      telemetry.recordEvent(event.eventName, {
        teamId: event.teamId,
        timestamp: event.timestamp,
        environment: event.environment,
        data: event.data,
      });
    },
  };
}

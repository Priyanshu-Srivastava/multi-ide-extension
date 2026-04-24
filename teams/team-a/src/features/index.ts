import { IDEActionPort, TelemetryPort } from '@omni/core';

export function executeTeamAFeature(port: IDEActionPort, telemetry: TelemetryPort) {
  return port.executeCommand('team-a:run', { feature: 'executor-a' });
}

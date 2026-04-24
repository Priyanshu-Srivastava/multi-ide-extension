import { IDEActionPort, TelemetryPort } from '@omni/core';

export function executeTeamDFeature(port: IDEActionPort, telemetry: TelemetryPort) {
  return port.executeCommand('team-d:run', { feature: 'executor-d' });
}

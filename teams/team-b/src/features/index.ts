import { IDEActionPort, TelemetryPort } from '@omni/core';

export function executeTeamBFeature(port: IDEActionPort, telemetry: TelemetryPort) {
  return port.executeCommand('team-b:run', { feature: 'executor-b' });
}

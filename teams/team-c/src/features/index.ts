import { IDEActionPort, TelemetryPort } from '@omni/core';

export function executeTeamCFeature(port: IDEActionPort, telemetry: TelemetryPort) {
  return port.executeCommand('team-c:run', { feature: 'executor-c' });
}

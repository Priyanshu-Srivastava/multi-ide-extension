import { IDEActionPort, TelemetryPort } from '@omni/core';

export function executeTeamDFeature(port: IDEActionPort, _telemetry: TelemetryPort) {
  return port.executeCommand('team-d:run', { feature: 'executor-d' });
}

export { openMathPanel } from './math-panel';

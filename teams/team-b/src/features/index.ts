import { IDEActionPort, TelemetryPort } from '@omni/core';

export function executeTeamBFeature(port: IDEActionPort, _telemetry: TelemetryPort) {
  return port.executeCommand('team-b:run', { feature: 'executor-b' });
}

export { openMathPanel } from './math-panel';

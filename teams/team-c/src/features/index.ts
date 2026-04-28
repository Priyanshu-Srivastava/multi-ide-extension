import { IDEActionPort, TelemetryPort } from '@omni/core';

export function executeTeamCFeature(port: IDEActionPort, _telemetry: TelemetryPort) {
  return port.executeCommand('team-c:run', { feature: 'executor-c' });
}

export { openMathPanel } from './math-panel';
export { createTeamCPrReviewFeature } from './pr-review-visualizer';

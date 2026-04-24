import { TelemetryPort } from '@omni/core';

export class TelemetryService implements TelemetryPort {
  recordEvent(eventName: string, data: Record<string, unknown>): void {
    console.log(`[Telemetry] ${eventName}`, data);
  }
}

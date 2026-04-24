import { IDEActionPort, TelemetryPort } from '@omni/core';

export class CursorAdapter implements IDEActionPort {
  constructor(private telemetry: TelemetryPort) {}

  async executeCommand(command: string, payload?: unknown): Promise<unknown> {
    this.telemetry.recordEvent('cursor_command', { command, payload });
    return { status: 'executed', command, payload };
  }
}

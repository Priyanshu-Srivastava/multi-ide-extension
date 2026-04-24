export interface IDEActionPort {
  executeCommand(command: string, payload?: unknown): Promise<unknown>;
}

export interface TelemetryPort {
  recordEvent(eventName: string, data: Record<string, unknown>): void;
}

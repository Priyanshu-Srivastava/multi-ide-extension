import { TelemetryPort } from '@omni/core';

export class TelemetryService implements TelemetryPort {
  private readonly counters = new Map<string, number>();
  private readonly latencies = new Map<string, number[]>();

  recordEvent(eventName: string, data: Record<string, unknown>): void {
    if (eventName.startsWith('mcp_')) {
      const key = `${eventName}:${JSON.stringify(data)}`;
      this.counters.set(key, (this.counters.get(key) ?? 0) + 1);

      if (eventName === 'mcp_latency_ms' && typeof data.durationMs === 'number') {
        const bucket = this.latencies.get('mcp_latency_ms') ?? [];
        bucket.push(data.durationMs);
        this.latencies.set('mcp_latency_ms', bucket.slice(-1000));

        console.log('[Telemetry] mcp_latency_p95', {
          value: this.getLatencyP95(),
        });
      }
    }

    console.log(`[Telemetry] ${eventName}`, data);
  }

  getCounter(metricKey: string): number {
    return this.counters.get(metricKey) ?? 0;
  }

  getLatencyP95(): number {
    const values = [...(this.latencies.get('mcp_latency_ms') ?? [])].sort((a, b) => a - b);
    if (values.length === 0) {
      return 0;
    }

    const index = Math.ceil(values.length * 0.95) - 1;
    return values[Math.max(index, 0)];
  }
}

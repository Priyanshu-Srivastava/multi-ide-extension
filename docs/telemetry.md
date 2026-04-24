# Metrics & Telemetry

## Overview

Omni ships a lightweight, pluggable telemetry layer built on the `TelemetryPort` interface defined in `@omni/core`. Telemetry is **decoupled from any specific backend** — the concrete implementation (`TelemetryService` in `@omni/telemetry`) can be swapped for Application Insights, Datadog, OpenTelemetry, or any other sink without touching domain or team code.

---

## Architecture

```
Team feature code / Domain layer
        │
        │ calls
        ▼
  TelemetryPort (interface in @omni/core)
        │
        │ implemented by
        ▼
  TelemetryService (@omni/telemetry)   ← swap this for your real backend
        │
        │ feeds
        ▼
  console.log / App Insights / Datadog / OpenTelemetry OTLP
```

```
Adapter activate()
        │
        ├─ creates TelemetryService
        ├─ passes to VSCodeAdapter / JetBrainsSidecarBridge
        └─ passes to createGovernanceApi() ← controller/governance-api
```

---

## The `TelemetryPort` Interface

Defined in `@omni/core/src/ports/ide-port.ts`:

```typescript
export interface TelemetryPort {
  recordEvent(eventName: string, data: Record<string, unknown>): void;
}
```

This is the only surface area that domain code and adapters use. Everything else is an implementation detail.

---

## The `TelemetryService` Implementation

`packages/telemetry/src/index.ts` — the default implementation:

```typescript
export class TelemetryService implements TelemetryPort {
  recordEvent(eventName: string, data: Record<string, unknown>): void {
    console.log(`[Telemetry] ${eventName}`, data);
  }
}
```

This is the **stub** implementation suitable for development. Replace the body with your production backend call.

### Example: Application Insights

```typescript
import * as appInsights from 'applicationinsights';

export class AppInsightsTelemetryService implements TelemetryPort {
  constructor() {
    appInsights.setup(process.env.APPINSIGHTS_CONNECTIONSTRING).start();
  }

  recordEvent(eventName: string, data: Record<string, unknown>): void {
    appInsights.defaultClient.trackEvent({
      name: eventName,
      properties: data as Record<string, string>,
    });
  }
}
```

### Example: OpenTelemetry

```typescript
import { metrics } from '@opentelemetry/api';

export class OtelTelemetryService implements TelemetryPort {
  private readonly counter = metrics.getMeter('omni').createCounter('events');

  recordEvent(eventName: string, data: Record<string, unknown>): void {
    this.counter.add(1, { event: eventName, ...data });
  }
}
```

---

## Governance API & MetricsEvent

The `controller/governance-api` package defines a typed event schema and an ingestion function:

```typescript
// controller/governance-api/src/index.ts

export interface MetricsEvent {
  eventName: string;
  teamId: string;                               // 'team-a' | 'team-b' | ...
  timestamp: string;                            // ISO 8601
  environment: 'vscode' | 'jetbrains' | 'cursor';
  data?: Record<string, unknown>;
}

export function createGovernanceApi(telemetry: TelemetryPort) {
  return {
    ingest(event: MetricsEvent): void {
      telemetry.recordEvent(event.eventName, {
        teamId:      event.teamId,
        timestamp:   event.timestamp,
        environment: event.environment,
        data:        event.data,
      });
    },
  };
}
```

Usage:
```typescript
const telemetry = new TelemetryService();
const governance = createGovernanceApi(telemetry);

governance.ingest({
  eventName:   'feature_activated',
  teamId:      'team-a',
  timestamp:   new Date().toISOString(),
  environment: 'vscode',
  data:        { userId: 'user-123', extensionVersion: '1.0.0' },
});
```

---

## MetricsEvent JSON Schema

Defined in `controller/schemas/metrics.json`. Used by the validate-spec CI step and can be used to validate events before ingestion:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MetricsEvent",
  "type": "object",
  "required": ["eventName", "teamId", "timestamp", "environment"],
  "properties": {
    "eventName":   { "type": "string" },
    "teamId":      { "type": "string", "enum": ["team-a","team-b","team-c","team-d"] },
    "timestamp":   { "type": "string", "format": "date-time" },
    "environment": { "type": "string", "enum": ["vscode","jetbrains","cursor"] },
    "data":        { "type": "object" }
  }
}
```

---

## Standard Event Names

| Event Name | When it fires | Key `data` fields |
|------------|--------------|-------------------|
| `vscode_command` | Any `IDEActionPort.executeCommand()` call | `command`, `payload` |
| `feature_action` | Any `executeFeatureAction()` domain call | `action`, `payload` |
| `mcp_tool_execute` | (Recommended) before/after tool execution | `toolId`, `method`, `success` |
| `extension_activate` | In adapter `activate()` | `teamId`, `environment`, `version` |
| `extension_deactivate` | In adapter `deactivate()` | `teamId`, `environment` |
| `feature_activated` | When a team feature is first used | `userId`, `extensionVersion` |
| `spec_validation_failure` | `scripts/validate-spec.js` | `team`, `file`, `error` |

---

## Adding a `mcp_tool_execute` Event (Recommended)

The `MCPRegistry` does not emit telemetry by default, to avoid coupling it to a specific telemetry implementation. The recommended pattern is to wrap the registry call at the adapter layer:

```typescript
async function executeWithTelemetry(
  registry: MCPRegistry,
  telemetry: TelemetryPort,
  toolId: string,
  input: MCPToolInput
): Promise<MCPToolResult> {
  const start = Date.now();
  const result = await registry.execute(toolId, input);
  telemetry.recordEvent('mcp_tool_execute', {
    toolId,
    method: input.method,
    success: result.success,
    durationMs: Date.now() - start,
    error: result.error ?? null,
  });
  return result;
}
```

---

## Dashboard

`controller/dashboard/src/index.ts` exports `buildDashboardData()` which aggregates team metrics for an observability dashboard. In production, this function would pull from a time-series database fed by the `TelemetryService`.

```typescript
export interface DashboardData {
  teams: TeamMetrics[];
  generatedAt: string;
}

export interface TeamMetrics {
  teamId: string;
  totalEvents: number;
  lastSeen: string;
  topEvents: string[];
}
```

---

## Privacy Considerations

- **Do not log PII**: No user names, email addresses, or file contents in telemetry
- **File paths**: Anonymize or strip before recording (replace home directory with `~`)
- **VS Code telemetry opt-out**: Respect `vscode.env.isTelemetryEnabled` before recording any event:

```typescript
import * as vscode from 'vscode';

export class VSCodeTelemetryService implements TelemetryPort {
  recordEvent(eventName: string, data: Record<string, unknown>): void {
    if (!vscode.env.isTelemetryEnabled) return;
    // ... record
  }
}
```

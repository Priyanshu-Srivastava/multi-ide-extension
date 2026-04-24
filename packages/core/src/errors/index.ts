export class OmniError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OmniError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PortNotImplementedError extends OmniError {
  constructor(portName: string) {
    super('PORT_NOT_IMPLEMENTED', `Port '${portName}' has no registered implementation.`);
    this.name = 'PortNotImplementedError';
  }
}

export class SidecarConnectionError extends OmniError {
  constructor(message: string) {
    super('SIDECAR_CONNECTION_FAILED', message);
    this.name = 'SidecarConnectionError';
  }
}

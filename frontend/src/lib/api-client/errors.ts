/**
 * Shared API-client error types.
 */

export class ProRequiredError extends Error {
  constructor() {
    super("Pro subscription required");
    this.name = "ProRequiredError";
  }
}

/** API error with HTTP status (e.g. 409 sheet lock). */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export class GlsApiError extends Error {
  readonly httpStatus: number;
  readonly glsStatus?: string;
  readonly glsErrors?: unknown;

  constructor(message: string, httpStatus: number, glsStatus?: string, glsErrors?: unknown) {
    super(message);
    this.name = "GlsApiError";
    this.httpStatus = httpStatus;
    this.glsStatus = glsStatus;
    this.glsErrors = glsErrors;
  }
}

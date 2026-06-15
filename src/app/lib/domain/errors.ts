/** Domain hataları — route/aksiyon katmanı bunları HTTP koduna çevirir. */

export class ForbiddenError extends Error {
  readonly capability: string;
  constructor(capability: string) {
    super(`Yetki yok: ${capability}`);
    this.name = "ForbiddenError";
    this.capability = capability;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

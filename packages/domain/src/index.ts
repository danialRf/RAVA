export interface ServiceHealth {
  readonly service: string;
  readonly status: "ok" | "degraded" | "unavailable";
  readonly checkedAt: Date;
}

export * from "./auth";
export * from "./admin";
export * from "./enums";
export * from "./money";
export * from "./pricing";
export * from "./transitions";

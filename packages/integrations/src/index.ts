import type { ServiceHealth } from "@rava/domain";

export * from "./email";
export * from "./fx";
export * from "./password";
export * from "./payment";
export * from "./sms";
export * from "./storage";

export interface HealthAwareProvider {
  readonly id: string;
  healthCheck(): Promise<ServiceHealth>;
}

export class DeterministicFakeProvider implements HealthAwareProvider {
  readonly id = "fake";

  async healthCheck(): Promise<ServiceHealth> {
    return {
      service: this.id,
      status: "ok",
      checkedAt: new Date(0),
    };
  }
}

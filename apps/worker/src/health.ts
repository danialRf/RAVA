export interface WorkerHeartbeat {
  readonly service: "rava-worker";
  readonly status: "ok";
  readonly timestamp: string;
}

export function createHeartbeat(now = new Date()): WorkerHeartbeat {
  return {
    service: "rava-worker",
    status: "ok",
    timestamp: now.toISOString(),
  };
}

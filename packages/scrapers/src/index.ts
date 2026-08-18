export interface RetailerAdapterIdentity {
  readonly id: string;
  readonly displayName: string;
  readonly mode: "manual" | "public-api" | "public-page";
}

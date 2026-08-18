import { loadEnvironment, publicRuntimeSummary } from "@rava/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const environment = loadEnvironment();

  return NextResponse.json(
    {
      status: "ok",
      service: "rava-web",
      timestamp: new Date().toISOString(),
      runtime: publicRuntimeSummary(environment),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

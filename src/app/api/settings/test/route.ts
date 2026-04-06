import { NextResponse } from "next/server";
import { testIntegrationConnection } from "@/lib/server/integrations";
import type { IntegrationTestRequestBody } from "@/lib/chat";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<IntegrationTestRequestBody>;

  if (!body?.provider || !body.settings) {
    return NextResponse.json({ error: "Invalid integration test payload." }, { status: 400 });
  }

  const result = await testIntegrationConnection(body.provider, body.settings);
  return NextResponse.json(result);
}

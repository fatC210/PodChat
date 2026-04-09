import { NextResponse } from "next/server";
import { regeneratePodcastProcessing } from "@/lib/server/podcast-processing";
import { readRequestIntegrationSettings } from "@/lib/server/request-integration-settings";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const podcast = await regeneratePodcastProcessing(id, readRequestIntegrationSettings(request));

    if (!podcast) {
      return NextResponse.json({ error: "Podcast not found." }, { status: 404 });
    }

    return NextResponse.json({ podcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Podcast regeneration failed.";
    const status = message === "Podcast processing is already in progress." ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

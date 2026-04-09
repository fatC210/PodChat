import { NextResponse } from "next/server";
import { generateChatReply } from "@/lib/server/integrations";
import type { ChatRequestBody } from "@/lib/chat";
import { defaultIntegrationSettings } from "@/lib/podchat-data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ChatRequestBody>;

    if (!body?.podcast || !body.question || !Array.isArray(body.history)) {
      return NextResponse.json({ error: "Invalid chat request payload." }, { status: 400 });
    }

    const result = await generateChatReply({
      podcast: body.podcast,
      question: body.question,
      history: body.history,
      mode: body.mode,
      mentions: body.mentions,
      integrationSettings: body.integrationSettings ?? {
        llmKey: defaultIntegrationSettings.llmKey,
        llmUrl: defaultIntegrationSettings.llmUrl,
        llmModel: defaultIntegrationSettings.llmModel,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat request failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

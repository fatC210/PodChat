import { NextResponse } from "next/server";
import { generateChatReply } from "@/lib/server/integrations";
import type { ChatRequestBody } from "@/lib/chat";
import { readStoredIntegrationSettings } from "@/lib/server/settings-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ChatRequestBody>;

    if (!body?.podcast || !body.question || !Array.isArray(body.history)) {
      return NextResponse.json({ error: "Invalid chat request payload." }, { status: 400 });
    }

    const storedSettings = await readStoredIntegrationSettings();

    const result = await generateChatReply({
      podcast: body.podcast,
      question: body.question,
      history: body.history,
      mode: body.mode,
      mentions: body.mentions,
      integrationSettings: body.integrationSettings ?? storedSettings,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat request failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

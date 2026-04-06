import { NextResponse } from "next/server";
import { readStoredIntegrationSettings } from "@/lib/server/settings-store";
import { transcribeAudioWithElevenLabs } from "@/lib/server/elevenlabs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    }

    const settings = await readStoredIntegrationSettings();
    const transcription = await transcribeAudioWithElevenLabs(settings, {
      fileName: file.name || "speech.webm",
      fileBytes: Buffer.from(await file.arrayBuffer()),
      diarize: false,
    });

    return NextResponse.json({
      text: transcription.rawText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Speech transcription failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

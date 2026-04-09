import { NextResponse } from "next/server";
import { createStoredPodcast, listStoredPodcasts } from "@/lib/server/podcast-store";
import {
  enqueuePodcastProcessing,
  resumePendingPodcastProcessing,
  setPodcastProcessingIntegrationSettings,
} from "@/lib/server/podcast-processing";
import type { PersonaLocale, PodcastType, SavePodcastInput } from "@/lib/podchat-data";
import { readRequestIntegrationSettings } from "@/lib/server/request-integration-settings";

function readTextField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNumberField(formData: FormData, key: string, fallback = 0) {
  const value = Number(readTextField(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

function isPodcastType(value: string): value is PodcastType {
  return value === "solo" || value === "multi";
}

function normalizePersonaLocale(value: string): PersonaLocale {
  return value === "zh" ? "zh" : "en";
}

export async function GET() {
  await resumePendingPodcastProcessing();
  const podcasts = await listStoredPodcasts();
  return NextResponse.json({ podcasts });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const title = readTextField(formData, "title");
    const type = readTextField(formData, "type");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A source file is required." }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "Podcast title is required." }, { status: 400 });
    }

    if (!isPodcastType(type)) {
      return NextResponse.json({ error: "Podcast type is invalid." }, { status: 400 });
    }

    const input: SavePodcastInput = {
      title,
      type,
      referenceCount: readNumberField(formData, "referenceCount", type === "solo" ? 1 : 2),
      sourceFileName: readTextField(formData, "sourceFileName") || file.name,
      sourceFileSizeMb: readNumberField(formData, "sourceFileSizeMb"),
      personaPresetId: readTextField(formData, "personaPresetId"),
      personaLocale: normalizePersonaLocale(readTextField(formData, "personaLocale")),
      customPersonality: readTextField(formData, "customPersonality"),
      customCatchphrases: readTextField(formData, "customCatchphrases"),
      customAnswerStyle: readTextField(formData, "customAnswerStyle"),
    };

    const podcast = await createStoredPodcast(input, file);
    setPodcastProcessingIntegrationSettings(podcast.id, readRequestIntegrationSettings(request));
    enqueuePodcastProcessing(podcast.id);

    return NextResponse.json({ podcast }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Podcast creation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

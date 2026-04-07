import { NextResponse } from "next/server";
import { buildPersonaFromWizardInput, type Podcast } from "@/lib/podchat-data";
import { enqueuePodcastProcessing } from "@/lib/server/podcast-processing";
import { deleteStoredPodcast, getStoredPodcast, patchStoredPodcast } from "@/lib/server/podcast-store";

const editableFields = new Set<keyof Podcast>([
  "title",
  "type",
  "referenceCount",
  "sourceFileName",
  "sourceFileSizeMb",
  "aiHost",
  "guestName",
  "persona",
  "speakers",
  "summaries",
  "transcript",
]);
const processingTriggerFields = new Set<keyof Podcast>([
  "title",
  "type",
  "referenceCount",
  "sourceFileName",
  "sourceFileSizeMb",
  "persona",
]);

function sanitizePatch(patch: Partial<Podcast>) {
  const nextPatch: Partial<Podcast> = {};

  for (const [key, value] of Object.entries(patch) as Array<[keyof Podcast, Podcast[keyof Podcast]]>) {
    if (editableFields.has(key)) {
      (nextPatch as Record<string, unknown>)[key] = value;
    }
  }

  return nextPatch;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  void request;

  const { id } = await context.params;
  const podcast = await getStoredPodcast(id);

  if (!podcast) {
    return NextResponse.json({ error: "Podcast not found." }, { status: 404 });
  }

  return NextResponse.json({ podcast });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      patch?: Partial<Podcast>;
      wizard?: {
        personaPresetId: string;
        personaLocale: "en" | "zh";
        customPersonality: string;
        customCatchphrases: string;
        customAnswerStyle: string;
      };
    };

    if (!body.patch || typeof body.patch !== "object") {
      return NextResponse.json({ error: "Invalid podcast patch." }, { status: 400 });
    }

    const patch = sanitizePatch(body.patch);

    if (body.wizard) {
      const current = await getStoredPodcast(id);

      if (!current) {
        return NextResponse.json({ error: "Podcast not found." }, { status: 404 });
      }

      patch.persona = buildPersonaFromWizardInput(body.wizard, current.persona.languagePref);
    }

    const shouldEnqueueProcessing =
      Boolean(body.wizard) ||
      Object.keys(patch).some((key) => processingTriggerFields.has(key as keyof Podcast));

    const podcast = await patchStoredPodcast(id, patch);

    if (!podcast) {
      return NextResponse.json({ error: "Podcast not found." }, { status: 404 });
    }

    if (podcast.status === "configuring" && shouldEnqueueProcessing) {
      enqueuePodcastProcessing(podcast.id);
    }

    return NextResponse.json({ podcast });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Podcast update failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  void request;

  const { id } = await context.params;
  const deleted = await deleteStoredPodcast(id);

  if (!deleted) {
    return NextResponse.json({ error: "Podcast not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

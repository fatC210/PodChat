import "server-only";

import { setTimeout as delay } from "node:timers/promises";
import { isPodcastReady, resetPodcastForProcessing, type Podcast } from "@/lib/podchat-data";
import { generateLivePodcastOutput } from "@/lib/server/live-podcast-processing";
import { deletePodcastVoices } from "@/lib/server/podcast-voices";
import { getStoredPodcastAsset, listStoredPodcasts, updateStoredPodcast } from "@/lib/server/podcast-store";
import { readStoredIntegrationSettings } from "@/lib/server/settings-store";
import { clonePodcastSpeakerVoice } from "@/lib/server/voice-cloning";

interface ProcessorRuntime {
  activePodcastIds: Set<string>;
  resumedPendingPodcasts: boolean;
}

function getProcessorRuntime() {
  const scopedGlobal = globalThis as typeof globalThis & {
    __podchatProcessorRuntime?: ProcessorRuntime;
  };

  if (!scopedGlobal.__podchatProcessorRuntime) {
    scopedGlobal.__podchatProcessorRuntime = {
      activePodcastIds: new Set<string>(),
      resumedPendingPodcasts: false,
    };
  }

  return scopedGlobal.__podchatProcessorRuntime;
}

async function applyProcessingPatch(
  podcastId: string,
  patch: Partial<Podcast>,
) {
  return updateStoredPodcast(podcastId, (podcast) => ({
    ...podcast,
    ...patch,
  }));
}

async function clonePodcastSpeakerVoiceSafely(input: Parameters<typeof clonePodcastSpeakerVoice>[0]) {
  try {
    return await clonePodcastSpeakerVoice(input);
  } catch (error) {
    console.warn(`Failed to clone an AI host voice for podcast ${input.podcast.id}.`, error);
    return {
      voiceId: null,
      voiceName: null,
    };
  }
}

async function processPodcast(podcastId: string) {
  const runtime = getProcessorRuntime();

  if (runtime.activePodcastIds.has(podcastId)) {
    return;
  }

  runtime.activePodcastIds.add(podcastId);

  try {
    await applyProcessingPatch(podcastId, {
      workflowStep: "queued",
      processingProgressPercent: 5,
      processingError: null,
    });

    await delay(400);
    const transcribingState = await applyProcessingPatch(podcastId, {
      workflowStep: "transcribing",
      processingProgressPercent: 20,
      processingError: null,
    });

    if (!transcribingState || isPodcastReady(transcribingState)) {
      return;
    }

    const storedAsset = await getStoredPodcastAsset(podcastId);

    if (!storedAsset) {
      throw new Error("Stored source file was not found.");
    }

    const settings = await readStoredIntegrationSettings();
    const generatedContent = await generateLivePodcastOutput({
      podcast: transcribingState,
      uploadedFilePath: storedAsset.uploadedFilePath,
      sourceFileName: storedAsset.sourceFileName,
      settings,
    });

    await delay(400);
    await applyProcessingPatch(podcastId, {
      topic: generatedContent.topic,
      duration: generatedContent.duration,
      guestName: generatedContent.guestName,
      detectedSpeakerCount: generatedContent.detectedSpeakerCount,
      speakers: generatedContent.speakers,
      speakerProfiles: generatedContent.speakerProfiles,
      transcript: generatedContent.transcript,
      chapters: generatedContent.chapters,
      workflowStep: "summarizing",
      processingProgressPercent: 55,
      processingError: null,
    });

    const selectedSpeaker =
      generatedContent.aiHostSpeakerId
        ? generatedContent.speakers.find((speaker) => speaker.id === generatedContent.aiHostSpeakerId)
        : null;

    if (!selectedSpeaker || !generatedContent.aiHostSpeakerId) {
      throw new Error("The processed transcript did not produce a selectable AI host speaker.");
    }

    const clonedVoice = await clonePodcastSpeakerVoiceSafely({
      settings,
      podcast: {
        ...transcribingState,
        speakers: generatedContent.speakers,
        transcript: generatedContent.transcript,
      },
      assetPath: storedAsset.uploadedFilePath,
      speakerId: selectedSpeaker.id,
      speakerName: selectedSpeaker.name,
    });

    await delay(400);
    await applyProcessingPatch(podcastId, {
      summaries: generatedContent.summaries,
      scriptChunks: generatedContent.scriptChunks,
      crawledPages: generatedContent.crawledPages,
      aiHost: selectedSpeaker.name,
      aiHostSpeakerId: selectedSpeaker.id,
      aiHostVoiceId: clonedVoice.voiceId,
      aiHostVoiceName: clonedVoice.voiceName,
      workflowStep: "finalizing",
      processingProgressPercent: 90,
      processingError: null,
    });

    await delay(300);
    await applyProcessingPatch(podcastId, {
      status: "ready",
      workflowStep: undefined,
      processingProgressPercent: 100,
      processingError: null,
      progressPercent: 0,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Podcast processing failed.";

    await applyProcessingPatch(podcastId, {
      workflowStep: "queued",
      processingProgressPercent: 0,
      processingError: detail,
    });
  } finally {
    runtime.activePodcastIds.delete(podcastId);
  }
}

export function enqueuePodcastProcessing(podcastId: string) {
  void processPodcast(podcastId);
}

export async function regeneratePodcastProcessing(podcastId: string) {
  const runtime = getProcessorRuntime();

  if (runtime.activePodcastIds.has(podcastId)) {
    throw new Error("Podcast processing is already in progress.");
  }

  const storedAsset = await getStoredPodcastAsset(podcastId);

  if (!storedAsset) {
    return null;
  }

  try {
    const settings = await readStoredIntegrationSettings();
    await deletePodcastVoices(settings, storedAsset.podcast);
  } catch {
    void 0;
  }

  const podcast = await updateStoredPodcast(podcastId, resetPodcastForProcessing);

  if (!podcast) {
    return null;
  }

  enqueuePodcastProcessing(podcastId);
  return podcast;
}

export async function enqueueConfiguringPodcasts() {
  const podcasts = await listStoredPodcasts();

  podcasts
    .filter((podcast) => podcast.status === "configuring" && !isPodcastReady(podcast))
    .forEach((podcast) => {
      enqueuePodcastProcessing(podcast.id);
    });
}

export async function resumePendingPodcastProcessing() {
  const runtime = getProcessorRuntime();

  if (runtime.resumedPendingPodcasts) {
    return;
  }

  runtime.resumedPendingPodcasts = true;
  await enqueueConfiguringPodcasts();
}

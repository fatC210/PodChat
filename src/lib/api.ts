import type {
  ChatSpeechEmotion,
  ChatRequestBody,
  ChatResponseBody,
  IntegrationTestRequestBody,
  IntegrationTestResponseBody,
} from "@/lib/chat";
import { integrationSettingsHeaderName } from "@/lib/integration-settings-header";
import {
  readStoredIntegrationSettingsFromLocalStorage,
  writeStoredIntegrationSettingsToLocalStorage,
} from "@/lib/integration-settings-storage";
import type { IntegrationSettings, Podcast, SavePodcastInput } from "@/lib/podchat-data";
import { getMaxUploadSizeMb, isFileTooLarge } from "@/lib/upload-limits";

export interface AgentSessionResponse {
  agentId: string;
  signedUrl: string;
  recreatedBecause?: string;
}

async function readErrorMessage(response: Response) {
  if (response.status === 413) {
    return `The uploaded file is too large for this deployment. Try a file under ${getMaxUploadSizeMb()} MB, or switch to external object storage for larger uploads.`;
  }

  try {
    const data = await response.json();
    if (typeof data?.error === "string") {
      return data.error;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }
  } catch {
    void 0;
  }

  return `Request failed with status ${response.status}`;
}

function withIntegrationSettingsHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const settings = readStoredIntegrationSettingsFromLocalStorage();
  nextHeaders.set(integrationSettingsHeaderName, encodeURIComponent(JSON.stringify(settings)));
  return nextHeaders;
}

export async function requestChatReply(payload: ChatRequestBody) {
  const integrationSettings = readStoredIntegrationSettingsFromLocalStorage();
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      integrationSettings: {
        llmKey: integrationSettings.llmKey,
        llmUrl: integrationSettings.llmUrl,
        llmModel: integrationSettings.llmModel,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as ChatResponseBody;
}

export async function fetchIntegrationSettings() {
  return {
    settings: readStoredIntegrationSettingsFromLocalStorage(),
  };
}

export async function saveIntegrationSettings(payload: IntegrationSettings) {
  writeStoredIntegrationSettingsToLocalStorage(payload);
  return {
    settings: payload,
  };
}

export async function testIntegrationConnection(payload: IntegrationTestRequestBody) {
  const response = await fetch("/api/settings/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as IntegrationTestResponseBody;
}

export async function fetchPodcasts() {
  const response = await fetch("/api/podcasts", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { podcasts: Podcast[] };
}

export async function createPodcast(input: SavePodcastInput, file: File) {
  if (isFileTooLarge(file)) {
    throw new Error(
      `The uploaded file is too large for this deployment. Try a file under ${getMaxUploadSizeMb()} MB, or switch to external object storage for larger uploads.`,
    );
  }

  const formData = new FormData();
  formData.set("file", file);
  formData.set("title", input.title);
  formData.set("type", input.type);
  formData.set("referenceCount", String(input.referenceCount));
  formData.set("sourceFileName", input.sourceFileName);
  formData.set("sourceFileSizeMb", String(input.sourceFileSizeMb));
  formData.set("personaPresetId", input.personaPresetId);
  formData.set("personaLocale", input.personaLocale);
  formData.set("customPersonality", input.customPersonality);
  formData.set("customCatchphrases", input.customCatchphrases);
  formData.set("customAnswerStyle", input.customAnswerStyle);

  const response = await fetch("/api/podcasts", {
    method: "POST",
    headers: withIntegrationSettingsHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { podcast: Podcast };
}

export async function patchPodcast(
  id: string,
  payload: {
    patch: Partial<Podcast>;
    wizard?: {
      personaPresetId: string;
      personaLocale: "en" | "zh";
      customPersonality: string;
      customCatchphrases: string;
      customAnswerStyle: string;
    };
  },
) {
  const response = await fetch(`/api/podcasts/${id}`, {
    method: "PATCH",
    headers: withIntegrationSettingsHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { podcast: Podcast };
}

export async function regeneratePodcast(id: string) {
  const response = await fetch(`/api/podcasts/${id}/regenerate`, {
    method: "POST",
    headers: withIntegrationSettingsHeaders(),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { podcast: Podcast };
}

export async function deletePodcast(id: string) {
  const response = await fetch(`/api/podcasts/${id}`, {
    method: "DELETE",
    headers: withIntegrationSettingsHeaders(),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { ok: true };
}

export async function transcribeSpeech(file: Blob, fileName = "speech.webm") {
  const formData = new FormData();
  formData.set("file", new File([file], fileName, { type: file.type || "audio/webm" }));

  const response = await fetch("/api/speech-to-text", {
    method: "POST",
    headers: withIntegrationSettingsHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { text: string };
}

export async function requestChatSpeech(
  podcastId: string,
  text: string,
  speakerId?: string,
  emotion?: ChatSpeechEmotion,
  speechStyle?: string,
) {
  const response = await fetch(`/api/podcasts/${podcastId}/chat-audio`, {
    method: "POST",
    headers: withIntegrationSettingsHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      text,
      ...(speakerId ? { speakerId } : {}),
      ...(emotion ? { emotion } : {}),
      ...(speechStyle ? { speechStyle } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return await response.blob();
}

export async function cloneHostVoice(podcastId: string, speakerId: string) {
  const response = await fetch(`/api/podcasts/${podcastId}/host-voice`, {
    method: "POST",
    headers: withIntegrationSettingsHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ speakerId }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { podcast: Podcast };
}

export async function prepareGroupVoices(podcastId: string) {
  const response = await fetch(`/api/podcasts/${podcastId}/group-voices/prepare`, {
    method: "POST",
    headers: withIntegrationSettingsHeaders(),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { podcast: Podcast };
}

export async function recloneGroupVoice(podcastId: string, speakerId: string) {
  const response = await fetch(`/api/podcasts/${podcastId}/group-voices/${speakerId}/reclone`, {
    method: "POST",
    headers: withIntegrationSettingsHeaders(),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { podcast: Podcast };
}

export async function requestSummaryTranslation(
  podcastId: string,
  duration: number,
  targetLang: string,
) {
  const response = await fetch(`/api/podcasts/${podcastId}/summary-translation`, {
    method: "POST",
    headers: withIntegrationSettingsHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      duration,
      targetLang,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as {
    text: string;
    podcast: Podcast;
  };
}

export async function requestTranscriptTranslation(
  podcastId: string,
  targetLang: string,
) {
  const response = await fetch(`/api/podcasts/${podcastId}/transcript-translation`, {
    method: "POST",
    headers: withIntegrationSettingsHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      targetLang,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as {
    targetLang: string;
    translations: Record<string, string>;
  };
}

export async function requestSummaryAudio(
  podcastId: string,
  duration: number,
  emotion: string,
  targetLang?: string,
) {
  const params = new URLSearchParams({
    dur: String(duration),
    emotion,
  });

  if (targetLang) {
    params.set("lang", targetLang);
  }

  const response = await fetch(`/api/podcasts/${podcastId}/summary-audio?${params.toString()}`, {
    headers: withIntegrationSettingsHeaders(),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return await response.blob();
}

export async function startAgentSession() {
  const response = await fetch("/api/agent/session", {
    method: "POST",
    headers: withIntegrationSettingsHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      settings: readStoredIntegrationSettingsFromLocalStorage(),
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const result = (await response.json()) as AgentSessionResponse;
  const currentSettings = readStoredIntegrationSettingsFromLocalStorage();

  if (result.agentId && result.agentId !== currentSettings.elevenlabsAgentId) {
    writeStoredIntegrationSettingsToLocalStorage({
      ...currentSettings,
      elevenlabsAgentId: result.agentId,
    });
  }

  return result;
}

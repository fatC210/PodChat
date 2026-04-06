import type {
  ChatRequestBody,
  ChatResponseBody,
  IntegrationTestRequestBody,
  IntegrationTestResponseBody,
} from "@/lib/chat";
import type { IntegrationSettings, Podcast, SavePodcastInput } from "@/lib/podchat-data";

export interface AgentSessionResponse {
  agentId: string;
  signedUrl: string;
  recreatedBecause?: string;
}

async function readErrorMessage(response: Response) {
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

export async function requestChatReply(payload: ChatRequestBody) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as ChatResponseBody;
}

export async function fetchIntegrationSettings() {
  const response = await fetch("/api/settings", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { settings: IntegrationSettings };
}

export async function saveIntegrationSettings(payload: IntegrationSettings) {
  const response = await fetch("/api/settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      settings: payload,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { settings: IntegrationSettings };
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
    headers: {
      "Content-Type": "application/json",
    },
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
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { podcast: Podcast };
}

export async function deletePodcast(id: string) {
  const response = await fetch(`/api/podcasts/${id}`, {
    method: "DELETE",
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
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { text: string };
}

export async function requestChatSpeech(podcastId: string, text: string) {
  const response = await fetch(`/api/podcasts/${podcastId}/chat-audio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return await response.blob();
}

export async function cloneHostVoice(podcastId: string, speakerId: string) {
  const response = await fetch(`/api/podcasts/${podcastId}/host-voice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ speakerId }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as { podcast: Podcast };
}

export async function startAgentSession() {
  const response = await fetch("/api/agent/session", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as AgentSessionResponse;
}

import "server-only";

import { normalizeIntegrationSettings, type IntegrationSettings } from "@/lib/podchat-data";
import { fetchWithUpstreamErrorContext, normalizeValue, readUpstreamError } from "@/lib/server/integrations";

const requiredConversationOverrides = {
  agent: {
    first_message: true,
    language: true,
    prompt: {
      prompt: true,
    },
  },
  tts: {
    voice_id: true,
    stability: true,
    speed: true,
    similarity_boost: true,
  },
  conversation: {
    text_only: true,
  },
} as const;

function hasAgentId(settings: Pick<IntegrationSettings, "elevenlabsAgentId">) {
  return Boolean(normalizeValue(settings.elevenlabsAgentId));
}

function shouldRecreateStoredAgent(detail: string) {
  const normalizedDetail = detail.trim().toLowerCase();

  return (
    normalizedDetail.includes("not_found") ||
    normalizedDetail.includes("agent_not_found") ||
    normalizedDetail.includes("status 404") ||
    normalizedDetail.includes("status 401") ||
    normalizedDetail.includes("unauthorized")
  );
}

async function createAndAttachBaseAgent(settings: IntegrationSettings) {
  const agentId = await createBaseAgent(settings);
  const nextSettings = normalizeIntegrationSettings({
    ...settings,
    elevenlabsAgentId: agentId,
  });

  await ensureAgentOverridesEnabled(nextSettings, agentId);
  return nextSettings;
}

async function createBaseAgent(settings: Pick<IntegrationSettings, "elevenlabs">) {
  const response = await fetchWithUpstreamErrorContext("ElevenLabs agent creation API", "https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": settings.elevenlabs,
    },
    body: JSON.stringify({
      name: "PodChat Base Agent",
      conversation_config: {
        agent: {
          prompt: {
            prompt:
              "You are the base voice agent for PodChat. Session overrides will provide podcast-specific context, prompt, first message, and voice.",
          },
          first_message: "Hello, I am ready.",
          language: "en",
        },
      },
      platform_settings: {
        overrides: {
          conversation_config_override: requiredConversationOverrides,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  const payload = (await response.json()) as {
    agent_id?: string;
  };

  if (!payload.agent_id) {
    throw new Error("ElevenLabs did not return an agent ID.");
  }

  return payload.agent_id;
}

async function requestSignedUrl(
  settings: Pick<IntegrationSettings, "elevenlabs">,
  agentId: string,
) {
  const response = await fetchWithUpstreamErrorContext(
    "ElevenLabs signed URL API",
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    {
      headers: {
        "xi-api-key": settings.elevenlabs,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await readUpstreamError(response));
  }

  const payload = (await response.json()) as {
    signed_url?: string;
  };

  if (!payload.signed_url) {
    throw new Error("ElevenLabs did not return a signed URL.");
  }

  return payload.signed_url;
}

interface AgentDetailsResponse {
  platform_settings?: {
    overrides?: {
      conversation_config_override?: {
        agent?: {
          first_message?: boolean;
          language?: boolean;
          prompt?: {
            prompt?: boolean;
          };
        };
        tts?: {
          voice_id?: boolean;
          stability?: boolean;
          speed?: boolean;
          similarity_boost?: boolean;
        };
        conversation?: {
          text_only?: boolean;
        };
      };
    };
  };
}

function hasRequiredOverrides(agent: AgentDetailsResponse) {
  const overrides = agent.platform_settings?.overrides?.conversation_config_override;

  return Boolean(
    overrides?.agent?.first_message &&
      overrides.agent.language &&
      overrides.agent.prompt?.prompt &&
      overrides?.tts?.voice_id &&
      overrides.tts.stability &&
      overrides.tts.speed &&
      overrides.tts.similarity_boost &&
      overrides?.conversation?.text_only,
  );
}

async function ensureAgentOverridesEnabled(
  settings: Pick<IntegrationSettings, "elevenlabs">,
  agentId: string,
) {
  const getResponse = await fetchWithUpstreamErrorContext("ElevenLabs agent details API", `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`, {
    headers: {
      "xi-api-key": settings.elevenlabs,
    },
  });

  if (!getResponse.ok) {
    throw new Error(await readUpstreamError(getResponse));
  }

  const agent = (await getResponse.json()) as AgentDetailsResponse;

  if (hasRequiredOverrides(agent)) {
    return;
  }

  const patchResponse = await fetchWithUpstreamErrorContext("ElevenLabs agent update API", `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": settings.elevenlabs,
    },
    body: JSON.stringify({
      platform_settings: {
        overrides: {
          conversation_config_override: requiredConversationOverrides,
        },
      },
    }),
  });

  if (!patchResponse.ok) {
    throw new Error(await readUpstreamError(patchResponse));
  }
}

export async function ensureBaseAgent(settings: IntegrationSettings) {
  if (!normalizeValue(settings.elevenlabs)) {
    throw new Error("ElevenLabs API key is required before starting an agent session.");
  }

  if (hasAgentId(settings)) {
    try {
      await ensureAgentOverridesEnabled(settings, settings.elevenlabsAgentId);
      return settings;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown ElevenLabs agent error.";

      if (!shouldRecreateStoredAgent(detail)) {
        throw error;
      }
    }
  }

  return createAndAttachBaseAgent(settings);
}

export async function getConversationToken(settings: IntegrationSettings) {
  let nextSettings = await ensureBaseAgent(settings);

  try {
    return {
      signedUrl: await requestSignedUrl(nextSettings, nextSettings.elevenlabsAgentId),
      agentId: nextSettings.elevenlabsAgentId,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown ElevenLabs token error.";

    const agentId = await createBaseAgent(nextSettings);
    nextSettings = normalizeIntegrationSettings({
      ...nextSettings,
      elevenlabsAgentId: agentId,
    });

    return {
      signedUrl: await requestSignedUrl(nextSettings, agentId),
      agentId,
      recreatedBecause: detail,
    };
  }
}

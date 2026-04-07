export type FloatingChatRole = "user" | "ai";

export interface FloatingChatMessagePayload {
  id: string | null;
  role: FloatingChatRole;
  text: string;
}

const ELLIPSIS_ONLY_PATTERN = /^[\s.\u3002\u2026\uFF0E]+$/u;

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asEventId(value: unknown) {
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  return null;
}

function buildMessage(
  role: FloatingChatRole,
  text: unknown,
  eventId: unknown,
): FloatingChatMessagePayload | null {
  const normalizedText = asString(text);

  if (!normalizedText) {
    return null;
  }

  if (role === "user" && isIgnorableUserMessageText(normalizedText)) {
    return null;
  }

  const normalizedEventId = asEventId(eventId);

  return {
    id: normalizedEventId ? `${role}-${normalizedEventId}` : null,
    role,
    text: normalizedText,
  };
}

export function isIgnorableUserMessageText(text: string) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return true;
  }

  return ELLIPSIS_ONLY_PATTERN.test(normalizedText);
}

export function normalizeFloatingChatMessage(payload: unknown): FloatingChatMessagePayload | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  if (record.type === "tentative_user_transcript") {
    return null;
  }

  if (record.type === "user_transcript") {
    const event = asRecord(record.user_transcription_event);
    return buildMessage("user", event?.user_transcript, event?.event_id);
  }

  if (record.type === "agent_response") {
    const event = asRecord(record.agent_response_event);
    return buildMessage("ai", event?.agent_response, event?.event_id);
  }

  if (record.type === "agent_response_correction") {
    const event = asRecord(record.agent_response_correction_event);
    return buildMessage("ai", event?.corrected_agent_response ?? event?.original_agent_response, event?.event_id);
  }

  const role =
    record.role === "agent" || record.role === "assistant" || record.role === "ai"
      ? "ai"
      : record.role === "user"
        ? "user"
        : null;

  if (!role) {
    return null;
  }

  return buildMessage(role, record.message ?? record.text, record.event_id);
}

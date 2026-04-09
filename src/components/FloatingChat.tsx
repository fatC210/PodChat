"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Phone, Plus, RefreshCw, Send, Users } from "lucide-react";
import { toast } from "sonner";
import {
  buildChatParticipants,
  buildChatWelcomeMessage,
  getResolvedChatMode,
  parseChatMentions,
  type ChatHistoryMessage,
  type ChatMode,
  type ChatReplyMessage,
} from "@/lib/chat";
import {
  prepareGroupVoices,
  recloneGroupVoice,
  requestChatReply,
  requestChatSpeech,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app-data";
import { isPodcastReady, supportsGroupChat, type Podcast } from "@/lib/podchat-data";

interface FloatingChatProps {
  open: boolean;
  onClose: () => void;
  podcast: Podcast;
}

interface UiMessage {
  id: string;
  senderId: string;
  senderType: "user" | "speaker";
  senderName: string;
  text: string;
  speechText?: string;
  speechStyle?: string;
  speechEmotion?: ChatReplyMessage["speechEmotion"];
}

interface PendingWelcomeMessage {
  mode: ChatMode;
  message: ChatReplyMessage;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ isFinal?: boolean; 0?: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

const SESSION_STORAGE_PREFIX = "podchat_chat_session_v1";
const PERSISTENCE_STORAGE_PREFIX = "podchat_chat_persist_v1";
const PARTICIPANT_LIST_COLLAPSED_MAX_HEIGHT = 36;
const CALL_WAVE_BAR_HEIGHTS = [38, 62, 82, 54, 72, 46];
const IGNORABLE_RECOGNITION_ERRORS = new Set(["aborted", "no-speech"]);

function getSessionStorageKey(podcastId: string, mode: ChatMode) {
  return `${SESSION_STORAGE_PREFIX}:${podcastId}:${mode}`;
}

function getPersistenceStorageKey(podcastId: string, mode: ChatMode) {
  return `${PERSISTENCE_STORAGE_PREFIX}:${podcastId}:${mode}`;
}

function asHistory(messages: UiMessage[]): ChatHistoryMessage[] {
  return messages.map((message) => ({
    id: message.id,
    senderId: message.senderId,
    senderType: message.senderType,
    senderName: message.senderName,
    text: message.text,
  }));
}

function toUiMessage(
  message: Pick<
    ChatReplyMessage,
    "id" | "senderId" | "senderType" | "senderName" | "text" | "speechText" | "speechStyle" | "speechEmotion"
  >,
): UiMessage {
  return {
    id: message.id,
    senderId: message.senderId,
    senderType: message.senderType,
    senderName: message.senderName,
    text: message.text,
    ...(message.speechText ? { speechText: message.speechText } : {}),
    ...(message.speechStyle ? { speechStyle: message.speechStyle } : {}),
    ...(message.speechEmotion ? { speechEmotion: message.speechEmotion } : {}),
  };
}

function toChatReplyMessage(message: UiMessage): ChatReplyMessage {
  return {
    id: message.id,
    senderId: message.senderId,
    senderType: "speaker",
    senderName: message.senderName,
    text: message.text,
    ...(message.speechText ? { speechText: message.speechText } : {}),
    ...(message.speechStyle ? { speechStyle: message.speechStyle } : {}),
    ...(message.speechEmotion ? { speechEmotion: message.speechEmotion } : {}),
    mentions: [],
  };
}

function isDuplicateReplyMessage(existing: UiMessage, reply: ChatReplyMessage) {
  return existing.id === reply.id && existing.senderId === reply.senderId && existing.text === reply.text;
}

function getNextAvailableMessageId(messages: UiMessage[], baseId: string) {
  let nextId = baseId;
  let suffix = 2;

  while (messages.some((message) => message.id === nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function isChineseLang(lang: string) {
  return lang.toLowerCase().startsWith("zh");
}

function formatReplyingHeadline(lang: string, speakerName: string) {
  return isChineseLang(lang) ? `${speakerName} \u6b63\u5728\u56de\u590d` : `${speakerName} is replying`;
}

function isIgnorableRecognitionError(error?: string) {
  return Boolean(error && IGNORABLE_RECOGNITION_ERRORS.has(error));
}

function normalizeComparableReplyText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function resolveReplySpeechText(text: string, speechText?: string) {
  const nextSpeechText = speechText?.trim();

  if (!nextSpeechText) {
    return text;
  }

  return normalizeComparableReplyText(nextSpeechText) === normalizeComparableReplyText(text)
    ? nextSpeechText
    : text;
}

function matchesCurrentReplyTranscript(transcript: string, currentReplyText?: string | null) {
  const normalizedTranscript = normalizeComparableReplyText(transcript);
  const normalizedReply = currentReplyText ? normalizeComparableReplyText(currentReplyText) : "";

  return Boolean(normalizedTranscript && normalizedReply) &&
    (normalizedTranscript === normalizedReply ||
      normalizedReply.includes(normalizedTranscript) ||
      normalizedTranscript.includes(normalizedReply));
}

function CallWaveform({ animated }: { animated: boolean }) {
  return (
    <div aria-hidden="true" className="flex h-5 items-center gap-[3px]">
      {CALL_WAVE_BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className={`w-1 rounded-full bg-current transition-[height,opacity] duration-300 ${
            animated ? "origin-center opacity-100" : "origin-center opacity-55"
          }`}
          style={{
            height: `${animated ? height : Math.max(14, Math.round(height * 0.72))}%`,
            ...(animated
              ? {
                  animationName: "waveform-bar",
                  animationDuration: "1.05s",
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: "infinite",
                  animationDelay: `${index * -120}ms`,
                }
              : {}),
          }}
        />
      ))}
    </div>
  );
}

export default function FloatingChat({ open, onClose, podcast }: FloatingChatProps) {
  const { t, lang } = useI18n();
  const { updatePodcast } = useAppData();
  const groupCapable = supportsGroupChat(podcast);
  const [chatMode, setChatMode] = useState<ChatMode>(() => getResolvedChatMode(podcast, "personal"));
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [preparingVoices, setPreparingVoices] = useState(false);
  const [groupVoicePrepSettled, setGroupVoicePrepSettled] = useState(false);
  const [audioPending, setAudioPending] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [sessionBootstrapped, setSessionBootstrapped] = useState(false);
  const [pendingWelcome, setPendingWelcome] = useState<PendingWelcomeMessage | null>(null);
  const [persistSession, setPersistSession] = useState(false);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [participantListOverflowing, setParticipantListOverflowing] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(() => Boolean(getSpeechRecognitionConstructor()));
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [replyingSpeakerName, setReplyingSpeakerName] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const messageCounterRef = useRef(0);
  const turnRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const participantListRef = useRef<HTMLDivElement | null>(null);
  const sessionInitializationKeyRef = useRef<string | null>(null);
  const langRef = useRef(lang);
  const messagesRef = useRef(messages);
  const sendingRef = useRef(sending);
  const pendingWelcomeRef = useRef<PendingWelcomeMessage | null>(pendingWelcome);
  const audioPendingRef = useRef(audioPending);
  const audioPlayingRef = useRef(audioPlaying);
  const activeReplySpeechTextRef = useRef<string | null>(null);

  langRef.current = lang;
  messagesRef.current = messages;
  sendingRef.current = sending;
  pendingWelcomeRef.current = pendingWelcome;
  audioPendingRef.current = audioPending;
  audioPlayingRef.current = audioPlaying;

  const participants = useMemo(() => buildChatParticipants(podcast), [podcast]);
  const activeMode = groupCapable ? chatMode : "personal";
  const mentionSuggestions = useMemo(() => {
    const match = input.match(/(?:^|\s)(@[A-Za-z0-9_\-\u4e00-\u9fff]*)$/u);

    if (!match) {
      return [];
    }

    const query = match[1]?.toLowerCase() ?? "";
    const speakerMatches = participants.filter((participant) => participant.handle.toLowerCase().startsWith(query));

    if ("@all".startsWith(query)) {
      return [{ id: "all", handle: "@all", name: "All" }, ...speakerMatches];
    }

    return speakerMatches;
  }, [input, participants]);

  const sessionStorageKey = useMemo(() => getSessionStorageKey(podcast.id, activeMode), [activeMode, podcast.id]);
  const persistenceStorageKey = useMemo(
    () => getPersistenceStorageKey(podcast.id, activeMode),
    [activeMode, podcast.id],
  );
  const voiceSessionBusy = audioPending || audioPlaying || Boolean(pendingWelcome) || sending;
  const groupVoiceReadyForConversation = activeMode !== "group" || groupVoicePrepSettled;
  const shouldShowListeningStandby =
    voiceSupported && groupVoiceReadyForConversation && !voiceSessionBusy && !voiceError;
  const shouldHideEmptyState = Boolean(pendingWelcome) || (audioPending && messages.length === 0);

  const mergeServerPodcast = useCallback(
    (nextPodcast: Podcast) => {
      updatePodcast(nextPodcast.id, (current) => ({
        ...nextPodcast,
        progressPercent: current.progressPercent,
        speed: current.speed,
        transcriptMode: current.transcriptMode,
        targetLang: current.targetLang,
        speakerFilter: current.speakerFilter,
      }));
    },
    [updatePodcast],
  );

  const revokeCurrentAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback((recognition?: SpeechRecognitionInstance | null) => {
    if (!recognition) {
      return;
    }

    if (recognitionRef.current === recognition) {
      recognitionRef.current = null;
    }

    try {
      recognition.stop();
    } catch {
      void 0;
    }
  }, []);

  const stopAudioPlayback = useCallback(() => {
    turnRef.current += 1;
    activeReplySpeechTextRef.current = null;
    audioPendingRef.current = false;
    audioPlayingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    revokeCurrentAudioUrl();
    setAudioPending(false);
    setAudioPlaying(false);
    setReplyingSpeakerName(null);
  }, [revokeCurrentAudioUrl]);

  const interruptConversationTurn = useCallback(() => {
    pendingWelcomeRef.current = null;
    sendingRef.current = false;
    setPendingWelcome(null);
    setSending(false);
    stopAudioPlayback();
  }, [stopAudioPlayback]);

  const switchChatMode = useCallback(
    (nextMode: ChatMode) => {
      if (nextMode === activeMode) {
        return;
      }

      stopRecognition(recognitionRef.current);
      setPendingWelcome(null);
      stopAudioPlayback();
      setParticipantsExpanded(false);
      setChatMode(nextMode);
    },
    [activeMode, stopAudioPlayback, stopRecognition],
  );

  const nextMessageId = useCallback((prefix: string) => {
    messageCounterRef.current += 1;
    return `${prefix}-${Date.now()}-${messageCounterRef.current}`;
  }, []);

  const insertMention = useCallback((handle: string) => {
    setInput((current) => {
      if (/(?:^|\s)(@[A-Za-z0-9_\-\u4e00-\u9fff]*)$/u.test(current)) {
        return current
          .replace(
            /(?:^|\s)(@[A-Za-z0-9_\-\u4e00-\u9fff]*)$/u,
            (match) => `${match.startsWith(" ") ? " " : ""}${handle} `,
          )
          .trimStart();
      }

      return `${current.trim()} ${handle} `.trimStart();
    });

    inputRef.current?.focus();
  }, []);

  const callStatus = useMemo(() => {
    if (replyingSpeakerName) {
      return {
        state: "replying",
        glowClass: "bg-accent/20",
        toneClass: "text-accent",
        waveformAnimated: true,
        label: formatReplyingHeadline(lang, replyingSpeakerName),
      };
    }

    if (voiceError) {
      return {
        state: "error",
        glowClass: "bg-destructive/20",
        toneClass: "text-destructive",
        waveformAnimated: false,
        label: voiceError,
      };
    }

    if (preparingVoices) {
      return {
        state: "preparing",
        glowClass: "bg-accent/16",
        toneClass: "text-accent",
        waveformAnimated: true,
        label: t("chat.call.preparing.detail"),
      };
    }

    if (sending) {
      return {
        state: "generating",
        glowClass: "bg-accent/16",
        toneClass: "text-accent",
        waveformAnimated: true,
        label: t("chat.call.generating.detail"),
      };
    }

    if (pendingWelcome) {
      return {
        state: "welcome",
        glowClass: "bg-accent/16",
        toneClass: "text-accent",
        waveformAnimated: true,
        label: t("chat.call.welcome.detail"),
      };
    }

    if (audioPending || audioPlaying) {
      return {
        state: "speaking",
        glowClass: "bg-accent/16",
        toneClass: "text-accent",
        waveformAnimated: true,
        label: t("chat.call.speaking.detail"),
      };
    }

    if (shouldShowListeningStandby) {
      return {
        state: "listening",
        glowClass: "bg-emerald-500/18",
        toneClass: "text-emerald-500",
        waveformAnimated: true,
        label: t("chat.call.listening.active"),
      };
    }

    if (!voiceSupported) {
      return {
        state: "text-only",
        glowClass: "bg-secondary/80",
        toneClass: "text-muted-foreground",
        waveformAnimated: false,
        label: t("chat.call.textOnly.detail"),
      };
    }

    return {
      state: "idle",
      glowClass: "bg-secondary/80",
      toneClass: "text-muted-foreground",
      waveformAnimated: false,
      label: activeMode === "group" ? t("chat.call.idle.group") : t("chat.call.idle.personal"),
    };
  }, [
    activeMode,
    audioPending,
    audioPlaying,
    lang,
    pendingWelcome,
    preparingVoices,
    replyingSpeakerName,
    sending,
    shouldShowListeningStandby,
    t,
    voiceError,
    voiceSupported,
  ]);

  const resolveInitialMessages = useCallback(
    (mode: ChatMode, existingMessages: UiMessage[]) => {
      if (existingMessages.length > 0) {
        pendingWelcomeRef.current = null;
        setPendingWelcome(null);
        return existingMessages;
      }

      const welcome = buildChatWelcomeMessage(podcast, mode, langRef.current);
      const welcomeMessage: ChatReplyMessage = {
        id: nextMessageId("welcome"),
        senderId: welcome.senderId,
        senderType: "speaker",
        senderName: welcome.senderName,
        text: welcome.text,
        mentions: [],
      };

      const nextPendingWelcome = {
        mode,
        message: welcomeMessage,
      };
      pendingWelcomeRef.current = nextPendingWelcome;
      setPendingWelcome(nextPendingWelcome);

      return [];
    },
    [nextMessageId, podcast],
  );

  const appendReplyMessage = useCallback((reply: ChatReplyMessage) => {
    setMessages((current) => {
      if (current.some((message) => isDuplicateReplyMessage(message, reply))) {
        return current;
      }

      const nextReply = current.some((message) => message.id === reply.id)
        ? {
            ...reply,
            id: getNextAvailableMessageId(current, reply.id),
          }
        : reply;

      return [...current, toUiMessage(nextReply)];
    });
  }, []);

  useEffect(() => {
    if (!open) {
      stopAudioPlayback();
      setMessages([]);
      setPendingWelcome(null);
      setInput("");
      setSending(false);
      setVoiceError(null);
      setSessionBootstrapped(false);
      sessionInitializationKeyRef.current = null;
      return;
    }

    if (sessionInitializationKeyRef.current === sessionStorageKey) {
      return;
    }

    sessionInitializationKeyRef.current = sessionStorageKey;
    const storedPersistence = window.localStorage.getItem(persistenceStorageKey);
    const nextPersist = storedPersistence === "1";
    setPersistSession(nextPersist);
    setSessionBootstrapped(false);

    let nextMessages: UiMessage[] = [];

    if (nextPersist) {
      try {
        const raw = window.localStorage.getItem(sessionStorageKey);
        const parsed = raw ? (JSON.parse(raw) as UiMessage[]) : [];
        nextMessages = resolveInitialMessages(activeMode, Array.isArray(parsed) ? parsed : []);
      } catch {
        nextMessages = resolveInitialMessages(activeMode, []);
      }
    } else {
      nextMessages = resolveInitialMessages(activeMode, []);
    }

    setMessages(nextMessages);
    setInput("");
    setSending(false);
    setVoiceError(null);
    setSessionBootstrapped(true);
  }, [activeMode, open, persistenceStorageKey, resolveInitialMessages, sessionStorageKey, stopAudioPlayback]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!persistSession) {
      window.localStorage.removeItem(sessionStorageKey);
      return;
    }

    window.localStorage.setItem(sessionStorageKey, JSON.stringify(messages));
  }, [messages, open, persistSession, sessionStorageKey]);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.localStorage.setItem(persistenceStorageKey, persistSession ? "1" : "0");
  }, [open, persistSession, persistenceStorageKey]);

  useEffect(() => {
    if (!groupCapable && chatMode !== "personal") {
      setChatMode("personal");
    }
  }, [chatMode, groupCapable]);

  useEffect(() => {
    const list = messageListRef.current;

    if (!list) {
      return;
    }

    list.scrollTop = list.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!open || activeMode !== "group") {
      setParticipantsExpanded(false);
      setParticipantListOverflowing(false);
      return;
    }

    const list = participantListRef.current;

    if (!list) {
      return;
    }

    const evaluateOverflow = () => {
      setParticipantListOverflowing(list.scrollHeight > PARTICIPANT_LIST_COLLAPSED_MAX_HEIGHT + 1);
    };

    evaluateOverflow();
    window.addEventListener("resize", evaluateOverflow);

    return () => {
      window.removeEventListener("resize", evaluateOverflow);
    };
  }, [activeMode, open, participants]);

  useEffect(() => {
    if (!open || activeMode !== "group") {
      setPreparingVoices(false);
      setGroupVoicePrepSettled(false);
      return;
    }

    const needsVoicePrep = podcast.speakerProfiles.some(
      (profile) => profile.groupVoiceStatus === "idle" && !profile.groupVoiceId,
    );

    if (!needsVoicePrep) {
      setPreparingVoices(false);
      setGroupVoicePrepSettled(true);
      return;
    }

    let cancelled = false;
    setPreparingVoices(true);
    setGroupVoicePrepSettled(false);

    void prepareGroupVoices(podcast.id)
      .then((result) => {
        if (!cancelled) {
          mergeServerPodcast(result.podcast);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t("chat.error.prepareGroupVoices"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreparingVoices(false);
          setGroupVoicePrepSettled(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeMode, mergeServerPodcast, open, podcast.id, podcast.speakerProfiles, t]);

  const playReplyQueue = useCallback(
    async (replies: ChatReplyMessage[], turnId: number, mode: ChatMode = activeMode) => {
      audioPendingRef.current = true;
      setAudioPending(true);

      try {
        for (const reply of replies) {
          if (turnId !== turnRef.current) {
            return;
          }

          setReplyingSpeakerName(reply.senderName);
          let replyCommitted = false;
          const commitReply = () => {
            if (replyCommitted || turnId !== turnRef.current) {
              return;
            }

            replyCommitted = true;
            appendReplyMessage(reply);
          };

          try {
            const spokenText = resolveReplySpeechText(reply.text, reply.speechText);
            const targetSpeakerId = mode === "group" ? reply.senderId : undefined;
            const blob =
              reply.speechEmotion || reply.speechStyle
                ? await requestChatSpeech(
                    podcast.id,
                    spokenText,
                    targetSpeakerId,
                    reply.speechEmotion,
                    reply.speechStyle,
                  )
                : await requestChatSpeech(podcast.id, spokenText, targetSpeakerId);

            if (turnId !== turnRef.current) {
              return;
            }

            commitReply();
            revokeCurrentAudioUrl();
            const url = URL.createObjectURL(blob);
            audioUrlRef.current = url;

            const audio = audioRef.current ?? new Audio();
            audioRef.current = audio;
            audio.src = url;
            activeReplySpeechTextRef.current = spokenText;
            if (turnId === turnRef.current) {
              audioPlayingRef.current = true;
              setAudioPlaying(true);
            }

            await new Promise<void>((resolve) => {
              const cleanup = () => {
                audio.onended = null;
                audio.onerror = null;
                audio.onpause = null;
              };

              audio.onended = () => {
                cleanup();
                resolve();
              };
              audio.onerror = () => {
                cleanup();
                resolve();
              };
              audio.onpause = () => {
                cleanup();
                resolve();
              };

              void audio.play().catch(() => {
                cleanup();
                resolve();
              });
            });
          } catch (error) {
            commitReply();
            toast.error(error instanceof Error ? error.message : t("chat.error.playReplyAudio"));
          } finally {
            revokeCurrentAudioUrl();
            activeReplySpeechTextRef.current = null;
            if (turnId === turnRef.current) {
              audioPlayingRef.current = false;
              setAudioPlaying(false);
            }
          }
        }
      } finally {
        if (turnId === turnRef.current) {
          audioPendingRef.current = false;
          setAudioPending(false);
          setReplyingSpeakerName(null);
        }
      }
    },
    [activeMode, appendReplyMessage, podcast.id, revokeCurrentAudioUrl, t],
  );

  useEffect(() => {
    if (!open || !pendingWelcome) {
      return;
    }

    if (pendingWelcome.mode === "group") {
      const targetProfile = podcast.speakerProfiles.find((profile) => profile.speakerId === pendingWelcome.message.senderId);

      if (!targetProfile?.groupVoiceId && targetProfile?.groupVoiceStatus !== "failed" && !groupVoicePrepSettled) {
        return;
      }
    }

    const turnId = turnRef.current;
    void playReplyQueue([pendingWelcome.message], turnId, pendingWelcome.mode);
    pendingWelcomeRef.current = null;
    setPendingWelcome(null);
  }, [groupVoicePrepSettled, open, pendingWelcome, playReplyQueue, podcast.speakerProfiles]);

  const submitMessage = useCallback(
    async (rawText: string, options?: { allowInterruptDuringGeneration?: boolean }) => {
      const nextText = rawText.trim();
      const allowInterruptDuringGeneration = options?.allowInterruptDuringGeneration ?? false;

      if (!nextText) {
        return;
      }

      if (sendingRef.current && !allowInterruptDuringGeneration) {
        return;
      }

      const hasInterruptibleTurn =
        audioPendingRef.current ||
        audioPlayingRef.current ||
        Boolean(pendingWelcomeRef.current) ||
        sendingRef.current;

      if (hasInterruptibleTurn) {
        interruptConversationTurn();
      }

      const turnId = turnRef.current;
      sendingRef.current = true;
      setSending(true);
      setInput("");

      const nextUserMessage: UiMessage = {
        id: nextMessageId("user"),
        senderId: "user",
        senderType: "user",
        senderName: t("chat.youName"),
        text: nextText,
      };
      const nextHistory = [...messagesRef.current, nextUserMessage];
      messagesRef.current = nextHistory;
      setMessages(nextHistory);

      try {
        const mentions = activeMode === "group" ? parseChatMentions(podcast, nextText) : [];
        const response = await requestChatReply({
          podcast,
          question: nextText,
          history: asHistory(nextHistory),
          mode: activeMode,
          mentions,
        });

        if (turnId !== turnRef.current) {
          return;
        }

        const replyMessages =
          activeMode === "group"
            ? (response.replies ?? []).map(
                (reply) =>
                  ({
                    id: reply.id,
                    senderId: reply.senderId,
                    senderType: "speaker",
                    senderName: reply.senderName,
                    text: reply.text,
                    ...(reply.speechText ? { speechText: reply.speechText } : {}),
                    ...(reply.speechStyle ? { speechStyle: reply.speechStyle } : {}),
                    ...(reply.speechEmotion ? { speechEmotion: reply.speechEmotion } : {}),
                  }) satisfies UiMessage,
              )
            : response.reply
              ? [
                  {
                    id: nextMessageId("speaker"),
                    senderId: podcast.aiHostSpeakerId ?? "ai-host",
                    senderType: "speaker" as const,
                    senderName: podcast.aiHost ?? "AI Host",
                    text: response.reply,
                    ...(response.speechText ? { speechText: response.speechText } : {}),
                    ...(response.speechStyle ? { speechStyle: response.speechStyle } : {}),
                    ...(response.speechEmotion ? { speechEmotion: response.speechEmotion } : {}),
                  },
                ]
              : [];

        if (replyMessages.length === 0) {
          return;
        }

        await playReplyQueue(
          replyMessages.map(toChatReplyMessage),
          turnId,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("chat.error.sendMessage"));
      } finally {
        if (turnId === turnRef.current) {
          sendingRef.current = false;
          setSending(false);
        }
      }
    },
    [
      activeMode,
      nextMessageId,
      playReplyQueue,
      podcast,
      interruptConversationTurn,
      t,
    ],
  );

  useEffect(() => {
    const Recognition = getSpeechRecognitionConstructor();
    const shouldRun = open && groupVoiceReadyForConversation && Recognition !== null;

    setVoiceSupported(Boolean(Recognition));

    if (!shouldRun) {
      stopRecognition(recognitionRef.current);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = podcast.targetLang === "zh" ? "zh-CN" : "en-US";
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) {
        return;
      }

      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult?.[0]?.transcript?.trim() ?? "";

      if (!transcript || matchesCurrentReplyTranscript(transcript, activeReplySpeechTextRef.current)) {
        return;
      }

      setVoiceError(null);

      if (
        audioPendingRef.current ||
        audioPlayingRef.current ||
        Boolean(pendingWelcomeRef.current) ||
        sendingRef.current
      ) {
        interruptConversationTurn();
      }

      if (lastResult?.isFinal !== false) {
        void submitMessage(transcript, { allowInterruptDuringGeneration: true });
      }
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) {
        return;
      }

      if (isIgnorableRecognitionError(event.error)) {
        setVoiceError(null);
        return;
      }

      setVoiceError(event.error ?? t("chat.error.voiceInput"));
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition && open && groupVoiceReadyForConversation) {
        try {
          recognition.start();
        } catch {
          void 0;
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setVoiceError(null);
    } catch (error) {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      setVoiceError(error instanceof Error ? error.message : t("chat.error.voiceInput"));
    }

    return () => {
      stopRecognition(recognition);
    };
  }, [groupVoiceReadyForConversation, interruptConversationTurn, open, podcast.targetLang, stopRecognition, submitMessage, t]);

  const startNewSession = useCallback(() => {
    stopAudioPlayback();
    setMessages(resolveInitialMessages(activeMode, []));
    setInput("");
    setSending(false);
    setVoiceError(null);
    setSessionBootstrapped(true);
    window.localStorage.removeItem(sessionStorageKey);
  }, [activeMode, resolveInitialMessages, sessionStorageKey, stopAudioPlayback]);

  if (!open) {
    return null;
  }

  if (!isPodcastReady(podcast)) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed bottom-4 right-4 z-50 flex h-[560px] w-[360px] flex-col overflow-hidden rounded-2xl border border-accent/40 bg-card shadow-2xl shadow-accent/10 sm:w-[420px]">
        <div className="flex items-center justify-between border-b border-border bg-accent/5 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{t("chat.title")}</span>
              {groupCapable && (
                <div className="flex items-center rounded-full bg-secondary p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => switchChatMode("personal")}
                    className={`rounded-full px-2.5 py-1 ${activeMode === "personal" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                  >
                    {t("chat.mode.personal")}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchChatMode("group")}
                    className={`rounded-full px-2.5 py-1 ${activeMode === "group" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                  >
                    {t("chat.mode.group")}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={startNewSession}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title={t("chat.newSession")}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                stopAudioPlayback();
                onClose();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
              title={t("chat.endChat")}
            >
              <Phone className="h-3.5 w-3.5 rotate-[135deg]" />
            </button>
          </div>
        </div>

        <div className="border-b border-border bg-secondary/20 px-3 py-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5" role="status" aria-live="polite">
              <div
                data-call-state={callStatus.state}
                className={`relative flex h-8 w-12 shrink-0 items-center justify-center ${callStatus.toneClass}`}
              >
                <div
                  className={`absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md ${callStatus.glowClass}`}
                />
                <CallWaveform animated={callStatus.waveformAnimated} />
              </div>
              <p className="truncate text-[12px] font-medium text-foreground">{callStatus.label}</p>
            </div>
            <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={persistSession}
                onChange={(event) => setPersistSession(event.target.checked)}
              />
              {t("chat.persistSession")}
            </label>
          </div>
        </div>

        {activeMode === "group" && (
          <div className="border-b border-border bg-secondary/20 px-3 py-1.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{t("chat.participants")}</span>
                {preparingVoices && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              </div>
              <button
                type="button"
                onClick={() => insertMention("@all")}
                className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
              >
                @all
              </button>
            </div>
            <div
              ref={participantListRef}
              className={`flex flex-wrap gap-1.5 overflow-hidden transition-[max-height] duration-200 ${
                participantsExpanded ? "max-h-80" : "max-h-9"
              }`}
            >
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-1 rounded-full border border-border bg-card pr-1 text-[10px]"
                >
                  <button
                    type="button"
                    onClick={() => insertMention(participant.handle)}
                    className="flex items-center gap-1 px-1.5 py-0.5"
                    title={t("chat.mentionSpeaker", { name: participant.name })}
                  >
                    <span className="font-medium text-foreground">{participant.handle}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 ${
                        participant.voiceStatus === "ready"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : participant.voiceStatus === "failed"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {t(`chat.voiceStatus.${participant.voiceStatus}` as never)}
                    </span>
                  </button>
                  {participant.voiceStatus === "failed" && (
                    <button
                      type="button"
                      onClick={() => {
                        void recloneGroupVoice(podcast.id, participant.id)
                          .then((result) => mergeServerPodcast(result.podcast))
                          .catch((error) =>
                            toast.error(error instanceof Error ? error.message : t("chat.error.recloneVoice")),
                          );
                      }}
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                      title={t("chat.recloneVoice")}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {participantListOverflowing && (
              <button
                type="button"
                onClick={() => setParticipantsExpanded((current) => !current)}
                className="mt-1 text-[10px] font-medium text-accent transition-colors hover:opacity-80"
              >
                {participantsExpanded ? t("chat.collapse") : t("chat.expandAll")}
              </button>
            )}
          </div>
        )}

        <div ref={messageListRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {!sessionBootstrapped ? null : messages.length === 0 ? (
            shouldHideEmptyState ? null : (
              <div className="py-10 text-center text-[12px] text-muted-foreground">
                {activeMode === "group" ? t("chat.empty.group") : t("chat.empty.personal")}
              </div>
            )
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-2 ${message.senderType === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    message.senderType === "user"
                      ? "bg-accent text-accent-foreground"
                      : "border border-accent/30 bg-accent/15 text-accent"
                  }`}
                >
                  {message.senderType === "user" ? t("chat.youAvatar") : message.senderName.slice(0, 2).toUpperCase()}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
                    message.senderType === "user"
                      ? "rounded-br-sm bg-accent text-accent-foreground"
                      : "rounded-bl-sm bg-secondary text-foreground"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))
          )}
        </div>

        {mentionSuggestions.length > 0 && activeMode === "group" && (
          <div className="border-t border-border bg-card px-3 py-2">
            <div className="flex flex-wrap gap-2">
              {mentionSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => insertMention(suggestion.handle)}
                  className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-foreground"
                >
                  {suggestion.handle}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border px-3 py-2.5">
          <div className="relative">
            <input
              ref={inputRef}
              autoFocus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void submitMessage(input);
                }
              }}
              placeholder={activeMode === "group" ? t("chat.groupPlaceholder") : t("chat.placeholder")}
              className="h-9 w-full rounded-full bg-secondary px-3 pr-10 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={() => void submitMessage(input)}
              disabled={!input.trim() || sending}
              aria-label={t("common.send")}
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

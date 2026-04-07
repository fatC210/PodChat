"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Phone, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import {
  buildVoiceAgentFirstMessage,
  buildVoiceAgentPrompt,
  buildVoiceReplyLanguageContext,
  resolveVoiceAgentLanguage,
} from "@/lib/chat";
import { isIgnorableUserMessageText, normalizeFloatingChatMessage } from "@/lib/floating-chat";
import { useI18n } from "@/lib/i18n";
import { ensurePatchedElevenLabsClient } from "@/lib/patch-elevenlabs-client";
import { isPodcastReady, type Podcast } from "@/lib/podchat-data";
import { usePreparedAgentSession } from "@/lib/use-prepared-agent-session";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
}

interface QueuedMessage {
  text: string;
  languageContext: string | null;
}

interface FloatingChatProps {
  open: boolean;
  onClose: () => void;
  podcast: Podcast;
}

function FloatingChatPanel({ podcast, onClose }: { podcast: Podcast; onClose: () => void }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [startingCall, setStartingCall] = useState(false);
  const [shouldAutoStart, setShouldAutoStart] = useState(true);
  const currentPodcastIdRef = useRef<string | null>(null);
  const lastKnownVoiceIdRef = useRef<string | null>(podcast.aiHostVoiceId ?? null);
  const pendingMessagesRef = useRef<QueuedMessage[]>([]);
  const pendingUserEchoesRef = useRef<string[]>([]);
  const messageIdCounterRef = useRef(0);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const sendContextualUpdateRef = useRef<(text: string) => void>(() => {});
  const {
    preparedSessionReady,
    preparingSession,
    prepareSession,
    clearPreparedSession,
    takePreparedSession,
  } = usePreparedAgentSession();
  const {
    startSession,
    endSession,
    sendUserMessage,
    sendContextualUpdate,
    status,
    mode,
    isSpeaking,
    isListening,
  } = useConversation({
    onMessage: (payload) => {
      const nextMessage = normalizeFloatingChatMessage(payload);

      if (!nextMessage) {
        return;
      }

      if (nextMessage.role === "user") {
        const echoedMessageIndex = pendingUserEchoesRef.current.findIndex((text) => text === nextMessage.text);

        if (echoedMessageIndex >= 0) {
          pendingUserEchoesRef.current.splice(echoedMessageIndex, 1);
          return;
        }

        const replyLanguageContext = buildVoiceReplyLanguageContext(nextMessage.text);

        if (replyLanguageContext) {
          sendContextualUpdateRef.current(replyLanguageContext);
        }
      }

      setMessages((current) => {
        const id = nextMessage.id ?? nextTransientMessageId(`incoming-${nextMessage.role}`);
        const existingIndex = current.findIndex((message) => message.id === id);

        if (existingIndex >= 0) {
          return current.map((message, index) => (index === existingIndex ? { ...message, text: nextMessage.text } : message));
        }

        return [...current, { id, role: nextMessage.role, text: nextMessage.text }];
      });
    },
    onError: (message) => {
      toast.error(message);
    },
  });
  sendContextualUpdateRef.current = sendContextualUpdate;

  useEffect(() => {
    ensurePatchedElevenLabsClient();
  }, []);

  useEffect(() => {
    if (currentPodcastIdRef.current === podcast.id) {
      return;
    }

    if (currentPodcastIdRef.current && currentPodcastIdRef.current !== podcast.id) {
      endSession();
    }

    currentPodcastIdRef.current = podcast.id;
    pendingMessagesRef.current = [];
    pendingUserEchoesRef.current = [];
    setMessages([]);
    setInput("");
    setElapsed(0);
    lastKnownVoiceIdRef.current = podcast.aiHostVoiceId ?? null;
    clearPreparedSession();
    setStartingCall(false);
    setShouldAutoStart(true);
  }, [clearPreparedSession, endSession, podcast.aiHostVoiceId, podcast.id]);

  useEffect(() => {
    if (status === "connecting" || status === "connected") {
      setStartingCall(false);
    }
  }, [status]);

  useEffect(() => {
    const nextVoiceId = podcast.aiHostVoiceId ?? null;
    const previousVoiceId = lastKnownVoiceIdRef.current;
    const hasVoiceChanged = previousVoiceId !== null && previousVoiceId !== nextVoiceId;

    lastKnownVoiceIdRef.current = nextVoiceId;

    if (status !== "connected" || !nextVoiceId || !hasVoiceChanged) {
      return;
    }

    setShouldAutoStart(true);
    endSession();
    toast(t("chat.voiceUpdatedReconnect"));
  }, [endSession, podcast.aiHostVoiceId, status, t]);

  useEffect(() => {
    if (status !== "connected") {
      return;
    }

    setElapsed(0);
    const interval = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);

  useEffect(() => {
    const list = messageListRef.current;

    if (!list) {
      return;
    }

    list.scrollTop = list.scrollHeight;
  }, [messages]);

  const statusLabel = useMemo(() => {
    if (startingCall || status === "connecting") {
      return "Connecting";
    }

    if (status === "connected") {
      if (isSpeaking || mode === "speaking") {
        return "AI speaking";
      }

      if (isListening || mode === "listening") {
        return "Listening";
      }

      return "Connected";
    }

    if (status === "error") {
      return "Connection error";
    }

    return "Disconnected";
  }, [isListening, isSpeaking, mode, startingCall, status]);

  const headerHint = status === "connected" ? t("chat.connectedHint") : t("chat.connectingHint");

  const nextTransientMessageId = useCallback((prefix: string) => {
    messageIdCounterRef.current += 1;
    return `${prefix}-${Date.now()}-${messageIdCounterRef.current}`;
  }, []);

  const appendLocalUserMessage = useCallback((text: string) => {
    pendingUserEchoesRef.current = [...pendingUserEchoesRef.current, text];
    setMessages((current) => [
      ...current,
      {
        id: nextTransientMessageId("user-local"),
        role: "user",
        text,
      },
    ]);
  }, [nextTransientMessageId]);

  const startLiveCall = useCallback(async () => {
    if (startingCall || status === "connected" || status === "connecting") {
      return;
    }

    setStartingCall(true);

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }

      const session = preparedSessionReady ? takePreparedSession() : await prepareSession(true);
      clearPreparedSession();

      startSession({
        signedUrl: session.signedUrl,
        connectionType: "websocket",
        userId: `podchat-floating-${podcast.id}`,
        overrides: {
          agent: {
            prompt: {
              prompt: buildVoiceAgentPrompt(podcast),
            },
            firstMessage: buildVoiceAgentFirstMessage(podcast),
            language: resolveVoiceAgentLanguage(podcast, pendingMessagesRef.current[0]?.text),
          },
          tts: {
            voiceId: podcast.aiHostVoiceId ?? undefined,
            stability: 0.45,
            similarityBoost: 0.75,
            speed: 1,
          },
          conversation: {
            textOnly: false,
          },
        },
      });
    } catch (error) {
      clearPreparedSession();
      setStartingCall(false);
      toast.error(error instanceof Error ? error.message : "Failed to start live call.");
    }
  }, [
    clearPreparedSession,
    podcast,
    preparedSessionReady,
    prepareSession,
    startSession,
    startingCall,
    status,
    takePreparedSession,
  ]);

  const stopLiveCall = useCallback(() => {
    if (status === "connected" || status === "connecting") {
      endSession();
    }
  }, [endSession, status]);

  useEffect(() => {
    if (!shouldAutoStart) {
      return;
    }

    if (startingCall || preparingSession || status === "connected" || status === "connecting") {
      return;
    }

    setShouldAutoStart(false);
    void startLiveCall();
  }, [preparingSession, shouldAutoStart, startLiveCall, startingCall, status]);

  useEffect(() => {
    if (status !== "connected" || pendingMessagesRef.current.length === 0) {
      return;
    }

    const queuedMessages = pendingMessagesRef.current;
    pendingMessagesRef.current = [];

    try {
      queuedMessages.forEach((message) => {
        if (message.languageContext) {
          sendContextualUpdate(message.languageContext);
        }

        sendUserMessage(message.text);
      });
    } catch (error) {
      pendingMessagesRef.current = [...queuedMessages, ...pendingMessagesRef.current];
      toast.error(error instanceof Error ? error.message : "Failed to send the queued message.");
    }
  }, [sendContextualUpdate, sendUserMessage, status]);

  const newSession = useCallback(() => {
    pendingMessagesRef.current = [];
    pendingUserEchoesRef.current = [];
    stopLiveCall();
    setMessages([]);
    setInput("");
    setElapsed(0);
    clearPreparedSession();
    setShouldAutoStart(true);
  }, [clearPreparedSession, stopLiveCall]);

  const sendText = useCallback(() => {
    const nextInput = input.trim();
    const languageContext = buildVoiceReplyLanguageContext(nextInput);

    if (!nextInput || isIgnorableUserMessageText(nextInput)) {
      setInput("");
      return;
    }

    setInput("");
    appendLocalUserMessage(nextInput);

    if (status === "connected") {
      if (languageContext) {
        sendContextualUpdate(languageContext);
      }

      sendUserMessage(nextInput);
      return;
    }

    const shouldShowQueuedNotice = pendingMessagesRef.current.length === 0;
    pendingMessagesRef.current = [...pendingMessagesRef.current, { text: nextInput, languageContext }];
    setShouldAutoStart(true);

    if (shouldShowQueuedNotice) {
      toast(t("chat.queueing"));
    }
  }, [appendLocalUserMessage, input, sendContextualUpdate, sendUserMessage, status, t]);

  const fmt = (value: number) =>
    `${Math.floor(value / 60)
      .toString()
      .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed bottom-4 right-4 z-50 w-[340px] sm:w-[380px] h-[500px] flex flex-col rounded-2xl bg-card border border-accent/40 shadow-2xl shadow-accent/10 overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-accent/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-[9px] font-bold text-accent">
                  {podcast.aiHost?.slice(0, 2).toUpperCase() ?? "AI"}
                </span>
              </div>
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent" />
              {status === "connected" && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent animate-ping" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 leading-tight">
                <span className="text-[12px] font-semibold text-foreground">{t("chat.title")}</span>
                <span className="text-[10px] text-muted-foreground">{headerHint}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-accent font-medium">{statusLabel}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{fmt(elapsed)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={newSession}
              className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center"
              title={t("chat.newSession")}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                stopLiveCall();
                onClose();
              }}
              className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center"
              title={t("chat.endChat")}
            >
              <Phone className="h-3.5 w-3.5 rotate-[135deg]" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-[2px] h-5 bg-accent/5 shrink-0">
          {Array.from({ length: 24 }).map((_, index) => (
            <div
              key={index}
              className={`w-[2px] rounded-full ${status === "connected" ? "bg-accent/50" : "bg-muted-foreground/20"}`}
              style={{
                height: `${4 + ((index * 7) % 8)}px`,
                animationName: status === "connected" ? "pulse" : undefined,
                animationDuration: `${0.6 + (index % 4) * 0.2}s`,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationDelay: `${index * 50}ms`,
              }}
            />
          ))}
        </div>

        <div ref={messageListRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-[12px] text-muted-foreground py-10">
              {status === "connected"
                ? t("chat.emptyConnected")
                : t("chat.emptyConnecting")}
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-2 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {message.role === "ai" && (
                  <div className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold bg-accent/15 border border-accent/30 text-accent">
                    {podcast.aiHost?.slice(0, 2).toUpperCase() ?? "AI"}
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-3 py-2 text-[12px] leading-relaxed ${
                    message.role === "user"
                      ? "bg-accent text-accent-foreground rounded-2xl rounded-br-sm"
                      : "bg-secondary text-foreground rounded-2xl rounded-bl-sm"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-3 py-2.5 border-t border-border shrink-0">
          <div className="relative">
            <input
              autoFocus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && sendText()}
              placeholder={t("chat.placeholder")}
              className="w-full h-8 px-3 pr-9 rounded-full bg-secondary text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={sendText}
              disabled={!input.trim() || isIgnorableUserMessageText(input)}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center disabled:opacity-20 hover:opacity-90 transition-opacity shrink-0"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function FloatingChat({ open, onClose, podcast }: FloatingChatProps) {
  if (!open) {
    return null;
  }

  return (
    <ConversationProvider>
      <FloatingChatPanel podcast={podcast} onClose={onClose} />
    </ConversationProvider>
  );
}

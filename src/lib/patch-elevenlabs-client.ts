"use client";

import { WebSocketConnection } from "@elevenlabs/client";

declare global {
  interface Window {
    __podchatElevenLabsPatched?: boolean;
  }
}

type PatchableWebSocketConnectionPrototype = {
  sendMessage?: (this: unknown, message: unknown) => void;
};

function getOpenableSocket(target: unknown) {
  if (!target || typeof target !== "object") {
    return null;
  }

  const socket = Reflect.get(target, "socket");
  return socket instanceof WebSocket ? socket : null;
}

export function ensurePatchedElevenLabsClient() {
  if (typeof window === "undefined" || window.__podchatElevenLabsPatched) {
    return;
  }

  const prototype = WebSocketConnection.prototype as unknown as PatchableWebSocketConnectionPrototype;
  const originalSendMessage = prototype.sendMessage;

  if (typeof originalSendMessage !== "function") {
    return;
  }

  prototype.sendMessage = function patchedSendMessage(message: unknown) {
    const socket = getOpenableSocket(this);

    if (socket && socket.readyState !== WebSocket.OPEN) {
      return;
    }

    originalSendMessage.call(this, message);
  };

  window.__podchatElevenLabsPatched = true;
}

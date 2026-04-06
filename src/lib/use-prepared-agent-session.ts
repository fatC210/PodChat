"use client";

import { useCallback, useRef, useState } from "react";
import { startAgentSession, type AgentSessionResponse } from "@/lib/api";

const PREPARED_SESSION_TTL_MS = 14 * 60 * 1000;

export function usePreparedAgentSession() {
  const preparedSessionRef = useRef<AgentSessionResponse | null>(null);
  const preparedAtRef = useRef<number | null>(null);
  const requestRef = useRef<Promise<AgentSessionResponse> | null>(null);
  const generationRef = useRef(0);
  const [preparedSessionReady, setPreparedSessionReady] = useState(false);
  const [preparingSession, setPreparingSession] = useState(false);

  const clearPreparedSession = useCallback(() => {
    generationRef.current += 1;
    preparedSessionRef.current = null;
    preparedAtRef.current = null;
    requestRef.current = null;
    setPreparedSessionReady(false);
    setPreparingSession(false);
  }, []);

  const prepareSession = useCallback(async (forceRefresh = false) => {
    const isPreparedSessionFresh =
      preparedSessionRef.current &&
      preparedAtRef.current &&
      Date.now() - preparedAtRef.current < PREPARED_SESSION_TTL_MS;

    if (!forceRefresh && isPreparedSessionFresh) {
      return preparedSessionRef.current;
    }

    if (!forceRefresh && requestRef.current) {
      return await requestRef.current;
    }

    const generation = generationRef.current;
    setPreparingSession(true);
    setPreparedSessionReady(false);

    const request = startAgentSession()
      .then((session) => {
        if (generation === generationRef.current) {
          preparedSessionRef.current = session;
          preparedAtRef.current = Date.now();
          setPreparedSessionReady(true);
        }

        return session;
      })
      .catch((error) => {
        if (generation === generationRef.current) {
          preparedSessionRef.current = null;
          preparedAtRef.current = null;
          setPreparedSessionReady(false);
        }

        throw error;
      })
      .finally(() => {
        if (generation === generationRef.current) {
          requestRef.current = null;
          setPreparingSession(false);
        }
      });

    requestRef.current = request;
    return await request;
  }, []);

  const takePreparedSession = useCallback(() => {
    const session = preparedSessionRef.current;

    if (!session) {
      throw new Error("Live call is still preparing. Please wait a moment and try again.");
    }

    preparedSessionRef.current = null;
    preparedAtRef.current = null;
    setPreparedSessionReady(false);
    return session;
  }, []);

  return {
    preparedSessionReady,
    preparingSession,
    prepareSession,
    clearPreparedSession,
    takePreparedSession,
  };
}

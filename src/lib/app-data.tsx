"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createPodcast as createPodcastRequest,
  deletePodcast as deletePodcastRequest,
  fetchPodcasts as fetchPodcastsRequest,
  fetchIntegrationSettings as fetchIntegrationSettingsRequest,
  patchPodcast as patchPodcastRequest,
  regeneratePodcast as regeneratePodcastRequest,
  saveIntegrationSettings as saveIntegrationSettingsRequest,
} from "@/lib/api";
import {
  applyClientPodcastState,
  clientPodcastStateFields,
  defaultIntegrationSettings,
  getClientPodcastState,
  isLegacyMockPodcast,
  normalizeIntegrationSettings,
  resetPodcastForProcessing,
  sortPodcasts,
  type ClientPodcastState,
  type IntegrationSettings,
  type Podcast,
  type SavePodcastInput,
} from "@/lib/podchat-data";

const clientStateStorageKey = "podchat_client_state_v3";
const legacyStorageKey = "podchat_app_data_v2";

const clientPodcastStateFieldSet = new Set<string>(clientPodcastStateFields);
const serverEditableFieldSet = new Set<string>([
  "title",
  "type",
  "referenceCount",
  "sourceFileName",
  "sourceFileSizeMb",
  "aiHost",
  "guestName",
  "persona",
  "speakers",
  "speakerProfiles",
  "summaries",
  "transcript",
]);

interface StoredClientState {
  integrationSettings: IntegrationSettings;
  podcastClientState: Record<string, Partial<ClientPodcastState>>;
}

interface AppDataContextValue {
  hydrated: boolean;
  podcasts: Podcast[];
  integrationSettings: IntegrationSettings;
  savePodcastFromWizard: (input: SavePodcastInput, file: File | null) => Promise<Podcast>;
  updatePodcast: (id: string, updater: (podcast: Podcast) => Podcast) => void;
  regeneratePodcast: (id: string) => Promise<Podcast>;
  deletePodcast: (id: string) => void;
  saveIntegrationSettings: (settings: IntegrationSettings) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function normalizePodcastClientState(state: Partial<ClientPodcastState> | undefined): Partial<ClientPodcastState> {
  if (!state) {
    return {};
  }

  return {
    progressPercent: typeof state.progressPercent === "number" ? state.progressPercent : undefined,
    speed: typeof state.speed === "number" ? state.speed : undefined,
    transcriptMode: state.transcriptMode,
    targetLang: typeof state.targetLang === "string" ? state.targetLang : undefined,
    speakerFilter:
      typeof state.speakerFilter === "string" || state.speakerFilter === null
        ? state.speakerFilter
        : undefined,
  };
}

function parseStoredClientState(raw: string | null): StoredClientState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as
      | Partial<StoredClientState>
      | {
          podcasts?: Podcast[];
          integrationSettings?: Partial<IntegrationSettings>;
        };

    if (Array.isArray((parsed as { podcasts?: Podcast[] }).podcasts)) {
      const legacyPodcasts = ((parsed as { podcasts?: Podcast[] }).podcasts ?? []).filter(
        (podcast) => !isLegacyMockPodcast(podcast),
      );

      return {
        integrationSettings: normalizeIntegrationSettings(parsed.integrationSettings),
        podcastClientState: Object.fromEntries(
          legacyPodcasts.map((podcast) => [podcast.id, getClientPodcastState(podcast)]),
        ),
      };
    }

    const currentPodcastClientState = (parsed as Partial<StoredClientState>).podcastClientState ?? {};

    const nextPodcastClientState = Object.fromEntries(
      Object.entries(currentPodcastClientState).map(([id, state]) => [
        id,
        normalizePodcastClientState(state),
      ]),
    );

    return {
      integrationSettings: normalizeIntegrationSettings(parsed.integrationSettings),
      podcastClientState: nextPodcastClientState,
    };
  } catch {
    return null;
  }
}

function applyClientStateToPodcast(
  podcast: Podcast,
  podcastClientState: Record<string, Partial<ClientPodcastState>>,
) {
  return applyClientPodcastState(podcast, podcastClientState[podcast.id]);
}

function buildPodcastPatch(previousPodcast: Podcast, nextPodcast: Podcast) {
  const patch: Partial<Podcast> = {};

  for (const key of Object.keys(nextPodcast) as Array<keyof Podcast>) {
    if (previousPodcast[key] !== nextPodcast[key]) {
      (patch as Record<string, unknown>)[key] = nextPodcast[key];
    }
  }

  return patch;
}

function pickPatchFields<T extends Record<string, unknown>>(source: T, fieldSet: Set<string>) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => fieldSet.has(key))) as Partial<T>;
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettings>(defaultIntegrationSettings);
  const [podcastClientState, setPodcastClientState] = useState<Record<string, Partial<ClientPodcastState>>>({});
  const podcastsRef = useRef<Podcast[]>([]);
  const podcastClientStateRef = useRef<Record<string, Partial<ClientPodcastState>>>({});

  const setPodcastClientStateWithRef = useCallback(
    (updater: (current: Record<string, Partial<ClientPodcastState>>) => Record<string, Partial<ClientPodcastState>>) => {
      setPodcastClientState((current) => {
        const next = updater(current);
        podcastClientStateRef.current = next;
        return next;
      });
    },
    [],
  );

  const mergePodcasts = useCallback((nextPodcasts: Podcast[]) => {
    setPodcasts(
      sortPodcasts(
        nextPodcasts.map((podcast) => applyClientStateToPodcast(podcast, podcastClientStateRef.current)),
      ),
    );
  }, []);

  const reloadPodcasts = useCallback(async () => {
    const { podcasts: nextPodcasts } = await fetchPodcastsRequest();
    mergePodcasts(nextPodcasts);
  }, [mergePodcasts]);

  useEffect(() => {
    podcastsRef.current = podcasts;
  }, [podcasts]);

  useEffect(() => {
    const storedState =
      parseStoredClientState(window.localStorage.getItem(clientStateStorageKey)) ??
      parseStoredClientState(window.localStorage.getItem(legacyStorageKey));

    if (storedState) {
      setIntegrationSettings(storedState.integrationSettings);
      setPodcastClientState(storedState.podcastClientState);
      podcastClientStateRef.current = storedState.podcastClientState;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [{ podcasts: nextPodcasts }, { settings }] = await Promise.all([
          fetchPodcastsRequest(),
          fetchIntegrationSettingsRequest(),
        ]);

        if (!cancelled) {
          setIntegrationSettings(settings);
          mergePodcasts(nextPodcasts);
        }
      } catch (error) {
        console.error("Failed to load podcasts from the backend.", error);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [mergePodcasts]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      clientStateStorageKey,
      JSON.stringify({
        integrationSettings,
        podcastClientState,
      }),
    );
  }, [hydrated, integrationSettings, podcastClientState]);

  useEffect(() => {
    if (!hydrated || !podcasts.some((podcast) => podcast.status === "configuring")) {
      return;
    }

    const interval = window.setInterval(() => {
      void reloadPodcasts().catch((error) => {
        console.error("Failed to refresh podcast processing state.", error);
      });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [hydrated, podcasts, reloadPodcasts]);

  const upsertPodcast = useCallback((podcast: Podcast) => {
    setPodcasts((current) =>
      sortPodcasts([
        applyClientStateToPodcast(podcast, podcastClientStateRef.current),
        ...current.filter((entry) => entry.id !== podcast.id),
      ]),
    );
  }, []);

  const savePodcastFromWizard = useCallback(
    async (input: SavePodcastInput, file: File | null) => {
      if (input.draftId && !file) {
        const { podcast } = await patchPodcastRequest(input.draftId, {
          patch: {
            title: input.title.trim(),
            type: input.type,
            referenceCount: input.referenceCount,
            sourceFileName: input.sourceFileName,
            sourceFileSizeMb: input.sourceFileSizeMb,
          },
          wizard: {
            personaPresetId: input.personaPresetId,
            personaLocale: input.personaLocale,
            customPersonality: input.customPersonality,
            customCatchphrases: input.customCatchphrases,
            customAnswerStyle: input.customAnswerStyle,
          },
        });

        upsertPodcast(podcast);
        return applyClientStateToPodcast(podcast, podcastClientStateRef.current);
      }

      if (!file) {
        throw new Error("A source file is required before creating a podcast.");
      }

      const { podcast } = await createPodcastRequest(input, file);
      upsertPodcast(podcast);
      return applyClientStateToPodcast(podcast, podcastClientStateRef.current);
    },
    [upsertPodcast],
  );

  const updatePodcast = useCallback(
    (id: string, updater: (podcast: Podcast) => Podcast) => {
      const currentPodcast = podcastsRef.current.find((podcast) => podcast.id === id);

      if (!currentPodcast) {
        return;
      }

      const nextPodcast = updater(currentPodcast);
      const patch = buildPodcastPatch(currentPodcast, nextPodcast);
      const clientPatch = pickPatchFields(patch as Record<string, unknown>, clientPodcastStateFieldSet) as Partial<ClientPodcastState>;
      const serverPatch = pickPatchFields(patch as Record<string, unknown>, serverEditableFieldSet) as Partial<Podcast>;

      setPodcasts((current) =>
        sortPodcasts(current.map((podcast) => (podcast.id === id ? nextPodcast : podcast))),
      );

      if (Object.keys(clientPatch).length > 0) {
        setPodcastClientStateWithRef((current) => ({
          ...current,
          [id]: {
            ...current[id],
            ...clientPatch,
          },
        }));
      }

      if (Object.keys(serverPatch).length > 0) {
        void patchPodcastRequest(id, { patch: serverPatch })
          .then(({ podcast }) => {
            upsertPodcast(podcast);
          })
          .catch((error) => {
            console.error(`Failed to persist podcast update for ${id}.`, error);
          });
      }
    },
    [setPodcastClientStateWithRef, upsertPodcast],
  );

  const regeneratePodcast = useCallback(
    async (id: string) => {
      const currentPodcast = podcastsRef.current.find((podcast) => podcast.id === id);
      const hadPreviousClientState = Object.prototype.hasOwnProperty.call(podcastClientStateRef.current, id);
      const previousClientState = podcastClientStateRef.current[id] ?? {};
      const nextClientState: Partial<ClientPodcastState> = {
        ...previousClientState,
        progressPercent: 0,
        speakerFilter: null,
      };

      if (currentPodcast) {
        setPodcasts((current) =>
          sortPodcasts(
            current.map((podcast) =>
              podcast.id === id
                ? applyClientPodcastState(resetPodcastForProcessing(podcast), nextClientState)
                : podcast,
            ),
          ),
        );
      }

      setPodcastClientStateWithRef((current) => ({
        ...current,
        [id]: nextClientState,
      }));

      try {
        const { podcast } = await regeneratePodcastRequest(id);
        upsertPodcast(podcast);
        return applyClientPodcastState(podcast, nextClientState);
      } catch (error) {
        if (currentPodcast) {
          setPodcasts((current) =>
            sortPodcasts(current.map((podcast) => (podcast.id === id ? currentPodcast : podcast))),
          );
        }

        setPodcastClientStateWithRef((current) => {
          const next = { ...current };

          if (hadPreviousClientState) {
            next[id] = previousClientState;
          } else {
            delete next[id];
          }

          return next;
        });

        throw error;
      }
    },
    [setPodcastClientStateWithRef, upsertPodcast],
  );

  const deletePodcast = useCallback(
    (id: string) => {
      setPodcasts((current) => current.filter((podcast) => podcast.id !== id));
      setPodcastClientStateWithRef((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });

      void deletePodcastRequest(id).catch((error) => {
        console.error(`Failed to delete podcast ${id}.`, error);
        void reloadPodcasts().catch((reloadError) => {
          console.error("Failed to reload podcasts after a delete error.", reloadError);
        });
      });
    },
    [reloadPodcasts, setPodcastClientStateWithRef],
  );

  const saveIntegrationSettings = useCallback(async (settings: IntegrationSettings) => {
    const normalized = normalizeIntegrationSettings(settings);
    const elevenLabsKeyChanged = integrationSettings.elevenlabs.trim() !== normalized.elevenlabs.trim();
    setIntegrationSettings(normalized);

    try {
      const response = await saveIntegrationSettingsRequest(normalized);
      setIntegrationSettings(response.settings);
      if (elevenLabsKeyChanged) {
        await reloadPodcasts();
      }
    } catch (error) {
      void fetchIntegrationSettingsRequest()
        .then(({ settings: storedSettings }) => {
          setIntegrationSettings(storedSettings);
        })
        .catch((reloadError) => {
          console.error("Failed to reload integration settings after a save error.", reloadError);
        });

      throw error;
    }
  }, [integrationSettings.elevenlabs, reloadPodcasts]);

  const value = useMemo(
    () => ({
      hydrated,
      podcasts,
      integrationSettings,
      savePodcastFromWizard,
      updatePodcast,
      regeneratePodcast,
      deletePodcast,
      saveIntegrationSettings,
    }),
    [
      deletePodcast,
      hydrated,
      integrationSettings,
      podcasts,
      regeneratePodcast,
      saveIntegrationSettings,
      savePodcastFromWizard,
      updatePodcast,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }

  return context;
}

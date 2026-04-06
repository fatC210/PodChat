import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithUpstreamErrorContext } from "@/lib/server/integrations";

describe("fetchWithUpstreamErrorContext", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes service and network cause details when fetch throws a generic error", async () => {
    const fetchError = new TypeError("fetch failed");
    Object.defineProperty(fetchError, "cause", {
      value: {
        code: "ENOTFOUND",
        syscall: "getaddrinfo",
        hostname: "api.elevenlabs.io",
        message: "getaddrinfo ENOTFOUND api.elevenlabs.io",
      },
    });

    vi.spyOn(global, "fetch").mockRejectedValue(fetchError);

    await expect(
      fetchWithUpstreamErrorContext("ElevenLabs speech-to-text API", "https://api.elevenlabs.io/v1/speech-to-text"),
    ).rejects.toThrow(/Failed to reach ElevenLabs speech-to-text API: ENOTFOUND \| getaddrinfo \| api\.elevenlabs\.io/);
  });
});

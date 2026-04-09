import { afterEach, describe, expect, it, vi } from "vitest";
import { getMaxUploadSizeBytes, getMaxUploadSizeMb, isFileTooLarge } from "@/lib/upload-limits";

describe("upload limits", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the fallback limit when no env override is present", () => {
    expect(getMaxUploadSizeMb()).toBe(32);
    expect(getMaxUploadSizeBytes()).toBe(32 * 1024 * 1024);
  });

  it("respects NEXT_PUBLIC_MAX_UPLOAD_MB when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_MAX_UPLOAD_MB", "12");

    expect(getMaxUploadSizeMb()).toBe(12);
    expect(isFileTooLarge({ size: 13 * 1024 * 1024 } as File)).toBe(true);
    expect(isFileTooLarge({ size: 11 * 1024 * 1024 } as File)).toBe(false);
  });
});

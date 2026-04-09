const fallbackHostedUploadLimitMb = 32;

function readUploadLimitFromEnv() {
  const rawValue = process.env.NEXT_PUBLIC_MAX_UPLOAD_MB;

  if (!rawValue) {
    return fallbackHostedUploadLimitMb;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackHostedUploadLimitMb;
}

export function getMaxUploadSizeMb() {
  return readUploadLimitFromEnv();
}

export function getMaxUploadSizeBytes() {
  return getMaxUploadSizeMb() * 1024 * 1024;
}

export function isFileTooLarge(file: Pick<File, "size">) {
  return file.size > getMaxUploadSizeBytes();
}

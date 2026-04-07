import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isMediaPlaybackInterruption(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  const message =
    "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  return (
    name === "AbortError" ||
    message.includes("interrupted by a call to pause") ||
    message.includes("interrupted by a new load request") ||
    message.includes("play() request was interrupted")
  );
}

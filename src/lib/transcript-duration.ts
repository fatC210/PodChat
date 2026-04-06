import { formatClock, timeToSeconds, type TranscriptLine } from "@/lib/podchat-data";

export interface TimedTranscriptSegment {
  startSeconds: number;
  endSeconds: number;
}

export function getTimedTranscriptDurationSeconds(segments: TimedTranscriptSegment[]) {
  return segments.reduce((maxDuration, segment) => {
    return Math.max(maxDuration, segment.startSeconds, segment.endSeconds);
  }, 0);
}

export function resolveTranscriptionDurationSeconds(
  transcriptLines: TimedTranscriptSegment[],
  hasWordTimestamps: boolean,
) {
  const timedDuration = getTimedTranscriptDurationSeconds(transcriptLines);

  if (hasWordTimestamps) {
    return timedDuration;
  }

  return Math.max(timedDuration, transcriptLines.length * 8);
}

export function getTranscriptDurationSeconds(
  transcript: Array<Pick<TranscriptLine, "time" | "endTime">>,
) {
  return transcript.reduce((maxDuration, line) => {
    const endSeconds = timeToSeconds(line.endTime ?? line.time);
    return Math.max(maxDuration, endSeconds);
  }, 0);
}

export function normalizeDisplayDuration(
  currentDuration: string,
  transcript: Array<Pick<TranscriptLine, "time" | "endTime">>,
) {
  const transcriptDurationSeconds = getTranscriptDurationSeconds(transcript);

  if (transcriptDurationSeconds <= 0) {
    return currentDuration;
  }

  return formatClock(Math.ceil(transcriptDurationSeconds));
}

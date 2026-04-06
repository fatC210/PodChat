import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getStoredPodcastAsset } from "@/lib/server/podcast-store";

function inferMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const asset = await getStoredPodcastAsset(id);

  if (!asset) {
    return NextResponse.json({ error: "Podcast asset not found." }, { status: 404 });
  }

  const fileStat = await stat(asset.uploadedFilePath);
  const range = request.headers.get("range");
  const contentType = inferMimeType(asset.sourceFileName);

  if (!range) {
    const stream = createReadStream(asset.uploadedFilePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileStat.size),
        "Accept-Ranges": "bytes",
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.sourceFileName)}"`,
      },
    });
  }

  const [rawStart, rawEnd] = range.replace(/bytes=/, "").split("-");
  const start = Number.parseInt(rawStart, 10);
  const end = rawEnd ? Number.parseInt(rawEnd, 10) : fileStat.size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= fileStat.size) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${fileStat.size}`,
      },
    });
  }

  const stream = createReadStream(asset.uploadedFilePath, { start, end });

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
      "Content-Disposition": `inline; filename="${encodeURIComponent(asset.sourceFileName)}"`,
    },
  });
}

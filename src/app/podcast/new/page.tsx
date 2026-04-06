import { Suspense } from "react";
import NewPodcastPage from "@/views/NewPodcast";

export default function NewPodcastRoute() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-8 text-sm text-muted-foreground">Loading...</div>}>
      <NewPodcastPage />
    </Suspense>
  );
}

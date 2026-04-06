import { Suspense } from "react";
import SummaryPage from "@/views/Summary";

export default function SummaryRoute() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-8 text-sm text-muted-foreground">Loading...</div>}>
      <SummaryPage />
    </Suspense>
  );
}

"use client";

import { useBackNavigation } from "@/lib/navigation";

const NotFound = () => {
  const goBack = useBackNavigation("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center px-4">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <button onClick={goBack} className="text-primary underline hover:text-primary/90">
          Go Back
        </button>
      </div>
    </div>
  );
};

export default NotFound;

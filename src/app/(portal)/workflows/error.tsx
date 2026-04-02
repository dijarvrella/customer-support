"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function WorkflowsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[workflows]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <h2 className="text-lg font-semibold">Workflows page failed to load</h2>
      <p className="text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <p className="text-sm text-muted-foreground">
        If this appeared after a deploy, apply the latest database schema for
        this project (including{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          workflow_approval_configs
        </code>
        ), then try again.
      </p>
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}

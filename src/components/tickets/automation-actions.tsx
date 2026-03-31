"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface AutomationActionsProps {
  ticketId: string;
  formType: string | null;
  status: string;
  userRole: string;
}

interface AutomationStep {
  name: string;
  success: boolean;
  message?: string;
}

interface AutomationResult {
  success: boolean;
  steps: AutomationStep[];
  temporaryPassword?: string;
  error?: string;
}

export function AutomationActions({
  ticketId,
  formType,
  status,
  userRole,
}: AutomationActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AutomationResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedRoles = ["it_admin", "hr"];
  if (!allowedRoles.includes(userRole)) return null;

  const eligibleStatuses = ["in_progress", "new", "triaged"];
  if (!eligibleStatuses.includes(status)) return null;

  const isOnboarding = formType === "employee-onboarding";
  const isOffboarding = formType === "employee-offboarding";

  if (!isOnboarding && !isOffboarding) return null;

  const automationType = isOnboarding ? "onboarding" : "offboarding";
  const buttonLabel = isOnboarding
    ? "Run Onboarding Automation"
    : "Run Offboarding Automation";
  const buttonVariant = isOnboarding ? "default" : "destructive";

  async function handleConfirm() {
    setConfirmOpen(false);
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/automations/${automationType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.error || `Automation failed with status ${res.status}`
        );
      }

      const data: AutomationResult = await res.json();
      setResult(data);
      setResultOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            Automation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isOnboarding
              ? "Execute the employee onboarding workflow against Microsoft 365."
              : "Execute the employee offboarding workflow against Microsoft 365."}
          </p>

          <Button
            variant={buttonVariant as "default" | "destructive"}
            size="sm"
            className={isOnboarding ? "bg-blue-600 hover:bg-blue-700" : ""}
            disabled={running}
            onClick={() => setConfirmOpen(true)}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {running ? "Running..." : buttonLabel}
          </Button>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Automation
            </DialogTitle>
            <DialogDescription>
              This will execute the {automationType} automation against Microsoft
              365. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={buttonVariant as "default" | "destructive"}
              className={isOnboarding ? "bg-blue-600 hover:bg-blue-700" : ""}
              onClick={handleConfirm}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.success ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Automation {result?.success ? "Completed" : "Failed"}
            </DialogTitle>
            <DialogDescription>
              {isOnboarding ? "Onboarding" : "Offboarding"} automation results
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {result?.steps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-2 rounded-md bg-muted/50"
              >
                {step.success ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{step.name}</p>
                  {step.message && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.message}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={
                    step.success
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-red-100 text-red-800 border-red-200"
                  }
                >
                  {step.success ? "Done" : "Failed"}
                </Badge>
              </div>
            ))}

            {result?.temporaryPassword && (
              <>
                <Separator />
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs font-medium text-blue-800 mb-1">
                    Temporary Password
                  </p>
                  <p className="text-sm font-mono font-bold text-blue-900 select-all">
                    {result.temporaryPassword}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    The user will be prompted to change this on first sign-in.
                  </p>
                </div>
              </>
            )}

            {result?.error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-800">{result.error}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setResultOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

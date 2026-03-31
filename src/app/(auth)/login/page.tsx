"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LogIn, KeyRound } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showBreakGlass, setShowBreakGlass] = useState(false);
  const [bgEmail, setBgEmail] = useState("");
  const [bgPassword, setBgPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleMicrosoftLogin() {
    setIsLoading(true);
    await signIn("microsoft-entra-id", { callbackUrl: "/dashboard" });
  }

  async function handleBreakGlassLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: bgEmail,
        password: bgPassword,
        redirect: false,
      });

      if (result && "error" in result && result.error) {
        setError("Invalid credentials.");
        setIsLoading(false);
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("An unexpected error occurred.");
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/zimark-logo.svg"
              alt="Zimark"
              width={220}
              height={50}
              priority
            />
          </div>
          <p className="text-muted-foreground mt-1">
            IT Service Management Portal
          </p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>
              Use your corporate Microsoft account to access the portal
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button
              className="w-full h-12 text-base"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
            >
              {isLoading && !showBreakGlass ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Redirecting to Microsoft...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 21 21"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                  </svg>
                  Sign in with Microsoft
                </span>
              )}
            </Button>

            {!showBreakGlass && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowBreakGlass(true)}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <KeyRound className="h-3 w-3" />
                  Emergency admin access
                </button>
              </div>
            )}

            {showBreakGlass && (
              <>
                <div className="relative my-2">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    Emergency Access
                  </span>
                </div>

                <form onSubmit={handleBreakGlassLogin} className="space-y-3">
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-800">
                      Break-glass accounts are for emergency admin access only.
                      All actions are logged and audited.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bg-email">Email</Label>
                    <Input
                      id="bg-email"
                      type="email"
                      value={bgEmail}
                      onChange={(e) => setBgEmail(e.target.value)}
                      placeholder="admin@zimark.io"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bg-password">Password</Label>
                    <Input
                      id="bg-password"
                      type="password"
                      value={bgPassword}
                      onChange={(e) => setBgPassword(e.target.value)}
                      required
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-destructive text-center">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={isLoading}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-xs text-muted-foreground">
              Zimark IT Support Portal
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

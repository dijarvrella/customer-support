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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Shield, LogIn } from "lucide-react";
import { getBranding } from "@/lib/branding";

const branding = getBranding();

const DEMO_USERS = [
  { email: "admin@company.com", label: "IT Admin" },
  { email: "agent@company.com", label: "IT Agent" },
  { email: "user@company.com", label: "John Employee" },
  { email: "hr@company.com", label: "Sarah HR" },
  { email: "security@company.com", label: "Security Reviewer" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("admin@company.com");
  const [password] = useState("demo");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMicrosoftEntra =
    typeof window !== "undefined" &&
    !!process.env.NEXT_PUBLIC_AZURE_AD_ENABLED;

  async function handleCredentialsLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result && "error" in result && result.error) {
        setError("Invalid credentials. Please try again.");
        setIsLoading(false);
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("An unexpected error occurred.");
      setIsLoading(false);
    }
  }

  async function handleMicrosoftLogin() {
    setIsLoading(true);
    await signIn("microsoft-entra-id");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {branding.orgName} ITSM
          </h1>
          <p className="text-muted-foreground mt-1">{branding.portalSubtitle}</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>
              Select a demo user to explore the portal
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleCredentialsLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Demo User</Label>
                <Select value={email} onValueChange={setEmail}>
                  <SelectTrigger id="email">
                    <SelectValue placeholder="Select a demo user" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_USERS.map((user) => (
                      <SelectItem key={user.email} value={user.email}>
                        {user.label} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </span>
                )}
              </Button>
            </form>

            {hasMicrosoftEntra && (
              <>
                <div className="relative my-6">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    or
                  </span>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleMicrosoftLogin}
                  disabled={isLoading}
                >
                  <svg
                    className="mr-2 h-4 w-4"
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
                </Button>
              </>
            )}
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-xs text-muted-foreground">
              Demo environment &mdash; no real data is stored
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

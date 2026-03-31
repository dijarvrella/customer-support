"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { Building2, Plus, Loader2, Globe } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  supportEmail: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formSupportEmail, setFormSupportEmail] = useState("");

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tenants");
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleNameChange = (value: string) => {
    setFormName(value);
    // Auto-generate slug from name
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setFormSlug(slug);
  };

  const resetForm = () => {
    setFormName("");
    setFormSlug("");
    setFormDomain("");
    setFormSupportEmail("");
    setError("");
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formSlug.trim()) {
      setError("Name and slug are required");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          domain: formDomain.trim() || undefined,
          supportEmail: formSupportEmail.trim() || undefined,
        }),
      });

      if (res.ok) {
        setDialogOpen(false);
        resetForm();
        fetchTenants();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create tenant");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Tenant Management
            </h1>
            <p className="text-muted-foreground">
              Manage organizations and their configurations
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Tenant
        </Button>
      </div>

      {/* Tenant List */}
      <Card>
        <CardHeader className="pb-0" />
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Slug
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                      Domain
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-16 text-center text-muted-foreground"
                      >
                        <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p>No tenants found</p>
                        <p className="text-xs mt-1">
                          Create your first tenant to get started
                        </p>
                      </td>
                    </tr>
                  ) : (
                    tenants.map((tenant) => (
                      <tr
                        key={tenant.id}
                        className="border-b last:border-0 hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() =>
                          router.push(`/admin/tenants/${tenant.id}`)
                        }
                      >
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                              {tenant.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                            {tenant.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {tenant.slug}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {tenant.domain ? (
                            <div className="flex items-center gap-1.5">
                              <Globe className="h-3.5 w-3.5" />
                              {tenant.domain}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge
                            variant="outline"
                            className={
                              tenant.isActive
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-gray-100 text-gray-500 border-gray-200"
                            }
                          >
                            {tenant.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                          {formatDate(tenant.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Tenant Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Tenant</DialogTitle>
            <DialogDescription>
              Create a new organization in the system. You can configure SSO and
              other settings after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tenant-name">Name *</Label>
              <Input
                id="tenant-name"
                placeholder="Acme Corporation"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-slug">Slug *</Label>
              <Input
                id="tenant-slug"
                placeholder="acme-corp"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-domain">Domain</Label>
              <Input
                id="tenant-domain"
                placeholder="acme.com"
                value={formDomain}
                onChange={(e) => setFormDomain(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-email">Support Email</Label>
              <Input
                id="tenant-email"
                type="email"
                placeholder="support@acme.com"
                value={formSupportEmail}
                onChange={(e) => setFormSupportEmail(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

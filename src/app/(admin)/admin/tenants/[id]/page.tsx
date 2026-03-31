"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
  Key,
} from "lucide-react";

interface OAuthConfig {
  id: string;
  tenantId: string;
  provider: string;
  clientId: string;
  clientSecret: string;
  tenantIdValue: string | null;
  issuer: string | null;
  additionalConfig: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TenantDetail {
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
  oauthConfigs: OAuthConfig[];
}

const PROVIDER_LABELS: Record<string, string> = {
  "microsoft-entra-id": "Microsoft Entra ID",
};

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tenantId = params.id;

  // Tenant state
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Form fields
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDomain, setFormDomain] = useState("");
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [formPrimaryColor, setFormPrimaryColor] = useState("");
  const [formSupportEmail, setFormSupportEmail] = useState("");

  // OAuth dialog state
  const [oauthDialogOpen, setOauthDialogOpen] = useState(false);
  const [editingOauth, setEditingOauth] = useState<OAuthConfig | null>(null);
  const [oauthSaving, setOauthSaving] = useState(false);
  const [oauthError, setOauthError] = useState("");

  // OAuth form fields
  const [oauthProvider, setOauthProvider] = useState("microsoft-entra-id");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthTenantIdValue, setOauthTenantIdValue] = useState("");
  const [oauthIssuer, setOauthIssuer] = useState("");

  // Deactivate state
  const [deactivating, setDeactivating] = useState(false);

  const fetchTenant = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`);
      if (res.ok) {
        const data: TenantDetail = await res.json();
        setTenant(data);
        setFormName(data.name);
        setFormSlug(data.slug);
        setFormDomain(data.domain || "");
        setFormLogoUrl(data.logoUrl || "");
        setFormPrimaryColor(data.primaryColor || "");
        setFormSupportEmail(data.supportEmail || "");
      } else if (res.status === 404) {
        router.push("/admin/tenants");
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tenantId, router]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage("");

    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          domain: formDomain.trim() || null,
          logoUrl: formLogoUrl.trim() || null,
          primaryColor: formPrimaryColor.trim() || null,
          supportEmail: formSupportEmail.trim() || null,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTenant((prev) => (prev ? { ...prev, ...updated } : prev));
        setSaveMessage("Tenant updated successfully");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        const data = await res.json();
        setSaveMessage(data.error || "Failed to update tenant");
      }
    } catch {
      setSaveMessage("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const resetOauthForm = () => {
    setOauthProvider("microsoft-entra-id");
    setOauthClientId("");
    setOauthClientSecret("");
    setOauthTenantIdValue("");
    setOauthIssuer("");
    setOauthError("");
    setEditingOauth(null);
  };

  const openAddOauth = () => {
    resetOauthForm();
    setOauthDialogOpen(true);
  };

  const openEditOauth = (config: OAuthConfig) => {
    setEditingOauth(config);
    setOauthProvider(config.provider);
    setOauthClientId(config.clientId);
    setOauthClientSecret(config.clientSecret);
    setOauthTenantIdValue(config.tenantIdValue || "");
    setOauthIssuer(config.issuer || "");
    setOauthError("");
    setOauthDialogOpen(true);
  };

  const handleOauthSave = async () => {
    if (!oauthClientId.trim() || !oauthClientSecret.trim()) {
      setOauthError("Client ID and Client Secret are required");
      return;
    }

    setOauthSaving(true);
    setOauthError("");

    try {
      const payload = {
        provider: oauthProvider,
        clientId: oauthClientId.trim(),
        clientSecret: oauthClientSecret.trim(),
        tenantIdValue: oauthTenantIdValue.trim() || null,
        issuer: oauthIssuer.trim() || null,
      };

      let res: Response;
      if (editingOauth) {
        res = await fetch(
          `/api/tenants/${tenantId}/oauth/${editingOauth.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      } else {
        res = await fetch(`/api/tenants/${tenantId}/oauth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setOauthDialogOpen(false);
        resetOauthForm();
        fetchTenant();
      } else {
        const data = await res.json();
        setOauthError(data.error || "Failed to save OAuth config");
      }
    } catch {
      setOauthError("An unexpected error occurred");
    } finally {
      setOauthSaving(false);
    }
  };

  const handleDeleteOauth = async (configId: string) => {
    if (!confirm("Are you sure you want to delete this OAuth configuration?")) {
      return;
    }

    try {
      const res = await fetch(
        `/api/tenants/${tenantId}/oauth/${configId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        fetchTenant();
      }
    } catch {
      // silent
    }
  };

  const handleDeactivate = async () => {
    if (
      !confirm(
        "Are you sure you want to deactivate this tenant? Users will no longer be able to authenticate."
      )
    ) {
      return;
    }

    setDeactivating(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/admin/tenants");
      }
    } catch {
      // silent
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/tenants")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="text-muted-foreground text-sm">
            Manage tenant details and authentication settings
          </p>
        </div>
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
      </div>

      {/* Tenant Details Form */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Details</CardTitle>
          <CardDescription>
            Basic information about this organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="detail-name">Name</Label>
              <Input
                id="detail-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-slug">Slug</Label>
              <Input
                id="detail-slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-domain">Domain</Label>
              <Input
                id="detail-domain"
                placeholder="example.com"
                value={formDomain}
                onChange={(e) => setFormDomain(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-email">Support Email</Label>
              <Input
                id="detail-email"
                type="email"
                placeholder="support@example.com"
                value={formSupportEmail}
                onChange={(e) => setFormSupportEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-logo">Logo URL</Label>
              <Input
                id="detail-logo"
                placeholder="https://..."
                value={formLogoUrl}
                onChange={(e) => setFormLogoUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="detail-color"
                  placeholder="#3B82F6"
                  value={formPrimaryColor}
                  onChange={(e) => setFormPrimaryColor(e.target.value)}
                />
                {formPrimaryColor && (
                  <div
                    className="h-9 w-9 rounded-md border shrink-0"
                    style={{ backgroundColor: formPrimaryColor }}
                  />
                )}
              </div>
            </div>
          </div>

          {saveMessage && (
            <div
              className={`text-sm rounded-md px-3 py-2 ${
                saveMessage.includes("success")
                  ? "text-emerald-800 bg-emerald-100"
                  : "text-destructive bg-destructive/10"
              }`}
            >
              {saveMessage}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OAuth Configurations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                OAuth Configurations
              </CardTitle>
              <CardDescription>
                Configure single sign-on providers for this tenant
              </CardDescription>
            </div>
            <Button size="sm" onClick={openAddOauth}>
              <Plus className="h-4 w-4 mr-2" />
              Add OAuth Provider
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tenant.oauthConfigs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No OAuth providers configured</p>
              <p className="text-xs mt-1">
                Add a provider to enable SSO for this tenant
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tenant.oauthConfigs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">
                        {PROVIDER_LABELS[config.provider] || config.provider}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          config.isActive
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-gray-100 text-gray-500 border-gray-200"
                        }
                      >
                        {config.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Client ID: {config.clientId.slice(0, 8)}...
                      {config.tenantIdValue && (
                        <> | Tenant: {config.tenantIdValue.slice(0, 8)}...</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditOauth(config)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteOauth(config.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {tenant.isActive && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-4 w-4" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Deactivate Tenant</p>
                <p className="text-xs text-muted-foreground">
                  Users from this tenant will no longer be able to authenticate.
                  This can be reversed by reactivating the tenant.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Deactivate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OAuth Dialog */}
      <Dialog open={oauthDialogOpen} onOpenChange={setOauthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOauth ? "Edit OAuth Provider" : "Add OAuth Provider"}
            </DialogTitle>
            <DialogDescription>
              Configure a single sign-on provider for this tenant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {oauthError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {oauthError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="oauth-provider">Provider</Label>
              <Select value={oauthProvider} onValueChange={setOauthProvider}>
                <SelectTrigger id="oauth-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="microsoft-entra-id">
                    Microsoft Entra ID
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="oauth-client-id">Client ID *</Label>
              <Input
                id="oauth-client-id"
                placeholder="Application (client) ID"
                value={oauthClientId}
                onChange={(e) => setOauthClientId(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="oauth-client-secret">Client Secret *</Label>
              <Input
                id="oauth-client-secret"
                type="password"
                placeholder="Client secret value"
                value={oauthClientSecret}
                onChange={(e) => setOauthClientSecret(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="oauth-tenant-id">Tenant ID (Azure)</Label>
              <Input
                id="oauth-tenant-id"
                placeholder="Directory (tenant) ID"
                value={oauthTenantIdValue}
                onChange={(e) => setOauthTenantIdValue(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="oauth-issuer">Issuer</Label>
              <Input
                id="oauth-issuer"
                placeholder="https://login.microsoftonline.com/{tenant}/v2.0"
                value={oauthIssuer}
                onChange={(e) => setOauthIssuer(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOauthDialogOpen(false)}
              disabled={oauthSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleOauthSave} disabled={oauthSaving}>
              {oauthSaving && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingOauth ? "Update" : "Add"} Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

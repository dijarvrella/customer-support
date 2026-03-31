"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  SERVICE_CATALOG,
  TICKET_PRIORITIES,
  PRIORITY_LABELS,
} from "@/lib/constants";
import { PlusCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Build a flat list of all catalog items for the category dropdown
const allCatalogItems = SERVICE_CATALOG.flatMap((category) =>
  category.items.map((item) => ({
    slug: item.slug,
    name: item.name,
    category: category.name,
  }))
);

// Category groupings for conditional form fields
const ACCESS_CATEGORIES = ["grant-access", "revoke-access", "app-access"];
const FIREWALL_CATEGORIES = ["firewall-change"];
const NETWORK_CATEGORIES = ["network-change", "dns-change"];
const HARDWARE_CATEGORIES = [
  "hardware-purchase",
  "device-replacement",
  "peripheral-request",
];
const VPN_CATEGORIES = ["vpn-request", "aws-vpn"];
const SOFTWARE_CATEGORIES = ["software-install", "license-request"];
const PASSWORD_CATEGORIES = ["password-reset", "mfa-reset"];

function getCategoryGroup(
  slug: string
):
  | "access"
  | "firewall"
  | "network"
  | "hardware"
  | "vpn"
  | "software"
  | "password"
  | "generic" {
  if (ACCESS_CATEGORIES.includes(slug)) return "access";
  if (FIREWALL_CATEGORIES.includes(slug)) return "firewall";
  if (NETWORK_CATEGORIES.includes(slug)) return "network";
  if (HARDWARE_CATEGORIES.includes(slug)) return "hardware";
  if (VPN_CATEGORIES.includes(slug)) return "vpn";
  if (SOFTWARE_CATEGORIES.includes(slug)) return "software";
  if (PASSWORD_CATEGORIES.includes(slug)) return "password";
  return "generic";
}

export default function CreateTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedType = searchParams.get("type") || "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [categorySlug, setCategorySlug] = useState(preselectedType);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom fields state (keyed by field name)
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [shipToMe, setShipToMe] = useState(false);

  // If the preselected type is a form-based item, show a hint
  const preselectedItem = allCatalogItems.find(
    (item) => item.slug === preselectedType
  );

  const categoryGroup = getCategoryGroup(categorySlug);

  function updateCustomField(key: string, value: string) {
    setCustomFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleCategoryChange(slug: string) {
    setCategorySlug(slug);
    // Reset custom fields when category changes
    setCustomFields({});
    setShipToMe(false);
  }

  function validateCustomFields(): string | null {
    switch (categoryGroup) {
      case "access":
        if (!customFields.systemApplication?.trim())
          return "System/Application is required.";
        if (!customFields.businessJustification?.trim())
          return "Business Justification is required.";
        break;
      case "firewall":
        if (!customFields.sourceIp?.trim())
          return "Source IP/Network is required.";
        if (!customFields.destinationIp?.trim())
          return "Destination IP/Network is required.";
        if (!customFields.portProtocol?.trim())
          return "Port / Protocol is required.";
        if (!customFields.businessJustification?.trim())
          return "Business Justification is required.";
        break;
      case "network":
        if (!customFields.businessJustification?.trim())
          return "Business Justification is required.";
        break;
      case "vpn":
        if (!customFields.businessJustification?.trim())
          return "Business Justification is required.";
        break;
      case "software":
        if (!customFields.softwareName?.trim())
          return "Software Name is required.";
        break;
      case "password":
        if (!customFields.affectedAccount?.trim())
          return "Affected Account is required.";
        break;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    // Validate category-specific required fields
    if (categorySlug) {
      const validationError = validateCustomFields();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSubmitting(true);

    // Build the customFields payload, including shipToMe for hardware
    const customFieldsPayload: Record<string, string | boolean> = {
      ...customFields,
    };
    if (categoryGroup === "hardware") {
      customFieldsPayload.shipToMe = shipToMe;
    }

    // Only include customFields if there are any non-empty values
    const hasCustomFields = Object.values(customFieldsPayload).some(
      (v) => v !== "" && v !== false
    );

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          categorySlug: categorySlug || null,
          formData: hasCustomFields ? customFieldsPayload : null,
          formType: categorySlug ? categoryGroup : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create ticket");
      }

      const created = await res.json();
      router.push(`/tickets/${created.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tickets
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Create Ticket</h1>
        <p className="text-muted-foreground mt-1">
          Submit a new IT support request
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PlusCircle className="h-5 w-5" />
              New Request
            </CardTitle>
            {preselectedItem && (
              <CardDescription>
                Category pre-selected: {preselectedItem.name}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Brief summary of your request"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Provide additional details about your request..."
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categorySlug} onValueChange={handleCategoryChange}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATALOG.map((category) => (
                    <div key={category.id}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {category.name}
                      </div>
                      {category.items.map((item) => (
                        <SelectItem key={item.slug} value={item.slug}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ─── Category-specific fields ─────────────────────────── */}

            {categoryGroup === "access" && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Access Request Details
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cf-systemApplication">
                    System / Application{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cf-systemApplication"
                    placeholder="Which system or application?"
                    value={customFields.systemApplication || ""}
                    onChange={(e) =>
                      updateCustomField("systemApplication", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-accessLevel">Access Level</Label>
                  <Select
                    value={customFields.accessLevel || ""}
                    onValueChange={(v) => updateCustomField("accessLevel", v)}
                  >
                    <SelectTrigger id="cf-accessLevel">
                      <SelectValue placeholder="Select access level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read-only">Read Only</SelectItem>
                      <SelectItem value="read-write">Read-Write</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-businessJustification">
                    Business Justification{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="cf-businessJustification"
                    placeholder="Why is this access needed?"
                    rows={3}
                    value={customFields.businessJustification || ""}
                    onChange={(e) =>
                      updateCustomField(
                        "businessJustification",
                        e.target.value
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-duration">Duration</Label>
                  <Select
                    value={customFields.duration || ""}
                    onValueChange={(v) => updateCustomField("duration", v)}
                  >
                    <SelectTrigger id="cf-duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="30-days">30 days</SelectItem>
                      <SelectItem value="90-days">90 days</SelectItem>
                      <SelectItem value="until-date">Until date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {categoryGroup === "firewall" && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Firewall Change Details
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cf-sourceIp">
                    Source IP / Network{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cf-sourceIp"
                    placeholder="e.g. 10.0.1.0/24"
                    value={customFields.sourceIp || ""}
                    onChange={(e) =>
                      updateCustomField("sourceIp", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-destinationIp">
                    Destination IP / Network{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cf-destinationIp"
                    placeholder="e.g. 10.0.2.0/24"
                    value={customFields.destinationIp || ""}
                    onChange={(e) =>
                      updateCustomField("destinationIp", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-portProtocol">
                    Port / Protocol{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cf-portProtocol"
                    placeholder="e.g. 443/TCP"
                    value={customFields.portProtocol || ""}
                    onChange={(e) =>
                      updateCustomField("portProtocol", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-direction">Direction</Label>
                  <Select
                    value={customFields.direction || ""}
                    onValueChange={(v) => updateCustomField("direction", v)}
                  >
                    <SelectTrigger id="cf-direction">
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-duration">Duration</Label>
                  <Select
                    value={customFields.duration || ""}
                    onValueChange={(v) => updateCustomField("duration", v)}
                  >
                    <SelectTrigger id="cf-duration">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-businessJustification">
                    Business Justification{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="cf-businessJustification"
                    placeholder="Why is this firewall change needed?"
                    rows={3}
                    value={customFields.businessJustification || ""}
                    onChange={(e) =>
                      updateCustomField(
                        "businessJustification",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            )}

            {categoryGroup === "network" && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Network / DNS Change Details
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cf-changeType">Change Type</Label>
                  <Select
                    value={customFields.changeType || ""}
                    onValueChange={(v) => updateCustomField("changeType", v)}
                  >
                    <SelectTrigger id="cf-changeType">
                      <SelectValue placeholder="Select change type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vlan">VLAN</SelectItem>
                      <SelectItem value="routing">Routing</SelectItem>
                      <SelectItem value="dns">DNS</SelectItem>
                      <SelectItem value="dhcp">DHCP</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-affectedSystems">Affected Systems</Label>
                  <Textarea
                    id="cf-affectedSystems"
                    placeholder="List affected systems or services"
                    rows={3}
                    value={customFields.affectedSystems || ""}
                    onChange={(e) =>
                      updateCustomField("affectedSystems", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-businessJustification">
                    Business Justification{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="cf-businessJustification"
                    placeholder="Why is this change needed?"
                    rows={3}
                    value={customFields.businessJustification || ""}
                    onChange={(e) =>
                      updateCustomField(
                        "businessJustification",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            )}

            {categoryGroup === "hardware" && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Hardware Request Details
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cf-itemType">Item Type</Label>
                  <Select
                    value={customFields.itemType || ""}
                    onValueChange={(v) => updateCustomField("itemType", v)}
                  >
                    <SelectTrigger id="cf-itemType">
                      <SelectValue placeholder="Select item type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="monitor">Monitor</SelectItem>
                      <SelectItem value="keyboard">Keyboard</SelectItem>
                      <SelectItem value="mouse">Mouse</SelectItem>
                      <SelectItem value="headset">Headset</SelectItem>
                      <SelectItem value="docking-station">
                        Docking Station
                      </SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-justification">Justification</Label>
                  <Textarea
                    id="cf-justification"
                    placeholder="Why do you need this hardware?"
                    rows={3}
                    value={customFields.justification || ""}
                    onChange={(e) =>
                      updateCustomField("justification", e.target.value)
                    }
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cf-shipToMe"
                    checked={shipToMe}
                    onCheckedChange={(checked) =>
                      setShipToMe(checked === true)
                    }
                  />
                  <Label htmlFor="cf-shipToMe" className="cursor-pointer">
                    Ship to me
                  </Label>
                </div>
                {shipToMe && (
                  <div className="space-y-2">
                    <Label htmlFor="cf-shippingAddress">
                      Shipping Address
                    </Label>
                    <Textarea
                      id="cf-shippingAddress"
                      placeholder="Full shipping address"
                      rows={3}
                      value={customFields.shippingAddress || ""}
                      onChange={(e) =>
                        updateCustomField("shippingAddress", e.target.value)
                      }
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="cf-urgencyNote">Urgency Note</Label>
                  <Input
                    id="cf-urgencyNote"
                    placeholder="Any urgency details"
                    value={customFields.urgencyNote || ""}
                    onChange={(e) =>
                      updateCustomField("urgencyNote", e.target.value)
                    }
                  />
                </div>
              </div>
            )}

            {categoryGroup === "vpn" && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  VPN Request Details
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cf-vpnType">VPN Type</Label>
                  <Select
                    value={customFields.vpnType || ""}
                    onValueChange={(v) => updateCustomField("vpnType", v)}
                  >
                    <SelectTrigger id="cf-vpnType">
                      <SelectValue placeholder="Select VPN type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws-vpn">AWS VPN</SelectItem>
                      <SelectItem value="corporate-vpn">
                        Corporate VPN
                      </SelectItem>
                      <SelectItem value="site-to-site">
                        Site-to-Site
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-businessJustification">
                    Business Justification{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="cf-businessJustification"
                    placeholder="Why do you need VPN access?"
                    rows={3}
                    value={customFields.businessJustification || ""}
                    onChange={(e) =>
                      updateCustomField(
                        "businessJustification",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            )}

            {categoryGroup === "software" && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Software Request Details
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cf-softwareName">
                    Software Name{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cf-softwareName"
                    placeholder="Name of the software"
                    value={customFields.softwareName || ""}
                    onChange={(e) =>
                      updateCustomField("softwareName", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-version">Version</Label>
                  <Input
                    id="cf-version"
                    placeholder="Specific version (optional)"
                    value={customFields.version || ""}
                    onChange={(e) =>
                      updateCustomField("version", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-businessJustification">
                    Business Justification
                  </Label>
                  <Textarea
                    id="cf-businessJustification"
                    placeholder="Why do you need this software?"
                    rows={3}
                    value={customFields.businessJustification || ""}
                    onChange={(e) =>
                      updateCustomField(
                        "businessJustification",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            )}

            {categoryGroup === "password" && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Account Reset Details
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cf-affectedAccount">
                    Affected Account{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cf-affectedAccount"
                    placeholder="Email or username"
                    value={customFields.affectedAccount || ""}
                    onChange={(e) =>
                      updateCustomField("affectedAccount", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cf-urgency">Urgency</Label>
                  <Select
                    value={customFields.urgency || ""}
                    onValueChange={(v) => updateCustomField("urgency", v)}
                  >
                    <SelectTrigger id="cf-urgency">
                      <SelectValue placeholder="How urgent is this?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="can-wait">Can wait</SelectItem>
                      <SelectItem value="need-today">Need it today</SelectItem>
                      <SelectItem value="locked-out">
                        Locked out now
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-3 border-t pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </span>
              ) : (
                "Submit Ticket"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

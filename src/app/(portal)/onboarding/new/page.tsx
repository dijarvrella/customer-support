"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { onboardingFormSchema } from "@/lib/forms/onboarding";
import { ArrowLeft, Send, UserPlus, Loader2, Search, X } from "lucide-react";
import Link from "next/link";

// ── User picker component ────────────────────────────────────────────────────

interface UserOption {
  id: string;
  name: string;
  email: string;
  department?: string;
}

function UserPickerField({
  label,
  required,
  selectedName,
  selectedEmail,
  onSelect,
  onClear,
}: {
  label: string;
  required?: boolean;
  selectedName: string;
  selectedEmail: string;
  onSelect: (user: UserOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setFetching(true);
    const timer = setTimeout(() => {
      fetch(`/api/users?search=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data: UserOption[]) => {
          setResults(data.slice(0, 8));
          setOpen(true);
        })
        .catch(() => {})
        .finally(() => setFetching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const isSelected = !!selectedName || !!selectedEmail;

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {isSelected ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedName || selectedEmail}</p>
            {selectedEmail && selectedName && (
              <p className="text-xs text-muted-foreground truncate">{selectedEmail}</p>
            )}
          </div>
          <button
            type="button"
            title="Clear selection"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
          />
          {fetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {open && results.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-accent text-sm"
                  onClick={() => {
                    onSelect(u);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type FormValues = Record<string, string | string[] | boolean | number>;

export default function OnboardingFormPage() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => {
    // Initialize with default values from schema
    const defaults: FormValues = {};
    for (const section of onboardingFormSchema.sections) {
      for (const field of section.fields) {
        if ("defaultValue" in field && field.defaultValue !== undefined) {
          defaults[field.id] = field.defaultValue as string;
        }
      }
    }
    return defaults;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function setValue(id: string, value: string | string[] | boolean | number) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function toggleMultiSelect(id: string, optionValue: string) {
    setValues((prev) => {
      const current = (prev[id] as string[]) || [];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [id]: next };
    });
  }

  function isConditionMet(field: { condition?: { field: string; value: unknown } } | any): boolean {
    if (!field.condition) return true;
    const { field: condField, value: condValue } = field.condition;
    return values[condField] === condValue;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    // Basic required field validation
    for (const section of onboardingFormSchema.sections) {
      for (const field of section.fields) {
        if (field.required && isConditionMet(field)) {
          const val = values[field.id];
          if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
            setError(`"${field.label}" is required`);
            setSubmitting(false);
            return;
          }
        }
      }
    }

    try {
      const res = await fetch("/api/forms/employee-onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: values }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      const data = await res.json();
      router.push(`/tickets/${data.ticketId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSubmitting(false);
    }
  }

  // Fields rendered via UserPickerField — supervisor_email is auto-filled from supervisor_name picker
  const USER_PICKER_FIELDS = ["supervisor_name"];
  const USER_PICKER_EMAIL_SHADOW = new Set(["supervisor_email"]);

  function renderField(field: any) {
    if (!isConditionMet(field)) return null;

    const fieldId = field.id;

    // supervisor_name → user picker that also fills supervisor_email
    if (USER_PICKER_FIELDS.includes(fieldId)) {
      return (
        <UserPickerField
          key={fieldId}
          label={field.label}
          required={field.required}
          selectedName={(values["supervisor_name"] as string) || ""}
          selectedEmail={(values["supervisor_email"] as string) || ""}
          onSelect={(u) => {
            setValue("supervisor_name", u.name);
            setValue("supervisor_email", u.email);
          }}
          onClear={() => {
            setValue("supervisor_name", "");
            setValue("supervisor_email", "");
          }}
        />
      );
    }

    // supervisor_email is auto-filled from the picker above — show read-only hint
    if (USER_PICKER_EMAIL_SHADOW.has(fieldId)) {
      const email = (values[fieldId] as string) || "";
      return (
        <div key={fieldId} className="space-y-2">
          <Label htmlFor={fieldId}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={fieldId}
            type="email"
            value={email}
            onChange={(e) => setValue(fieldId, e.target.value)}
            placeholder="Auto-filled from manager selection above"
          />
          {field.helperText && (
            <p className="text-xs text-muted-foreground">{field.helperText}</p>
          )}
        </div>
      );
    }

    switch (field.type) {
      case "text":
      case "email":
      case "tel":
      case "number":
        return (
          <div key={fieldId} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Input
              id={fieldId}
              type={
                field.type === "tel"
                  ? "tel"
                  : field.type === "email"
                    ? "email"
                    : field.type === "number"
                      ? "number"
                      : "text"
              }
              value={(values[fieldId] as string) || ""}
              onChange={(e) => setValue(fieldId, e.target.value)}
              placeholder={field.helperText || ""}
            />
            {field.helperText && (
              <p className="text-xs text-muted-foreground">
                {field.helperText}
              </p>
            )}
          </div>
        );

      case "date":
        return (
          <div key={fieldId} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Input
              id={fieldId}
              type="date"
              value={(values[fieldId] as string) || ""}
              onChange={(e) => setValue(fieldId, e.target.value)}
            />
          </div>
        );

      case "textarea":
        return (
          <div key={fieldId} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Textarea
              id={fieldId}
              value={(values[fieldId] as string) || ""}
              onChange={(e) => setValue(fieldId, e.target.value)}
              placeholder={field.helperText || ""}
              rows={3}
            />
            {field.helperText && (
              <p className="text-xs text-muted-foreground">
                {field.helperText}
              </p>
            )}
          </div>
        );

      case "select":
        return (
          <div key={fieldId} className="space-y-2">
            <Label>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Select
              value={(values[fieldId] as string) || ""}
              onValueChange={(v) => setValue(fieldId, v)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={`Select ${field.label}`}
                />
              </SelectTrigger>
              <SelectContent>
                {field.options.map(
                  (opt: { value: string; label: string }) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        );

      case "multiselect":
        return (
          <div key={fieldId} className="space-y-2">
            <Label>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {field.options.map(
                (opt: { value: string; label: string }) => (
                  <div
                    key={opt.value}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`${fieldId}-${opt.value}`}
                      checked={(
                        (values[fieldId] as string[]) || []
                      ).includes(opt.value)}
                      onCheckedChange={() =>
                        toggleMultiSelect(fieldId, opt.value)
                      }
                    />
                    <Label
                      htmlFor={`${fieldId}-${opt.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {opt.label}
                    </Label>
                  </div>
                )
              )}
            </div>
          </div>
        );

      case "checkbox":
        return (
          <div key={fieldId} className="flex items-start space-x-2 pt-1">
            <Checkbox
              id={fieldId}
              checked={(values[fieldId] as boolean) || false}
              onCheckedChange={(checked) => setValue(fieldId, checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor={fieldId} className="font-normal cursor-pointer">
                {field.label}
              </Label>
              {field.helperText && (
                <p className="text-xs text-muted-foreground">
                  {field.helperText}
                </p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/catalog"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Service Catalog
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {onboardingFormSchema.title}
            </h1>
            <p className="text-muted-foreground">
              {onboardingFormSchema.description}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        {onboardingFormSchema.sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.fields.map((field) => renderField(field))}
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end gap-3 pb-8">
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
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Submit Onboarding Request
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

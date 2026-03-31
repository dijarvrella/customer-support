"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { SERVICE_CATALOG } from "@/lib/constants";
import {
  Shield,
  Cloud,
  Server,
  Lock,
  Monitor,
  Package,
  Wrench,
  Users,
  Search,
  ArrowRight,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Cloud,
  Server,
  Lock,
  Monitor,
  Package,
  Wrench,
  Users,
};

function getItemHref(item: { slug: string; form?: boolean }): string {
  if (item.slug === "employee-onboarding") return "/onboarding/new";
  if (item.slug === "employee-offboarding") return "/offboarding/new";
  return `/tickets/new?type=${item.slug}`;
}

export default function CatalogPage() {
  const [search, setSearch] = useState("");

  const filteredCategories = SERVICE_CATALOG.map((category) => {
    const filteredItems = category.items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    );
    return { ...category, items: filteredItems };
  }).filter(
    (category) =>
      category.items.length > 0 ||
      category.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Service Catalog</h1>
        <p className="text-muted-foreground mt-1">
          Browse available IT services and submit a request
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories grid */}
      {filteredCategories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No services match your search</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredCategories.map((category) => {
            const Icon = ICON_MAP[category.icon] || Wrench;
            return (
              <Card
                key={category.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{category.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {category.items.map((item) => (
                      <li key={item.slug}>
                        <Link
                          href={getItemHref(item)}
                          className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors group"
                        >
                          <span>{item.name}</span>
                          <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

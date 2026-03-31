"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  BookOpen,
  Ticket,
  PlusCircle,
  CheckSquare,
  List,
  Inbox,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: string;
    image?: string | null;
  };
  pendingApprovalCount?: number;
}

interface NavItemDef {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const agentRoles = ["it_agent", "it_lead", "it_admin"];
const adminRoles = ["it_admin"];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge
          variant="secondary"
          className={cn(
            "ml-auto h-5 min-w-[20px] flex items-center justify-center text-xs",
            active && "bg-primary-foreground/20 text-primary-foreground"
          )}
        >
          {badge}
        </Badge>
      )}
    </Link>
  );
}

function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground",
        className
      )}
    >
      {initials}
    </div>
  );
}

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  const hrefPath = href.split("?")[0];
  const hrefQuery = href.includes("?") ? href.split("?")[1] : null;
  if (hrefQuery) {
    return pathname === hrefPath;
  }
  if (href === "/tickets/new") {
    return pathname === "/tickets/new";
  }
  if (href === "/tickets") {
    return pathname === "/tickets";
  }
  return pathname.startsWith(hrefPath);
}

export function Sidebar({ user, pendingApprovalCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showAgentSection = agentRoles.includes(user.role);
  const showAdminSection = adminRoles.includes(user.role);

  const closeMobile = () => setMobileOpen(false);

  const mainNav: NavItemDef[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/catalog", label: "Service Catalog", icon: BookOpen },
    { href: "/tickets", label: "My Tickets", icon: Ticket },
    { href: "/tickets/new", label: "Create Ticket", icon: PlusCircle },
    {
      href: "/approvals",
      label: "Approvals",
      icon: CheckSquare,
      badge: pendingApprovalCount,
    },
  ];

  const agentNav: NavItemDef[] = [
    { href: "/tickets?view=all", label: "All Tickets", icon: List },
    { href: "/queues", label: "Queues", icon: Inbox },
  ];

  const adminNav: NavItemDef[] = [
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/tenants", label: "Tenants", icon: Shield },
    { href: "/admin", label: "Settings", icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <img src="/logo-icon.svg" alt="Zimark" className="h-8 w-8" />
        <span className="text-lg font-bold tracking-tight">Zimark ITSM</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {mainNav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isLinkActive(pathname, item.href)}
              badge={item.badge}
              onClick={closeMobile}
            />
          ))}
        </div>

        {showAgentSection && (
          <>
            <Separator className="my-4" />
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Agent
            </p>
            <div className="space-y-1">
              {agentNav.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isLinkActive(pathname, item.href)}
                  onClick={closeMobile}
                />
              ))}
            </div>
          </>
        )}

        {showAdminSection && (
          <>
            <Separator className="my-4" />
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            <div className="space-y-1">
              {adminNav.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isLinkActive(pathname, item.href)}
                  onClick={closeMobile}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* User profile */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={user.name} image={user.image} className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b bg-background px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 ml-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-bold">Zimark ITSM</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r shadow-lg transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={closeMobile}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-background lg:block">
        {sidebarContent}
      </aside>
    </>
  );
}

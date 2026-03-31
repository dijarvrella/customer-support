"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/card";
import { USER_ROLES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Search, Users, Loader2, Check } from "lucide-react";

interface UserQueue {
  queueId: string;
  queueName: string;
  teamId: string;
  teamName: string;
  membershipRole: string;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  end_user: "End User",
  it_agent: "IT Agent",
  it_lead: "IT Lead",
  it_admin: "IT Admin",
  approver: "Approver",
  hr: "HR / People Ops",
  security: "Security",
  auditor: "Auditor",
};

const ROLE_COLORS: Record<string, string> = {
  it_admin: "bg-purple-100 text-purple-800 border-purple-200",
  it_lead: "bg-indigo-100 text-indigo-800 border-indigo-200",
  it_agent: "bg-blue-100 text-blue-800 border-blue-200",
  hr: "bg-pink-100 text-pink-800 border-pink-200",
  security: "bg-red-100 text-red-800 border-red-200",
  auditor: "bg-amber-100 text-amber-800 border-amber-200",
  approver: "bg-emerald-100 text-emerald-800 border-emerald-200",
  end_user: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userQueues, setUserQueues] = useState<Record<string, UserQueue[]>>({});
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [roleUpdateSuccess, setRoleUpdateSuccess] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter !== "all") params.set("role", roleFilter);

    try {
      const res = await fetch(`/api/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  const fetchUserQueues = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/queues`);
      if (res.ok) {
        const data = await res.json();
        setUserQueues((prev) => ({ ...prev, [userId]: data }));
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch queues for all users once they are loaded
  useEffect(() => {
    for (const user of users) {
      if (!userQueues[user.id]) {
        fetchUserQueues(user.id);
      }
    }
  }, [users, userQueues, fetchUserQueues]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingRole(userId);
    setRoleUpdateSuccess(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u))
        );
        setRoleUpdateSuccess(userId);
        setTimeout(() => setRoleUpdateSuccess(null), 2000);
      }
    } catch {
      // silent
    } finally {
      setUpdatingRole(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              User Management
            </h1>
            <p className="text-muted-foreground">
              Manage user accounts and roles
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {USER_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role] || role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
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
                      Email
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                      Queue(s)
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">
                      Last Login
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-16 text-center text-muted-foreground"
                      >
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p>No users found</p>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const queues = userQueues[user.id] || [];
                      return (
                        <tr
                          key={user.id}
                          className="border-b last:border-0 hover:bg-accent/50 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                {user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                              {user.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {user.email}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <Select
                                value={user.role}
                                onValueChange={(value) =>
                                  handleRoleChange(user.id, value)
                                }
                                disabled={updatingRole === user.id}
                              >
                                <SelectTrigger
                                  className={`w-[160px] h-8 text-xs ${
                                    ROLE_COLORS[user.role] || ""
                                  }`}
                                >
                                  {updatingRole === user.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <SelectValue />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  {USER_ROLES.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {ROLE_LABELS[role] || role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {roleUpdateSuccess === user.id && (
                                <Check className="h-4 w-4 text-emerald-600" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {queues.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {queues.map((q) => (
                                  <Badge
                                    key={q.queueId}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {q.queueName}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                None
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                            {user.department || "-"}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <Badge
                              variant="outline"
                              className={
                                user.isActive
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : "bg-gray-100 text-gray-500 border-gray-200"
                              }
                            >
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground text-xs">
                            {user.lastLoginAt
                              ? formatDate(user.lastLoginAt)
                              : "Never"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

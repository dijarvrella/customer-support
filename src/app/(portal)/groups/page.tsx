"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users2,
  Loader2,
  UserPlus,
  Trash2,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Shield,
  Info,
} from "lucide-react";

interface EntraGroup {
  id: string;
  displayName: string;
  groupTypes: string[];
  membershipRule: string | null;
  type: "assigned" | "dynamic";
}

interface GroupMember {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  department: string | null;
}

interface SearchUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  department: string | null;
}

const FEATURED_GROUPS = [
  { id: "0da04108-0302-4e95-93d3-b92b59be00a3", name: "zimark.il" },
  { id: "c155f02e-770f-4c5a-8347-158c315b0cda", name: "Zimark General" },
];

export default function GroupsPage() {
  const [allGroups, setAllGroups] = useState<EntraGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("end_user");

  // Expanded group with members loaded
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Add member dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  // Remove member
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [removing, setRemoving] = useState(false);

  // Get current user role
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (s?.user?.role) setCurrentRole(s.user.role);
      })
      .catch(() => {});
  }, []);

  const isAdmin = ["it_admin", "it_lead"].includes(currentRole);

  // Fetch groups
  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch("/api/groups");
        if (!res.ok) {
          if (res.status === 403) {
            setError("You do not have permission to view groups.");
            return;
          }
          throw new Error("Failed to fetch groups");
        }
        setAllGroups(await res.json());
      } catch {
        setError("Failed to load groups.");
      } finally {
        setLoading(false);
      }
    }
    fetchGroups();
  }, []);

  // HR sees only featured groups, admins see all
  const visibleGroups = isAdmin
    ? allGroups
    : allGroups.filter((g) => FEATURED_GROUPS.some((fg) => fg.id === g.id));

  // Fetch members when expanding a group
  const fetchMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      if (res.ok) setMembers(await res.json());
    } catch {
      // silent
    } finally {
      setMembersLoading(false);
    }
  }, []);

  function toggleGroup(groupId: string) {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
      setMembers([]);
    } else {
      setExpandedGroupId(groupId);
      fetchMembers(groupId);
    }
  }

  // Search users
  useEffect(() => {
    if (!addDialogOpen || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/groups/${expandedGroupId}/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
        if (res.ok) setSearchResults(await res.json());
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, addDialogOpen, expandedGroupId]);

  async function handleAddMember(userId: string) {
    if (!expandedGroupId) return;
    setAddingUserId(userId);
    try {
      await fetch(`/api/groups/${expandedGroupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      fetchMembers(expandedGroupId);
      setAddDialogOpen(false);
      setSearchQuery("");
    } catch {
      // silent
    } finally {
      setAddingUserId(null);
    }
  }

  async function handleRemoveMember() {
    if (!expandedGroupId || !memberToRemove) return;
    setRemoving(true);
    try {
      await fetch(`/api/groups/${expandedGroupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberToRemove.id }),
      });
      fetchMembers(expandedGroupId);
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
    } catch {
      // silent
    } finally {
      setRemoving(false);
    }
  }

  const expandedGroup = allGroups.find((g) => g.id === expandedGroupId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users2 className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Group Management</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Manage Entra ID group memberships" : "Manage Zimark group memberships"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Link href="/admin/audit?entityType=group">
            <Button variant="outline" size="sm" className="gap-1">
              <ExternalLink className="h-3 w-3" />
              View Audit Log
            </Button>
          </Link>
        )}
      </div>

      {/* Group List */}
      <div className="space-y-2">
        {visibleGroups.map((group) => {
          const isExpanded = expandedGroupId === group.id;
          const isFeatured = FEATURED_GROUPS.some((fg) => fg.id === group.id);

          return (
            <Card key={group.id} className={isFeatured ? "border-primary/30" : ""}>
              {/* Group header row */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full text-left"
              >
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {group.displayName}
                          {isFeatured && (
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
                              Featured
                            </Badge>
                          )}
                        </CardTitle>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={group.type === "dynamic" ? "secondary" : "outline"}>
                        {group.type === "dynamic" ? "Dynamic" : "Assigned"}
                      </Badge>
                      {isExpanded && !membersLoading && (
                        <span className="text-sm text-muted-foreground">{members.length} members</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {/* Expanded: Members list (INLINE, right below the header) */}
              {isExpanded && (
                <CardContent className="pt-0 pb-4">
                  {/* Dynamic group info */}
                  {group.type === "dynamic" && group.membershipRule && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md mb-4 text-sm">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-blue-900">Dynamic Group</p>
                        <p className="text-blue-700 text-xs mt-1 font-mono break-all">
                          Rule: {group.membershipRule}
                        </p>
                        <p className="text-blue-600 text-xs mt-1">
                          Members are auto-managed by this rule. Manual changes may be overridden.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions bar */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">
                      {membersLoading ? "Loading members..." : `${members.length} members`}
                    </span>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddDialogOpen(true);
                      }}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Add Member
                    </Button>
                  </div>

                  {membersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Department</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden lg:table-cell">Job Title</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground w-20"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                No members
                              </td>
                            </tr>
                          ) : (
                            members
                              .sort((a, b) => a.displayName.localeCompare(b.displayName))
                              .map((member) => (
                                <tr key={member.id} className="border-b last:border-0 hover:bg-accent/30">
                                  <td className="px-4 py-2 font-medium">{member.displayName}</td>
                                  <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">
                                    {member.mail || member.userPrincipalName}
                                  </td>
                                  <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
                                    {member.department || "-"}
                                  </td>
                                  <td className="px-4 py-2 text-muted-foreground hidden lg:table-cell">
                                    {member.jobTitle || "-"}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMemberToRemove(member);
                                        setRemoveDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add Member Dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
            setSearchQuery("");
            setSearchResults([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Member to {expandedGroup?.displayName || "Group"}
            </DialogTitle>
            <DialogDescription>
              Search for a user to add to this group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {searching && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching...
              </p>
            )}
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchResults.map((user) => {
                const alreadyMember = members.some((m) => m.id === user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    disabled={alreadyMember || addingUserId === user.id}
                    onClick={() => handleAddMember(user.id)}
                    className="w-full text-left p-3 rounded-md hover:bg-accent flex items-center justify-between text-sm disabled:opacity-50"
                  >
                    <div>
                      <p className="font-medium">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.mail || user.userPrincipalName}
                        {user.department ? ` - ${user.department}` : ""}
                      </p>
                    </div>
                    {alreadyMember ? (
                      <Badge variant="outline" className="text-xs">Already member</Badge>
                    ) : addingUserId === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Remove <strong>{memberToRemove?.displayName}</strong> from{" "}
              <strong>{expandedGroup?.displayName}</strong>?
              {expandedGroup?.type === "dynamic" && (
                <span className="block mt-2 text-amber-600">
                  Note: This is a dynamic group. The user may be re-added automatically by the membership rule.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

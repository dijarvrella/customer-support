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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

// ─── Types ──────────────────────────────────────────────────────────────────

interface EntraGroup {
  id: string;
  displayName: string;
  groupTypes: string[];
  membershipRule: string | null;
  membershipRuleProcessingState: string | null;
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

// ─── Featured Groups ────────────────────────────────────────────────────────

const FEATURED_GROUPS = [
  { id: "0da04108-0302-4e95-93d3-b92b59be00a3", name: "zimark.il" },
  { id: "c155f02e-770f-4c5a-8347-158c315b0cda", name: "Zimark General" },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  const [groups, setGroups] = useState<EntraGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected group
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Featured group member counts
  const [featuredCounts, setFeaturedCounts] = useState<Record<string, number>>(
    {}
  );

  // Add member dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  // Remove member confirmation
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(
    null
  );
  const [removing, setRemoving] = useState(false);

  // ─── Fetch Groups ───────────────────────────────────────────────────────

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
        const data: EntraGroup[] = await res.json();
        setGroups(data);
      } catch {
        setError("Failed to load groups. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchGroups();
  }, []);

  // ─── Fetch Featured Group Counts ──────────────────────────────────────

  useEffect(() => {
    async function fetchFeaturedCounts() {
      const counts: Record<string, number> = {};
      await Promise.all(
        FEATURED_GROUPS.map(async (fg) => {
          try {
            const res = await fetch(`/api/groups/${fg.id}/members`);
            if (res.ok) {
              const data: GroupMember[] = await res.json();
              counts[fg.id] = data.length;
            }
          } catch {
            // ignore
          }
        })
      );
      setFeaturedCounts(counts);
    }
    fetchFeaturedCounts();
  }, []);

  // ─── Fetch Members ─────────────────────────────────────────────────────

  const fetchMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      const data: GroupMember[] = await res.json();
      setMembers(data);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const handleSelectGroup = (groupId: string) => {
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
      setMembers([]);
    } else {
      setSelectedGroupId(groupId);
      fetchMembers(groupId);
    }
  };

  // ─── Search Users ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!addDialogOpen) {
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/groups/${selectedGroupId}/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
        if (res.ok) {
          const data: SearchUser[] = await res.json();
          // Filter out users already in the group
          const memberIds = new Set(members.map((m) => m.id));
          setSearchResults(data.filter((u) => !memberIds.has(u.id)));
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, addDialogOpen, selectedGroupId, members]);

  // ─── Add Member ───────────────────────────────────────────────────────

  const handleAddMember = async (userId: string) => {
    if (!selectedGroupId) return;
    setAddingUserId(userId);
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to add member");
        return;
      }
      setAddDialogOpen(false);
      fetchMembers(selectedGroupId);
    } catch {
      alert("Failed to add member");
    } finally {
      setAddingUserId(null);
    }
  };

  // ─── Remove Member ────────────────────────────────────────────────────

  const handleRemoveMember = async () => {
    if (!selectedGroupId || !memberToRemove) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberToRemove.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to remove member");
        return;
      }
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
      fetchMembers(selectedGroupId);
    } catch {
      alert("Failed to remove member");
    } finally {
      setRemoving(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const isDynamic = selectedGroup?.type === "dynamic";

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Group Management
          </h1>
          <p className="text-muted-foreground">
            Manage Entra ID group memberships
          </p>
        </div>
        <Link href="/admin/audit?entityType=group">
          <Button variant="outline" size="sm">
            <ExternalLink className="mr-2 h-4 w-4" />
            View changes
          </Button>
        </Link>
      </div>

      {/* Featured Groups */}
      <div className="grid gap-4 md:grid-cols-2">
        {FEATURED_GROUPS.map((fg) => {
          const group = groups.find((g) => g.id === fg.id);
          return (
            <Card
              key={fg.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => handleSelectGroup(fg.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    {fg.name}
                  </div>
                </CardTitle>
                {group && (
                  <Badge
                    variant={
                      group.type === "dynamic" ? "secondary" : "outline"
                    }
                  >
                    {group.type === "dynamic" ? "Dynamic" : "Assigned"}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users2 className="h-4 w-4" />
                    {featuredCounts[fg.id] !== undefined
                      ? `${featuredCounts[fg.id]} members`
                      : "Loading..."}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectGroup(fg.id);
                    }}
                  >
                    Manage
                    {selectedGroupId === fg.id ? (
                      <ChevronDown className="ml-1 h-4 w-4" />
                    ) : (
                      <ChevronRight className="ml-1 h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Group Detail (if a featured group is selected and detail should show above table) */}
      {selectedGroupId &&
        FEATURED_GROUPS.some((fg) => fg.id === selectedGroupId) && (
          <GroupDetailSection
            group={selectedGroup}
            members={members}
            membersLoading={membersLoading}
            isDynamic={isDynamic}
            onAddMember={() => setAddDialogOpen(true)}
            onRemoveMember={(m) => {
              setMemberToRemove(m);
              setRemoveDialogOpen(true);
            }}
          />
        )}

      {/* All Groups Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Groups</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Group Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    No groups found.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => {
                  const isSelected = selectedGroupId === group.id;
                  const isFeatured = FEATURED_GROUPS.some(
                    (fg) => fg.id === group.id
                  );
                  return (
                    <TableRow
                      key={group.id}
                      className="cursor-pointer"
                      onClick={() => handleSelectGroup(group.id)}
                    >
                      <TableCell className="w-8">
                        {isSelected ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {group.displayName}
                          {isFeatured && (
                            <Badge variant="default" className="text-xs">
                              Featured
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            group.type === "dynamic" ? "secondary" : "outline"
                          }
                        >
                          {group.type === "dynamic" ? "Dynamic" : "Assigned"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectGroup(group.id);
                          }}
                        >
                          {isSelected ? "Collapse" : "Manage"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Group Detail (for non-featured selected group, shown below table) */}
      {selectedGroupId &&
        !FEATURED_GROUPS.some((fg) => fg.id === selectedGroupId) && (
          <GroupDetailSection
            group={selectedGroup}
            members={members}
            membersLoading={membersLoading}
            isDynamic={isDynamic}
            onAddMember={() => setAddDialogOpen(true)}
            onRemoveMember={(m) => {
              setMemberToRemove(m);
              setRemoveDialogOpen(true);
            }}
          />
        )}

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Search for a user in Entra ID to add to{" "}
              <strong>{selectedGroup?.displayName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No users found.
                </p>
              )}
              {!searching &&
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.mail || user.userPrincipalName}
                        {user.department && ` - ${user.department}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addingUserId === user.id}
                      onClick={() => handleAddMember(user.id)}
                    >
                      {addingUserId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="mr-1 h-3 w-3" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <strong>{memberToRemove?.displayName}</strong> from{" "}
              <strong>{selectedGroup?.displayName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveDialogOpen(false);
                setMemberToRemove(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={handleRemoveMember}
            >
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Group Detail Sub-Component ───────────────────────────────────────────

function GroupDetailSection({
  group,
  members,
  membersLoading,
  isDynamic,
  onAddMember,
  onRemoveMember,
}: {
  group: EntraGroup | undefined;
  members: GroupMember[];
  membersLoading: boolean;
  isDynamic: boolean;
  onAddMember: () => void;
  onRemoveMember: (m: GroupMember) => void;
}) {
  if (!group) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5" />
            {group.displayName}
            <Badge
              variant={isDynamic ? "secondary" : "outline"}
              className="ml-2"
            >
              {isDynamic ? "Dynamic" : "Assigned"}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!isDynamic && (
          <Button size="sm" onClick={onAddMember}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isDynamic && group.membershipRule && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
            <Info className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-200">
                Dynamic membership group
              </p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                Members are automatically managed based on the membership rule.
                Manual changes are not possible.
              </p>
              <code className="mt-2 block rounded bg-blue-100 px-2 py-1 text-xs dark:bg-blue-900">
                {group.membershipRule}
              </code>
            </div>
          </div>
        )}

        {membersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No members in this group.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Job Title</TableHead>
                {!isDynamic && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.displayName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.mail || member.userPrincipalName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.department || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.jobTitle || "-"}
                  </TableCell>
                  {!isDynamic && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onRemoveMember(member)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, ListOrdered } from "lucide-react";

interface QueueRecord {
  id: string;
  name: string;
  description: string | null;
  autoAssign: boolean;
  assignmentStrategy: string | null;
  isActive: boolean;
  teamId: string;
  teamName: string | null;
  createdAt: string;
}

interface TeamRecord {
  id: string;
  name: string;
}

export default function QueuesPage() {
  const [queues, setQueues] = useState<QueueRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [description, setDescription] = useState("");
  const [autoAssign, setAutoAssign] = useState(false);
  const [assignmentStrategy, setAssignmentStrategy] = useState("manual");

  const fetchQueues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/queues");
      if (!res.ok) throw new Error("Failed to fetch queues");
      const data = await res.json();
      setQueues(Array.isArray(data) ? data : []);
    } catch {
      setQueues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/users?type=teams");
      if (!res.ok) return;
      const data = await res.json();
      setTeams(Array.isArray(data) ? data : []);
    } catch {
      // Teams endpoint may not exist yet; use empty list
      setTeams([]);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
    fetchTeams();
  }, [fetchQueues, fetchTeams]);

  async function handleCreate() {
    if (!name || !teamId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          teamId,
          description: description || null,
          autoAssign,
          assignmentStrategy,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to create queue");
        return;
      }
      setName("");
      setTeamId("");
      setDescription("");
      setAutoAssign(false);
      setAssignmentStrategy("manual");
      setDialogOpen(false);
      fetchQueues();
    } catch {
      alert("Failed to create queue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ListOrdered className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Queues</h1>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Queue
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Queue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="queue-name">Queue Name</Label>
                <Input
                  id="queue-name"
                  placeholder="e.g. IT Operations"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="queue-team">Team</Label>
                {teams.length > 0 ? (
                  <Select value={teamId} onValueChange={setTeamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="queue-team"
                    placeholder="Team ID (UUID)"
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="queue-desc">Description</Label>
                <Input
                  id="queue-desc"
                  placeholder="Optional description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="queue-strategy">Assignment Strategy</Label>
                <Select
                  value={assignmentStrategy}
                  onValueChange={(v) => {
                    setAssignmentStrategy(v);
                    setAutoAssign(v !== "manual");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                    <SelectItem value="load_balanced">Load Balanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!name || !teamId || submitting}
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  )}
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? "Loading..." : `${queues.length} queues`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : queues.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No queues configured yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue Name</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Assignment Strategy</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.name}</TableCell>
                    <TableCell>{q.teamName || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {(q.assignmentStrategy || "manual").replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          q.isActive
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-gray-100 text-gray-500 border-gray-200"
                        }
                      >
                        {q.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

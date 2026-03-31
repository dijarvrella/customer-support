import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_SLA } from "@/lib/constants";
import { Settings, Clock, MessageSquare, Users } from "lucide-react";

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 1440) return `${minutes / 60}h`;
  return `${minutes / 1440} days`;
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* SLA Objectives */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle>SLA Objectives</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Response Time</TableHead>
                <TableHead>Resolution Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(Object.entries(DEFAULT_SLA) as [string, { responseMinutes: number; resolutionMinutes: number }][]).map(
                ([priority, sla]) => (
                  <TableRow key={priority}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={PRIORITY_COLORS[priority]}
                      >
                        {PRIORITY_LABELS[priority]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDuration(sla.responseMinutes)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDuration(sla.resolutionMinutes)}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Auto-Reply Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Auto-Reply</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-reply on ticket creation</p>
              <p className="text-sm text-muted-foreground mt-1">
                A confirmation message is automatically posted when a new ticket
                is submitted.
              </p>
            </div>
            <Badge
              variant="outline"
              className="bg-emerald-100 text-emerald-800 border-emerald-200"
            >
              Enabled
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Assignment Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Auto-Assignment</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Strategy</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Round-robin across IT Operations team members based on open
                  ticket count.
                </p>
              </div>
              <Badge variant="outline">Round Robin</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Target Team</p>
                <p className="text-sm text-muted-foreground mt-1">
                  New tickets are automatically assigned to the IT Operations
                  team member with the fewest open tickets.
                </p>
              </div>
              <Badge variant="outline">IT Operations</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

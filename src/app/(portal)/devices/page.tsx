"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Monitor,
  Loader2,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  Laptop,
  Apple,
  Smartphone,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

// --- Action1 types ---

interface Action1Endpoint {
  id: string;
  name: string;
  status?: string;
  user_name?: string;
  os_name?: string;
  os_version?: string;
  last_seen?: string;
  reboot_required?: boolean;
  endpoint_groups?: string[];
  [key: string]: unknown;
}

interface Action1PolicyRun {
  id?: string;
  name?: string;
  policy_name?: string;
  status?: string;
  result?: string;
  progress?: number;
  started_at?: string;
  finished_at?: string;
  started?: string;
  finished?: string;
  [key: string]: unknown;
}

interface Action1MissingUpdate {
  id?: string;
  name?: string;
  platform?: string;
  status?: string;
}

interface Action1Vulnerability {
  cve_id?: string;
  cvss_score?: string;
  remediation_status?: string;
  remediation_deadline?: string;
  software_name?: string;
  cisa_kev?: string;
}

interface Action1InstalledSoftware {
  name: string;
}

interface ManagedDevice {
  id: string;
  deviceName: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: string;
  lastSyncDateTime: string;
  userDisplayName: string;
  userPrincipalName: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  managedDeviceOwnerType: string;
  enrolledDateTime: string;
  deviceRegistrationState: string;
}

/**
 * Map Windows build numbers to friendly OS version names.
 * Windows 11 reports as "10.0.xxxxx" in Intune which is misleading.
 */
function getFriendlyOsVersion(os: string, rawVersion: string): string {
  if (!rawVersion) return os || "Unknown";

  const osLower = (os || "").toLowerCase();

  if (osLower === "windows") {
    // Parse build number from "10.0.XXXXX.YYYY" format
    const parts = rawVersion.split(".");
    const build = parts.length >= 3 ? parseInt(parts[2], 10) : 0;

    if (build >= 26200) return "Windows 11 25H2";
    if (build >= 26100) return "Windows 11 24H2";
    if (build >= 22631) return "Windows 11 23H2";
    if (build >= 22621) return "Windows 11 22H2";
    if (build >= 22000) return "Windows 11 21H2";
    if (build >= 19045) return "Windows 10 22H2";
    if (build >= 19044) return "Windows 10 21H2";
    if (build >= 19043) return "Windows 10 21H1";
    if (build >= 19042) return "Windows 10 20H2";
    if (build >= 19041) return "Windows 10 2004";
    return `Windows (Build ${build})`;
  }

  if (osLower === "macos") {
    // macOS versions are reported correctly, just clean up
    const parts = rawVersion.split(".");
    const major = parseInt(parts[0], 10);
    if (major >= 15) return `macOS Sequoia ${rawVersion}`;
    if (major >= 14) return `macOS Sonoma ${rawVersion}`;
    if (major >= 13) return `macOS Ventura ${rawVersion}`;
    return `macOS ${rawVersion}`;
  }

  return `${os} ${rawVersion}`;
}

function ComplianceBadge({ state }: { state: string }) {
  switch (state?.toLowerCase()) {
    case "compliant":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
          Compliant
        </Badge>
      );
    case "noncompliant":
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
          Non-Compliant
        </Badge>
      );
    case "ingraceperiod":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
          Grace Period
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
          Unknown
        </Badge>
      );
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function formatOwnerType(type: string | null | undefined): string {
  if (!type) return "-";
  switch (type.toLowerCase()) {
    case "company":
      return "Company-owned";
    case "personal":
      return "Personal (BYOD)";
    default:
      return type;
  }
}

function Action1StatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase() ?? "";
  if (s === "online" || s === "connected") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
        Connected
      </Badge>
    );
  }
  if (s === "offline" || s === "disconnected") {
    return (
      <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
        Disconnected
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
      {status || "Unknown"}
    </Badge>
  );
}

function OsIcon({ os }: { os: string }) {
  const osLower = os?.toLowerCase() || "";
  if (osLower.includes("windows")) return <Laptop className="h-4 w-4 text-blue-600" />;
  if (osLower.includes("macos") || osLower.includes("mac os"))
    return <Apple className="h-4 w-4 text-gray-700" />;
  if (osLower.includes("ios") || osLower.includes("android"))
    return <Smartphone className="h-4 w-4 text-green-600" />;
  return <Monitor className="h-4 w-4 text-muted-foreground" />;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("end_user");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [osFilter, setOsFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");

  // Device detail dialog
  const [selectedDevice, setSelectedDevice] = useState<ManagedDevice | null>(null);

  // Action1 data for selected device
  const [action1Data, setAction1Data] = useState<{
    endpoint: Action1Endpoint | null;
    automationHistory: Action1PolicyRun[];
    missingUpdates: Action1MissingUpdate[];
    vulnerabilities: Action1Vulnerability[];
    installedSoftware: Action1InstalledSoftware[];
    orgId?: string;
  } | null>(null);
  const [action1Loading, setAction1Loading] = useState(false);
  const [action1Error, setAction1Error] = useState<string | null>(null);

  async function fetchAction1Data(deviceName: string) {
    setAction1Loading(true);
    setAction1Error(null);
    setAction1Data(null);
    try {
      const res = await fetch(
        `/api/action1/endpoint?deviceName=${encodeURIComponent(deviceName)}`
      );
      if (!res.ok) throw new Error("Failed to fetch Action1 data");
      const data = await res.json();
      setAction1Data(data);
    } catch {
      setAction1Error("Could not load Action1 data");
    } finally {
      setAction1Loading(false);
    }
  }

  // Get current user role
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (s?.user?.role) setCurrentRole(s.user.role);
      })
      .catch(() => {});
  }, []);

  // Fetch devices
  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetch("/api/devices");
        if (!res.ok) {
          if (res.status === 403) {
            setError("You do not have permission to view devices.");
            return;
          }
          throw new Error("Failed to fetch devices");
        }
        const data = await res.json();
        setDevices(data);
      } catch {
        setError("Failed to load devices.");
      } finally {
        setLoading(false);
      }
    }
    fetchDevices();
  }, []);

  // Client-side filtering
  const filteredDevices = useMemo(() => {
    let result = [...devices];

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.deviceName?.toLowerCase().includes(term) ||
          d.userDisplayName?.toLowerCase().includes(term)
      );
    }

    if (osFilter !== "all") {
      result = result.filter(
        (d) => d.operatingSystem?.toLowerCase() === osFilter.toLowerCase()
      );
    }

    if (complianceFilter !== "all") {
      result = result.filter(
        (d) => d.complianceState?.toLowerCase() === complianceFilter.toLowerCase()
      );
    }

    // Sort by device name
    result.sort((a, b) =>
      (a.deviceName || "").localeCompare(b.deviceName || "")
    );

    return result;
  }, [devices, searchQuery, osFilter, complianceFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = devices.length;
    const compliant = devices.filter(
      (d) => d.complianceState?.toLowerCase() === "compliant"
    ).length;
    const noncompliant = devices.filter(
      (d) => d.complianceState?.toLowerCase() === "noncompliant"
    ).length;
    const windows = devices.filter(
      (d) => d.operatingSystem?.toLowerCase() === "windows"
    ).length;
    const macOS = devices.filter((d) => {
      const os = d.operatingSystem?.toLowerCase() || "";
      return os === "macos" || os === "mac os";
    }).length;
    const other = total - windows - macOS;

    return { total, compliant, noncompliant, windows, macOS, other };
  }, [devices]);

  const [creatingComplianceTickets, setCreatingComplianceTickets] = useState(false);
  const [complianceTicketsResult, setComplianceTicketsResult] = useState<string | null>(null);

  async function handleCreateComplianceTickets() {
    const noncompliantDevices = devices.filter(
      (d) => d.complianceState?.toLowerCase() === "noncompliant"
    );
    if (noncompliantDevices.length === 0) return;

    setCreatingComplianceTickets(true);
    setComplianceTicketsResult(null);
    let created = 0;

    // Look up Rron's user ID - compliance tickets always assigned to him
    let rronId: string | null = null;
    try {
      const usersRes = await fetch("/api/users?search=rron");
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const rron = usersData.find((u: any) =>
          u.email?.toLowerCase().includes("rron")
        );
        if (rron) rronId = rron.id;
      }
    } catch {
      // will create without assignee
    }

    for (const device of noncompliantDevices) {
      try {
        const res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Non-compliant device: ${device.deviceName}`,
            description: `Device "${device.deviceName}" (${getFriendlyOsVersion(device.operatingSystem, device.osVersion)}) assigned to ${device.userDisplayName || "Unknown"} is non-compliant.\n\nModel: ${device.model || "-"}\nSerial: ${device.serialNumber || "-"}\nLast sync: ${device.lastSyncDateTime || "-"}\n\nPlease investigate and bring the device into compliance.`,
            priority: "high",
            categorySlug: "troubleshooting",
          }),
        });
        if (res.ok && rronId) {
          const ticket = await res.json();
          // Assign to Rron
          await fetch(`/api/tickets/${ticket.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assigneeId: rronId }),
          });
          created++;
        } else if (res.ok) {
          created++;
        }
      } catch {
        // continue with next device
      }
    }

    setComplianceTicketsResult(`${created} compliance ticket(s) created and assigned to Rron`);
    setCreatingComplianceTickets(false);
  }

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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Device Inventory
            </h1>
            <p className="text-sm text-muted-foreground">
              Intune managed devices overview
            </p>
          </div>
        </div>
        {stats.noncompliant > 0 && (
          <div className="flex items-center gap-2">
            {complianceTicketsResult && (
              <span className="text-sm text-emerald-600">{complianceTicketsResult}</span>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCreateComplianceTickets}
              disabled={creatingComplianceTickets}
            >
              {creatingComplianceTickets ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Shield className="h-4 w-4 mr-1" />
              )}
              Create Compliance Tickets ({stats.noncompliant})
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Devices
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Compliant
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-green-600">
              {stats.compliant}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Non-Compliant
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-red-600">
              {stats.noncompliant}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Windows
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.windows}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              macOS
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.macOS}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Other
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.other}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by device name or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={osFilter} onValueChange={setOsFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="OS Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All OS</SelectItem>
            <SelectItem value="windows">Windows</SelectItem>
            <SelectItem value="macos">macOS</SelectItem>
            <SelectItem value="ios">iOS</SelectItem>
            <SelectItem value="android">Android</SelectItem>
          </SelectContent>
        </Select>
        <Select value={complianceFilter} onValueChange={setComplianceFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Compliance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Compliance</SelectItem>
            <SelectItem value="compliant">Compliant</SelectItem>
            <SelectItem value="noncompliant">Non-Compliant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Device Table */}
      <div className="border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Device Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                  User
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                  OS
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                  Model
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Compliance
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">
                  Last Sync
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">
                  Serial Number
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {devices.length === 0
                      ? "No managed devices found"
                      : "No devices match the current filters"}
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => (
                  <tr
                    key={device.id}
                    onClick={() => {
                      setSelectedDevice(device);
                      fetchAction1Data(device.deviceName);
                    }}
                    className="border-b last:border-0 hover:bg-accent/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <OsIcon os={device.operatingSystem} />
                        <span className="font-medium">
                          {device.deviceName || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {device.userDisplayName || "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell" title={device.osVersion ? `Raw: ${device.operatingSystem} ${device.osVersion}` : undefined}>
                      <span>{getFriendlyOsVersion(device.operatingSystem, device.osVersion)}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {device.model || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <ComplianceBadge state={device.complianceState} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                      {formatDate(device.lastSyncDateTime)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell font-mono text-xs">
                      {device.serialNumber || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results count */}
      {devices.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {filteredDevices.length} of {devices.length} devices
        </p>
      )}

      {/* Device Detail Dialog */}
      <Dialog
        open={!!selectedDevice}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDevice(null);
            setAction1Data(null);
            setAction1Error(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <OsIcon os={selectedDevice?.operatingSystem || ""} />
              {selectedDevice?.deviceName || "Device Details"}
            </DialogTitle>
            <DialogDescription>
              Device information from Intune and Action1
            </DialogDescription>
          </DialogHeader>

          {selectedDevice && (
            <Tabs defaultValue="intune" className="flex flex-col min-h-0 flex-1">
              <TabsList className="mb-4 shrink-0">
                <TabsTrigger value="intune">Intune</TabsTrigger>
                <TabsTrigger value="action1">Action1</TabsTrigger>
              </TabsList>

              {/* ── Intune tab ── */}
              <TabsContent value="intune" className="overflow-y-auto flex-1 pr-1">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Device
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Name</p>
                        <p className="font-medium">{selectedDevice.deviceName || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Operating System</p>
                        <p className="font-medium">
                          {getFriendlyOsVersion(selectedDevice.operatingSystem, selectedDevice.osVersion)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Build Version</p>
                        <p className="font-medium font-mono text-sm">{selectedDevice.osVersion || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Model</p>
                        <p className="font-medium">{selectedDevice.model || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Manufacturer</p>
                        <p className="font-medium">{selectedDevice.manufacturer || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Serial Number</p>
                        <p className="font-medium font-mono text-xs">{selectedDevice.serialNumber || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      User
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Display Name</p>
                        <p className="font-medium">{selectedDevice.userDisplayName || "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">{selectedDevice.userPrincipalName || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Compliance</p>
                        <div className="mt-1">
                          <ComplianceBadge state={selectedDevice.complianceState} />
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Owner Type</p>
                        <p className="font-medium">{formatOwnerType(selectedDevice.managedDeviceOwnerType)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Enrolled</p>
                        <p className="font-medium">{formatDate(selectedDevice.enrolledDateTime)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Sync</p>
                        <p className="font-medium">{formatDate(selectedDevice.lastSyncDateTime)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Action1 tab ── */}
              <TabsContent value="action1" className="overflow-y-auto flex-1 pr-1">
                {action1Loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : action1Error ? (
                  <div className="text-center py-10 space-y-2">
                    <XCircle className="h-8 w-8 mx-auto text-red-400" />
                    <p className="text-sm text-muted-foreground">{action1Error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchAction1Data(selectedDevice.deviceName)}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Retry
                    </Button>
                  </div>
                ) : !action1Data?.endpoint ? (
                  <div className="text-center py-10">
                    <Monitor className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                    <p className="text-sm text-muted-foreground">
                      Device not found in Action1
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Endpoint general info */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        Endpoint
                        {action1Data.orgId && action1Data.endpoint.id && (
                          <a
                            href={`https://app.eu.action1.com/console/endpoints?org=${action1Data.orgId}&endpoint=${action1Data.endpoint.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-[10px] font-normal text-muted-foreground hover:text-foreground underline underline-offset-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open in Action1 ↗
                          </a>
                        )}
                      </h3>
                      <div className="text-sm space-y-1.5">
                        {[
                          { label: "Status", value: <Action1StatusBadge status={action1Data.endpoint.status} /> },
                          { label: "Reboot Required", value: action1Data.endpoint.reboot_required
                              ? <span className="text-orange-600 font-medium">Yes</span>
                              : <span className="text-green-600">No</span> },
                          { label: "User", value: action1Data.endpoint.user_name || "-" },
                          { label: "OS", value: action1Data.endpoint.os_name || "-" },
                          { label: "Last Seen", value: formatDate(action1Data.endpoint.last_seen) || "-" },
                          ...(action1Data.endpoint.endpoint_groups?.length
                            ? [{ label: "Groups", value: action1Data.endpoint.endpoint_groups.join(", ") }]
                            : []),
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-start justify-between gap-4 py-1 border-b border-border/50 last:border-0">
                            <span className="text-muted-foreground shrink-0">{label}</span>
                            <span className="font-medium text-right">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Missing Updates */}
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        Missing Updates
                        {action1Data.missingUpdates.length > 0 && (
                          <span className="inline-flex items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-semibold px-2 py-0.5 min-w-[1.25rem]">
                            {action1Data.missingUpdates.length}
                          </span>
                        )}
                      </h3>
                      {action1Data.missingUpdates.length === 0 ? (
                        <p className="text-sm text-green-600 dark:text-green-400">Up to date</p>
                      ) : (
                        <div className="space-y-1">
                          {action1Data.missingUpdates.map((u, i) => (
                            <div key={u.id ?? i} className="flex items-center gap-2 text-xs rounded-md px-3 py-1.5 border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
                              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                              <span className="truncate">{u.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Vulnerabilities */}
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        Vulnerabilities
                        {action1Data.vulnerabilities.length > 0 && (
                          <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-semibold px-2 py-0.5 min-w-[1.25rem]">
                            {action1Data.vulnerabilities.length}
                          </span>
                        )}
                      </h3>
                      {action1Data.vulnerabilities.length === 0 ? (
                        <p className="text-sm text-green-600 dark:text-green-400">No vulnerabilities found</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                          {action1Data.vulnerabilities.map((v, i) => {
                            const score = parseFloat(v.cvss_score ?? "0");
                            const severity = score >= 9 ? "Critical" : score >= 7 ? "High" : score >= 4 ? "Medium" : "Low";
                            const severityColor =
                              severity === "Critical" ? "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400" :
                              severity === "High" ? "text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" :
                              severity === "Medium" ? "text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400" :
                              "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400";
                            const isOverdue = v.remediation_status?.toLowerCase() === "overdue";
                            return (
                              <div key={v.cve_id ?? i} className={`rounded-md px-3 py-2 text-xs border ${isOverdue ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800" : "border-border bg-muted/30"}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-semibold">{v.cve_id}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${severityColor}`}>{severity} {v.cvss_score}</span>
                                    {isOverdue && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400">Overdue</span>}
                                  </div>
                                </div>
                                {v.software_name && <p className="text-muted-foreground mt-0.5 truncate">{v.software_name}</p>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Installed Software */}
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        Installed Software
                        {action1Data.installedSoftware.length > 0 && (
                          <span className="text-xs text-muted-foreground font-normal">({action1Data.installedSoftware.length})</span>
                        )}
                      </h3>
                      {action1Data.installedSoftware.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No data available</p>
                      ) : (
                        <div className="space-y-0.5 max-h-[180px] overflow-y-auto pr-1">
                          {action1Data.installedSoftware.map((s, i) => (
                            <div key={i} className="text-xs px-3 py-1 rounded bg-muted/40 truncate">{s.name}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Automation history */}
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        Automation History
                        {action1Data.automationHistory.some(
                          (r) => (r.status ?? r.result)?.toLowerCase() === "error" ||
                                 (r.status ?? r.result)?.toLowerCase() === "failed"
                        ) && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                        {action1Data.orgId && (
                          <a
                            href={`https://app.eu.action1.com/console/automations?org=${action1Data.orgId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-[10px] font-normal text-muted-foreground hover:text-foreground underline underline-offset-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open in Action1 ↗
                          </a>
                        )}
                      </h3>

                      {action1Data.automationHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No automation history available</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                          {action1Data.automationHistory.map((run, i) => {
                            const status = (run.status ?? run.result ?? "").toLowerCase();
                            const isError = status === "error" || status === "failed";
                            const name = run.name ?? run.policy_name ?? `Run #${i + 1}`;
                            const started = run.started_at ?? run.started;
                            const finished = run.finished_at ?? run.finished;
                            return (
                              <div
                                key={run.id ?? i}
                                className={`flex items-start justify-between gap-3 rounded-md px-3 py-2 text-xs border ${
                                  isError
                                    ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
                                    : "border-border bg-muted/30"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {isError ? (
                                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                  )}
                                  {action1Data.orgId ? (
                                    <a
                                      href={`https://app.eu.action1.com/console/automations?org=${action1Data.orgId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="truncate font-medium hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {name}
                                    </a>
                                  ) : (
                                    <span className="truncate font-medium">{name}</span>
                                  )}
                                </div>
                                <div className="text-right shrink-0 text-muted-foreground space-y-0.5">
                                  {started && <p>{formatDate(started)}</p>}
                                  {finished && started !== finished && (
                                    <p>→ {formatDate(finished)}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";

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
  const [selectedDevice, setSelectedDevice] = useState<ManagedDevice | null>(
    null
  );

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
                    onClick={() => setSelectedDevice(device)}
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
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      <span>{device.operatingSystem || "-"}</span>
                      {device.osVersion && (
                        <span className="text-xs ml-1 text-muted-foreground/70">
                          {device.osVersion}
                        </span>
                      )}
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
          if (!open) setSelectedDevice(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <OsIcon os={selectedDevice?.operatingSystem || ""} />
              {selectedDevice?.deviceName || "Device Details"}
            </DialogTitle>
            <DialogDescription>
              Intune managed device information
            </DialogDescription>
          </DialogHeader>

          {selectedDevice && (
            <div className="space-y-4">
              {/* Device Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Device
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">
                      {selectedDevice.deviceName || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Operating System</p>
                    <p className="font-medium">
                      {selectedDevice.operatingSystem || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">OS Version</p>
                    <p className="font-medium">
                      {selectedDevice.osVersion || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Model</p>
                    <p className="font-medium">
                      {selectedDevice.model || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Manufacturer</p>
                    <p className="font-medium">
                      {selectedDevice.manufacturer || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Serial Number</p>
                    <p className="font-medium font-mono text-xs">
                      {selectedDevice.serialNumber || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* User Info */}
              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  User
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Display Name</p>
                    <p className="font-medium">
                      {selectedDevice.userDisplayName || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">
                      {selectedDevice.userPrincipalName || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Info */}
              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Compliance</p>
                    <div className="mt-1">
                      <ComplianceBadge
                        state={selectedDevice.complianceState}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Owner Type</p>
                    <p className="font-medium">
                      {formatOwnerType(
                        selectedDevice.managedDeviceOwnerType
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Enrolled</p>
                    <p className="font-medium">
                      {formatDate(selectedDevice.enrolledDateTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Sync</p>
                    <p className="font-medium">
                      {formatDate(selectedDevice.lastSyncDateTime)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvals } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = {
    name: session.user.name || "User",
    email: session.user.email || "",
    role: (session.user as Record<string, unknown>).role as string || "end_user",
    image: session.user.image,
  };

  // Only admins can access admin routes
  if (!["it_admin", "it_lead"].includes(user.role)) {
    redirect("/dashboard");
  }

  // Fetch pending approval count for the badge
  let pendingApprovalCount = 0;
  try {
    const pendingApprovals = await db
      .select({ id: approvals.id })
      .from(approvals)
      .where(
        and(
          eq(approvals.approverId, session.user.id as string),
          eq(approvals.status, "pending")
        )
      );
    pendingApprovalCount = pendingApprovals.length;
  } catch {
    // Silently handle DB errors for the badge count
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={user} pendingApprovalCount={pendingApprovalCount} />

      {/* Main content area */}
      <main className="lg:pl-64">
        {/* Spacer for mobile top bar */}
        <div className="h-14 lg:hidden" />
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

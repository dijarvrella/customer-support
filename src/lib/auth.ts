import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { db } from "@/lib/db";
import { users, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Global admin email - has it_admin across all tenants
const GLOBAL_ADMIN_EMAIL = "dijar@digitaldisruptor.tech";

// Zimark tenant admin emails
const TENANT_ADMINS: Record<string, string[]> = {
  zimark: [
    "dijar.v@zimark.io",
    "rron.b@zimark.io",
    "arbnor.m@zimark.io",
  ],
};

function getRoleForEmail(email: string): string {
  if (email === GLOBAL_ADMIN_EMAIL) return "it_admin";
  for (const [, admins] of Object.entries(TENANT_ADMINS)) {
    if (admins.includes(email)) return "it_admin";
  }
  return "end_user";
}

async function getTenantIdForEmail(email: string): Promise<string | null> {
  const domain = email.split("@")[1];
  if (!domain) return null;
  try {
    // Match tenant by domain
    const tenant = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.domain, domain))
      .limit(1);
    if (tenant.length > 0) return tenant[0].id;

    // Try matching zimark.io -> zimark.link
    if (domain === "zimark.io") {
      const zimarkTenant = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, "zimark"))
        .limit(1);
      if (zimarkTenant.length > 0) return zimarkTenant[0].id;
    }
  } catch {
    // silent
  }
  return null;
}

const providers: NextAuthConfig["providers"] = [];

// Microsoft Entra ID (Azure AD) SSO
if (
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope: "openid profile email User.Read",
        },
      },
    })
  );
}

// Break-glass emergency admin account
const BREAK_GLASS_EMAIL = "admin@zimark.io";
const BREAK_GLASS_PASSWORD = process.env.BREAK_GLASS_PASSWORD || "ZimarkBG-Admin2026!";

providers.push(
  Credentials({
    name: "Emergency Access",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email as string;
      const password = credentials?.password as string;

      // Break-glass admin
      if (email === BREAK_GLASS_EMAIL && password === BREAK_GLASS_PASSWORD) {
        return {
          id: "00000000-0000-0000-0000-000000000099",
          email: BREAK_GLASS_EMAIL,
          name: "Zimark Support Admin",
          role: "it_admin",
          image: null,
        };
      }

      // Demo tenant users (for presentations)
      const demoUsers = [
        { id: "00000000-0000-0000-0000-000000000001", email: "admin@demo-company.com", name: "Demo IT Admin", role: "it_admin", image: null },
        { id: "00000000-0000-0000-0000-000000000002", email: "agent@demo-company.com", name: "Demo IT Agent", role: "it_agent", image: null },
        { id: "00000000-0000-0000-0000-000000000003", email: "user@demo-company.com", name: "Demo Employee", role: "end_user", image: null },
        { id: "00000000-0000-0000-0000-000000000004", email: "hr@demo-company.com", name: "Demo HR", role: "hr", image: null },
        { id: "00000000-0000-0000-0000-000000000005", email: "security@demo-company.com", name: "Demo Security", role: "security", image: null },
      ];

      const demoUser = demoUsers.find((u) => u.email === email);
      if (demoUser && password === "demo") {
        return demoUser;
      }

      return null;
    },
  })
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.role = (user as unknown as Record<string, unknown>).role || "end_user";
        token.id = user.id;
      }

      // For Microsoft SSO: look up or create user in database
      if (account?.provider === "microsoft-entra-id" && profile?.email) {
        const email = profile.email as string;
        const role = getRoleForEmail(email);
        const tenantId = await getTenantIdForEmail(email);

        try {
          const existing = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (existing.length > 0) {
            token.id = existing[0].id;
            token.role = existing[0].role;
            token.tenantId = existing[0].tenantId;

            // Update role if it changed (e.g., promoted to admin)
            if (existing[0].role !== role && role !== "end_user") {
              await db
                .update(users)
                .set({ role, updatedAt: new Date() })
                .where(eq(users.id, existing[0].id));
              token.role = role;
            }
          } else {
            // JIT provision on first SSO login
            const newUser = await db
              .insert(users)
              .values({
                email,
                name: (profile.name as string) || email,
                entraObjectId: profile.sub as string,
                role,
                tenantId,
                isActive: true,
              })
              .returning();
            if (newUser.length > 0) {
              token.id = newUser[0].id;
              token.role = newUser[0].role;
              token.tenantId = newUser[0].tenantId;
            }
          }
        } catch (err) {
          console.error("Error during SSO user lookup/creation:", err);
        }

        // Global admin override
        if (email === GLOBAL_ADMIN_EMAIL) {
          token.role = "it_admin";
          token.isGlobalAdmin = true;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).tenantId = token.tenantId;
        (session.user as unknown as Record<string, unknown>).isGlobalAdmin = token.isGlobalAdmin || false;
      }
      return session;
    },
  },
  trustHost: true,
});

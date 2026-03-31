import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const providers: NextAuthConfig["providers"] = [];

// Microsoft Entra ID (Azure AD) SSO - enabled when env vars are set
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
    })
  );
}

// Break-glass emergency admin account
const BREAK_GLASS_EMAIL = "zimark-support-admin@zimark.com";
const BREAK_GLASS_PASSWORD = process.env.BREAK_GLASS_PASSWORD || "Zm$upport!2026#BG";

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

      // Break-glass admin account
      if (email === BREAK_GLASS_EMAIL && password === BREAK_GLASS_PASSWORD) {
        return {
          id: "00000000-0000-0000-0000-000000000001",
          email: BREAK_GLASS_EMAIL,
          name: "Zimark Support Admin",
          role: "it_admin",
          image: null,
        };
      }

      // Also allow seeded demo users (for demo tenant presentation)
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

      // For Microsoft SSO: look up or create the user in the database
      if (account?.provider === "microsoft-entra-id" && profile?.email) {
        try {
          const existing = await db
            .select()
            .from(users)
            .where(eq(users.email, profile.email as string))
            .limit(1);

          if (existing.length > 0) {
            token.id = existing[0].id;
            token.role = existing[0].role;
          } else {
            // JIT provision: create user on first SSO login
            const newUser = await db
              .insert(users)
              .values({
                email: profile.email as string,
                name: (profile.name as string) || profile.email as string,
                entraObjectId: profile.sub as string,
                role: "end_user",
                isActive: true,
              })
              .returning();
            if (newUser.length > 0) {
              token.id = newUser[0].id;
              token.role = newUser[0].role;
            }
          }
        } catch (err) {
          console.error("Error during SSO user lookup/creation:", err);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).role = token.role;
      }
      return session;
    },
  },
  trustHost: true,
});

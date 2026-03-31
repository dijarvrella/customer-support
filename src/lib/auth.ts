import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

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
      authorization: {
        params: {
          scope: "openid profile email User.Read",
        },
      },
    })
  );
}

// Demo credentials provider - always available for development/demo
providers.push(
  Credentials({
    name: "Demo Login",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "admin@company.com" },
      password: { label: "Password", type: "password", placeholder: "demo" },
    },
    async authorize(credentials) {
      const demoUsers = [
        { id: "00000000-0000-0000-0000-000000000001", email: "admin@company.com", name: "IT Admin", role: "it_admin", image: null },
        { id: "00000000-0000-0000-0000-000000000002", email: "agent@company.com", name: "IT Agent", role: "it_agent", image: null },
        { id: "00000000-0000-0000-0000-000000000003", email: "user@company.com", name: "John Employee", role: "end_user", image: null },
        { id: "00000000-0000-0000-0000-000000000004", email: "hr@company.com", name: "Sarah HR", role: "hr", image: null },
        { id: "00000000-0000-0000-0000-000000000005", email: "security@company.com", name: "Security Reviewer", role: "security", image: null },
      ];

      const email = credentials?.email as string;
      const user = demoUsers.find((u) => u.email === email);

      if (user && credentials?.password === "demo") {
        return user;
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
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as Record<string, unknown>).role || "end_user";
        token.id = user.id;
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

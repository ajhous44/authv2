import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import authConfig from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      role?: string;
    } & DefaultSession["user"]
  }
}

export const { auth, handlers } = NextAuth({
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.role = profile.role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  ...authConfig,
}); 
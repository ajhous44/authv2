import NextAuth, { customFetch } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { NextAuthConfig } from "next-auth";
import { ProxyAgent, fetch as undici } from "undici";

// Create proxy agent if proxy is configured
const dispatcher = process.env.http_proxy ? new ProxyAgent(process.env.http_proxy) : undefined;

// Custom fetch function that uses the proxy
function proxy(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
  if (!dispatcher) return fetch(...args);
  // @ts-expect-error `undici` has a `duplex` option
  return undici(args[0], { ...args[1], dispatcher });
}

const config = {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: { params: { scope: "openid profile email" } },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: null,
        };
      },
      [customFetch]: proxy,
    }),
  ],
} satisfies NextAuthConfig;

export const { handlers, signIn, signOut, auth } = NextAuth(config); 
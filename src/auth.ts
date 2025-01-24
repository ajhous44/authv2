import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { ProxyAgent } from "undici";

// Create proxy agent if proxy is configured
const proxyAgent = process.env.http_proxy ? new ProxyAgent(process.env.http_proxy) : undefined;

// Custom fetch function that uses the proxy
const proxyFetch = async (url: string, options: RequestInit) => {
  if (!proxyAgent) return fetch(url, options);
  // Use type assertion for the proxy agent
  return fetch(url, { ...options, agent: proxyAgent } as RequestInit);
};

export const { handlers, signIn, signOut, auth } = NextAuth({
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
    }),
  ],
  // @ts-expect-error - fetch is available in Next.js runtime
  runtime: { fetch: proxyFetch },
}); 
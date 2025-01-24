import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { NextAuthConfig } from "next-auth";
import { ProxyAgent } from "undici";

// Create proxy agent if HTTP_PROXY is set
const proxyAgent = process.env.HTTP_PROXY ? new ProxyAgent(process.env.HTTP_PROXY) : undefined;

// Configure global fetch to use proxy
if (proxyAgent) {
  global.fetch = (url: string | URL | Request, init?: RequestInit) => {
    return fetch(url, {
      ...init,
      // @ts-expect-error - undici's ProxyAgent is not compatible with node-fetch's Agent type
      agent: proxyAgent
    });
  };
}

export default {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_ENTRA_ID_CLIENT_ID,
      clientSecret: process.env.AUTH_ENTRA_ID_CLIENT_SECRET,
      authorization: { 
        params: { 
          scope: "openid profile email User.Read",
          tenant: process.env.AUTH_ENTRA_ID_TENANT_ID
        } 
      }
    }),
  ],
} satisfies NextAuthConfig 
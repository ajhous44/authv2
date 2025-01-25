# Microsoft Entra ID with Corporate Proxy for Next.js

This guide explains how to implement Microsoft Entra ID (formerly Azure AD) authentication with corporate proxy support in a Next.js application using `next-auth`.

## Installation

```bash
npm install next-auth undici
# or
yarn add next-auth undici
```

## Implementation

### 1. Proxy Fetch Utility (`proxyFetch.ts`)

```typescript
import { ProxyAgent, fetch as undici } from "undici";

const proxyUrl =
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy;

export function proxyFetch(
  ...args: Parameters<typeof fetch>
): ReturnType<typeof fetch> {
  if (!proxyUrl) {
    return fetch(...args);
  }

  console.log(
    "Proxy called for URL:",
    args[0] instanceof Request ? args[0].url : args[0]
  );
  
  const dispatcher = new ProxyAgent(proxyUrl);

  if (args[0] instanceof Request) {
    const request = args[0];
    return undici(request.url, {
      ...args[1],
      method: request.method,
      headers: request.headers as HeadersInit,
      body: request.body,
      dispatcher,
    });
  }

  return undici(args[0], { ...(args[1] || {}), dispatcher });
}
```

### 2. Auth Configuration (`auth.ts`)

```typescript
import NextAuth, { NextAuthConfig } from "next-auth";
import { customFetch } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { proxyFetch } from "./proxyFetch";

const proxyUrl =
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy;

// Provider configuration
const provider = MicrosoftEntraID({
  clientId: process.env.ENTRA_CLIENT_ID!,
  clientSecret: process.env.ENTRA_CLIENT_SECRET!,
  issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID!}/v2.0`,
  authorization: {
    params: {
      scope: `api://${process.env.ENTRA_CLIENT_ID!}/default openid profile email`,
    },
  },
  client: {
    token_endpoint_auth_method: "client_secret_post",
  },
});

// Configure proxy support
if (proxyUrl) {
  console.log("Proxy is enabled for Microsoft Entra ID:", proxyUrl);

  // Override the customFetch symbol in the provider
  provider[customFetch] = async (...args: Parameters<typeof fetch>) => {
    const url = new URL(args[0] instanceof Request ? args[0].url : args[0]);
    console.log("Custom Fetch Intercepted:", url.toString());

    // Handle .well-known/openid-configuration logic
    if (url.pathname.endsWith(".well-known/openid-configuration")) {
      console.log("Intercepting .well-known/openid-configuration");
      const response = await proxyFetch(...args);
      const json = await response.clone().json();
      const tenantRe = /microsoftonline\.com\/(\w+)\/v2\.0/;
      const tenantId = provider.issuer?.match(tenantRe)?.[1] ?? "common";
      const issuer = json.issuer.replace("{tenantid}", tenantId);
      console.log("Modified issuer:", issuer);
      return Response.json({ ...json, issuer });
    }

    // Fallback for all other requests
    return proxyFetch(...args);
  };

  // Override profile to avoid large headers issue
  provider.profile = async (profile, tokens) => {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: null,
      accessToken: tokens.access_token ?? "",
    };
  };
}

// Auth configuration
export const config = {
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  providers: [provider],
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt: async ({ token, user, account }) => {
      if (account && user) {
        let accessToken: string | undefined;
        let tenantId: string | undefined;
        let role: string | undefined;

        accessToken = account.access_token;
        if (account.id_token) {
          try {
            const payload = JSON.parse(
              Buffer.from(account.id_token.split(".")[1], "base64").toString()
            );
            role = payload.roles?.[0] || "user";
            tenantId = payload.tid;
          } catch (e) {
            console.warn("Failed to decode id_token:", e);
          }
        }

        if (!accessToken) {
          throw new Error("No access token available");
        }

        token.accessToken = accessToken;
        token.tenantId = tenantId;
        token.role = role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (token) {
        session.accessToken = token.accessToken;
        session.tenantId = token.tenantId;
        session.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);
```

### 3. Middleware for Protected Routes (`middleware.ts`)

```typescript
import { NextResponse } from "next/server";
import { auth } from "./auth";

export default auth((req) => {
  // If the user is not authenticated and not on signin page, redirect to signin
  if (!req.auth && !req.nextUrl.pathname.startsWith("/signin")) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // If authenticated and on signin page, redirect to home
  if (req.auth && req.nextUrl.pathname.startsWith("/signin")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

// Optionally configure which paths to protect
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

### 4. Environment Variables (`.env`)

```env
# Microsoft Entra ID Configuration
ENTRA_CLIENT_ID=your_client_id
ENTRA_CLIENT_SECRET=your_client_secret
ENTRA_TENANT_ID=your_tenant_id

# Proxy Configuration (if using corporate proxy)
HTTP_PROXY=http://your-corporate-proxy:port
HTTPS_PROXY=http://your-corporate-proxy:port

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_string
```

## Usage

### 1. Client-Side Authentication

```typescript
// In your React components
"use client";
import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButtons() {
  const { data: session } = useSession();

  if (session) {
    return (
      <>
        Signed in as {session.user?.email} <br />
        Role: {session.role} <br />
        <button onClick={() => signOut()}>Sign out</button>
      </>
    );
  }
  return <button onClick={() => signIn("microsoft-entra-id")}>Sign in</button>;
}
```

### 2. Server-Side Authentication

```typescript
// In your Server Components or API routes
import { auth } from "@/auth";

export default async function ProtectedPage() {
  const session = await auth();
  
  if (!session) {
    return <div>Not authenticated</div>;
  }

  return (
    <div>
      <h1>Protected Page</h1>
      <p>User: {session.user?.email}</p>
      <p>Role: {session.role}</p>
      <p>Tenant: {session.tenantId}</p>
    </div>
  );
}
```

## Key Features

1. **Corporate Proxy Support**: Handles authentication through corporate proxies using `undici`
2. **Token Processing**: Extracts roles and tenant information from ID tokens
3. **Session Management**: Maintains tenant ID and role information
4. **Header Size Management**: Avoids 431 errors by skipping profile photo fetching
5. **OpenID Configuration**: Handles tenant-specific issuer URLs

## Azure Portal Configuration

1. Register a new application in Azure Portal:
   - Navigate to Microsoft Entra ID > App registrations > New registration
   - Set redirect URI: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - Configure API permissions (Microsoft Graph: User.Read is minimum)
   - Create a client secret
   - Configure group claims if using role-based access

2. Configure Authentication:
   - Enable ID tokens
   - Enable access tokens
   - Configure token version (v2.0)

## Troubleshooting

1. **Proxy Issues**:
   - Verify proxy URL format
   - Check proxy environment variables
   - Enable debug mode to see request logs

2. **Token Issues**:
   - Check client ID and secret
   - Verify redirect URI configuration
   - Check token configuration in Azure Portal

3. **Role/Group Issues**:
   - Verify group claims configuration
   - Check token contents for roles/groups
   - Ensure user is member of required groups

## Security Considerations

1. Always use HTTPS in production
2. Store secrets in environment variables
3. Implement proper role-based access control
4. Use secure session configuration
5. Regularly rotate client secrets
6. Monitor authentication logs 
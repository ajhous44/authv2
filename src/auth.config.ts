import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { NextAuthConfig } from "next-auth";
import { ProxyAgent, fetch as undici } from "undici";
import { customFetch } from "next-auth";

// Get proxy URL from any of the possible environment variables
const proxyUrl = 
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy;

// Create proxy fetch function
function proxyFetch(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
  console.log(
    "Proxy called for URL:",
    args[0] instanceof Request ? args[0].url : args[0]
  );
  const dispatcher = new ProxyAgent(proxyUrl!);

  if (args[0] instanceof Request) {
    const request = args[0];
    const init = {
      ...args[1],
      method: request.method,
      headers: request.headers as HeadersInit,
      dispatcher,
    };
    
    if (request.body) {
      init.body = request.body as BodyInit;
    }

    // @ts-expect-error `undici` has a `duplex` option
    return undici(request.url, init);
  }

  // @ts-expect-error `undici` has a `duplex` option
  return undici(args[0], { ...(args[1] || {}), dispatcher });
}

// Create and configure the provider with proxy support
function createEntraIDProvider() {
  if (!proxyUrl) {
    console.log("Proxy is not enabled");
  } else {
    console.log("Proxy is enabled:", proxyUrl);
  }

  // Create base provider
  const provider = MicrosoftEntraID({
    clientId: process.env.AUTH_ENTRA_ID_CLIENT_ID!,
    clientSecret: process.env.AUTH_ENTRA_ID_CLIENT_SECRET!,
    authorization: { 
      params: { 
        scope: "openid profile email User.Read",
        tenant: process.env.AUTH_ENTRA_ID_TENANT_ID
      } 
    }
  });

  if (!proxyUrl) return provider;

  // Override customFetch to handle proxy
  provider[customFetch] = async (...args: Parameters<typeof fetch>) => {
    const url = new URL(args[0] instanceof Request ? args[0].url : args[0]);
    console.log("Custom Fetch Intercepted:", url.toString());

    // Handle OpenID configuration
    if (url.pathname.endsWith(".well-known/openid-configuration")) {
      console.log("Intercepting .well-known/openid-configuration");
      const response = await proxyFetch(...args);
      const json = await response.clone().json();
      const tenantId = process.env.AUTH_ENTRA_ID_TENANT_ID ?? "common";
      const issuer = json.issuer.replace("{tenantid}", tenantId);
      console.log("Modified issuer:", issuer);
      return Response.json({ ...json, issuer });
    }

    return proxyFetch(...args);
  };

  // Override profile to use proxy for photo fetch
  provider.profile = async (profile, tokens) => {
    const profilePhotoSize = 48;
    console.log("Fetching profile photo via proxy");

    const response = await proxyFetch(
      `https://graph.microsoft.com/v1.0/me/photos/${profilePhotoSize}x${profilePhotoSize}/$value`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    let image: string | null = null;
    if (response.ok && typeof Buffer !== "undefined") {
      try {
        const pictureBuffer = await response.arrayBuffer();
        const pictureBase64 = Buffer.from(pictureBuffer).toString("base64");
        image = `data:image/jpeg;base64,${pictureBase64}`;
      } catch (error) {
        console.error("Error processing profile photo:", error);
      }
    }

    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: image ?? null
    };
  };

  return provider;
}

export default {
  providers: [createEntraIDProvider()],
} satisfies NextAuthConfig 
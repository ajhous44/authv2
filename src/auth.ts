import NextAuth, { customFetch } from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { ProxyAgent, fetch as undici, type RequestInit as UndiciRequestInit } from "undici"

// Pick up proxy URL from environment if present
const proxyUrl =
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy

/**
 * A custom fetch that:
 * - Forwards calls to the default fetch if no proxy is set.
 * - Otherwise routes via Undici + ProxyAgent with TLS checks disabled (dev only).
 */
async function proxyFetch(...args: Parameters<typeof fetch>): Promise<Response> {
  const [input, init] = args

  if (!proxyUrl) {
    // No proxy => just use the default Node fetch
    return fetch(input, init)
  }

  const agent = new ProxyAgent({
    uri: proxyUrl,
    connect: { rejectUnauthorized: false }
  })

  if (input instanceof Request) {
    const body = init?.body ?? await input.arrayBuffer()
    return undici(input.url, {
      method: input.method,
      headers: input.headers as HeadersInit,
      body: body instanceof ArrayBuffer ? Buffer.from(body) : body,
      dispatcher: agent,
    } as UndiciRequestInit) as unknown as Response
  }

  return undici(input, {
    ...(init || {}),
    dispatcher: agent,
  } as UndiciRequestInit) as unknown as Response
}

// 1) Create a Microsoft Entra provider
const msEntra = MicrosoftEntraID({
  clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
  clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
  issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
})

// 2) Override the built-in customFetch so OAuth calls use our proxyFetch
msEntra[customFetch] = proxyFetch

// 3) Override the profile callback (which calls fetch directly)
msEntra.profile = async (profile, tokens) => {
  try {
    const photoSize = 48
    const res = await proxyFetch(
      `https://graph.microsoft.com/v1.0/me/photos/${photoSize}x${photoSize}/$value`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    )
    if (res.ok) {
      const buf = await res.arrayBuffer()
      const base64 = Buffer.from(buf).toString("base64")
      return {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: `data:image/jpeg;base64,${base64}`,
      }
    }
  } catch (err) {
    console.error("Error fetching Entra photo via proxy:", err)
  }

  // Fallback if something failed
  return {
    id: profile.sub,
    name: profile.name,
    email: profile.email,
    image: null,
  }
}

// 4) Export NextAuth config
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [msEntra],
})

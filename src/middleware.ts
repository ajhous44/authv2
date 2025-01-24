import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If user is not authenticated, redirect to login
  if (!token) {
    const loginUrl = new URL("/api/auth/signin", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Protect all routes except public ones
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|auth/signin).*)",
  ],
} as const; 
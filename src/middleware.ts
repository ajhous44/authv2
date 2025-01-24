import NextAuth from "next-auth";
import authConfig from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

// Export the middleware config
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
} as const;

export default middleware; 
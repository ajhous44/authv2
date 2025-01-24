'use client';

import { useSession, signIn, signOut } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-500 to-purple-600">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">
          Hello {session?.user?.name || "World"}!
        </h1>
        <p className="text-xl text-white opacity-80 mb-8">
          Welcome to Next.js with TypeScript and Entra ID Auth
        </p>
        
        {status === "loading" ? (
          <div className="text-white">Loading...</div>
        ) : session ? (
          <div className="space-y-4">
            <p className="text-white">Signed in as {session.user?.email}</p>
            <button
              onClick={() => signOut()}
              className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition-all"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("azure-ad")}
            className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition-all"
          >
            Sign in with Microsoft
          </button>
        )}
      </div>
    </main>
  );
}

'use client';

import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-500 to-purple-600">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">
          Welcome {session?.user?.name || "to Next.js"}!
        </h1>
        <p className="text-xl text-white opacity-80 mb-8">
          {status === "loading" ? (
            "Loading..."
          ) : session ? (
            `Signed in as ${session.user?.email}`
          ) : (
            "Please sign in"
          )}
        </p>

        {session ? (
          <button
            onClick={() => signOut()}
            className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition-all"
          >
            Sign out
          </button>
        ) : (
          <button
            onClick={() => signIn("microsoft-entra-id")}
            className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition-all"
          >
            Sign in with Microsoft
          </button>
        )}
      </div>
    </main>
  );
}

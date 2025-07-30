// src/app/page.tsx
'use client';

import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Velkommen til FuelMap!</h1>
      <Link href="/dashboard">
        <button className="bg-green-600 text-white px-8 py-3 rounded text-xl shadow hover:bg-green-700">
          Gå til Dashboard
        </button>
      </Link>
    </div>
  );
}

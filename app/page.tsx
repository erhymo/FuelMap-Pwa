"use client";

import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Velkommen til FuelMap</h1>
      <p className="mb-6 text-center">
        Velg hvor du vil gå:
      </p>
      <div className="flex gap-4">
        <Link href="/dashboard">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Dashboard
          </button>
        </Link>
        <Link href="/admin">
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
            Admin
          </button>
        </Link>
      </div>
    </main>
  );
}

 

// components/Login.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface LoginProps {
  onLogin: (employeeId: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      const q = query(collection(db, "employees"), where("pin", "==", pin));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const employeeId = doc.id;
        onLogin(employeeId);
      } else {
        setError("Feil PIN-kode");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Kunne ikke logge inn. Prøv igjen senere.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <Image
          src="/Airlift-logo.png"
          alt="Airlift logo"
          width={128}
          height={128}
          className="mb-4 w-32 h-32 object-contain"
        />
  <Image src="/Airlift-logo.png" alt="Airlift logo" width={128} height={128} className="mb-4 w-32 h-32 object-contain" />
  <h1 className="text-2xl font-extrabold mb-4 text-gray-900 text-center">Logg inn</h1>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Skriv inn 4-sifret PIN"
          maxLength={4}
          className="w-full border rounded p-2 mb-3 text-center tracking-widest text-2xl font-bold text-gray-900 placeholder-gray-700"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-lg font-extrabold"
        >
          Logg inn
        </button>
  {error && <p className="text-red-500 mt-3 font-bold">{error}</p>}
      </div>
  );
}

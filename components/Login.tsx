 

// components/Login.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface LoginProps {
  onLogin: (employeeId: string, employeeName: string) => void;
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
        const employeeName = doc.data().name || "Ukjent";
        onLogin(employeeId, employeeName);
      } else {
        setError("Feil PIN-kode");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Kunne ikke logge inn. Prøv igjen senere.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-100 to-blue-100">
      <div className="flex flex-col items-center w-full">
        <Image
          src="/Airlift-logo.png"
          alt="Airlift logo"
          width={180}
          height={60}
          className="mb-6 object-contain"
        />
        <div className="bg-white rounded-xl shadow-lg px-8 py-8 flex flex-col items-center w-full max-w-sm">
          <h2 className="text-xl font-extrabold text-center mb-6 text-blue-900">Logg inn med PIN</h2>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Skriv inn 4-sifret PIN"
            maxLength={4}
            className="w-full border-2 border-gray-300 rounded-lg p-3 mb-5 text-center text-lg font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg shadow hover:bg-blue-700 transition"
          >
            Logg inn
          </button>
          {error && <p className="text-red-500 mt-4 font-bold text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}

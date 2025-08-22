 

// components/Login.tsx
"use client";

import { useState } from "react";
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
      <div className="bg-white p-6 rounded shadow-md w-80 flex flex-col items-center">
        <img src="/Airlift-logo.png" alt="Airlift logo" className="mb-4 w-32 h-32 object-contain" />
        <h1 className="text-xl font-bold mb-4">Logg inn</h1>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Skriv inn 4-sifret PIN"
          maxLength={4}
          className="w-full border rounded p-2 mb-3 text-center tracking-widest text-2xl"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-lg font-bold"
        >
          Logg inn
        </button>
        {error && <p className="text-red-500 mt-3">{error}</p>}
      </div>
    </div>
  );
}

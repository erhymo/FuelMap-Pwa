'use client';

import Image from "next/image";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Home() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN må være 4 siffer.");
      return;
    }
    const q = query(collection(db, "users"), where("pin", "==", pin));
    const snap = await getDocs(q);
    if (snap.empty) {
      setError("Feil PIN-kode.");
      return;
    }
    // Lagre session til localStorage
    const user = snap.docs[0].data();
    localStorage.setItem("fuelmap_session", JSON.stringify({
      name: user.name,
      pin,
      expires: Date.now() + 5 * 60 * 60 * 1000, // 5 timer
    }));
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-100 to-blue-200">
      <div className="mb-8 bg-white p-4 rounded shadow">
        <Image
          src="/Airlift-logo.png"
          alt="Airlift logo"
          width={340}
          height={100}
          priority
        />
      </div>
      <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-4 bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-bold text-center mb-2">Logg inn med PIN</h2>
        <input
          type="password"
          inputMode="numeric"
          pattern="\d*"
          maxLength={4}
          placeholder="Skriv inn 4-sifret PIN"
          className="border rounded p-4 text-xl text-center tracking-widest bg-gray-100"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <button
          type="submit"
          className="bg-blue-700 hover:bg-blue-800 text-white py-3 rounded text-xl font-bold"
        >
          Logg inn
        </button>
        {error && (
          <div className="text-red-600 text-center text-lg">{error}</div>
        )}
      </form>
    </div>
  );
}

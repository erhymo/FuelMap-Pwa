'use client';

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN må være 4 tall.");
      return;
    }
    // Søk etter bruker i Firestore
    const q = query(collection(db, "users"), where("pin", "==", pin));
    const snap = await getDocs(q);
    if (snap.empty) {
      setError("Feil PIN. Prøv igjen.");
      return;
    }
    // Logg inn: lagre session
    const name = snap.docs[0].data().name;
    localStorage.setItem(
      "fuelmap_session",
      JSON.stringify({
        pin,
        name,
        expires: Date.now() + 5 * 60 * 60 * 1000, // 5 timer
      })
    );
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-100 to-blue-200">
      <div className="mb-10 text-4xl font-extrabold text-blue-900 drop-shadow">
        FuelMap AS
      </div>
      <form
        onSubmit={handleLogin}
        className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center gap-6 w-96 max-w-full"
      >
        <label className="text-2xl font-bold mb-2 text-blue-900">Logg inn med PIN</label>
        <input
          type="text"
          maxLength={4}
          pattern="\d*"
          inputMode="numeric"
          placeholder="Skriv inn 4-sifret PIN"
          className="border border-gray-400 rounded text-3xl text-center p-4 w-full bg-gray-50 focus:outline-none focus:border-blue-500 tracking-widest"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
        <button
          type="submit"
          className="bg-blue-700 text-white px-8 py-3 rounded text-2xl font-bold shadow hover:bg-blue-800 transition"
        >
          Logg inn
        </button>
        {error && <div className="text-red-500 text-lg">{error}</div>}
      </form>
    </div>
  );
}

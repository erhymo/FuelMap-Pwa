'use client';

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";

// Session-lengde: 5 timer i millisekunder
const SESSION_DURATION_MS = 5 * 60 * 60 * 1000;

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  // Sjekk om bruker er allerede innlogget (gyldig session)
  useEffect(() => {
    const session = localStorage.getItem("fuelmap_session");
    if (session) {
      const { expires, name } = JSON.parse(session);
      if (Date.now() < expires) {
        router.replace("/dashboard"); // Send til kartet
      } else {
        localStorage.removeItem("fuelmap_session"); // Utløpt session
      }
    }
  }, []);

  // Innlogging
  async function handleLogin(e: any) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    // Søk bruker med denne PIN
    const q = query(collection(db, "users"), where("pin", "==", pin));
    const snap = await getDocs(q);
    if (snap.empty) {
      setErr("Feil PIN-kode.");
      setLoading(false);
      return;
    }

    // Bruker funnet, lagre session (gyldig i 5 timer)
    const user = snap.docs[0].data();
    const expires = Date.now() + SESSION_DURATION_MS;
    localStorage.setItem(
      "fuelmap_session",
      JSON.stringify({ pin, name: user.name, expires })
    );

    // Første login kan logges her hvis ønsket (til Firestore-collection "logs")
    // (Se ekstra kode lenger ned)

    setLoading(false);
    router.replace("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">FuelMap PIN-innlogging</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="password"
            maxLength={4}
            pattern="[0-9]*"
            inputMode="numeric"
            placeholder="Skriv inn din 4-sifrede PIN"
            className="border rounded p-3 text-xl text-center tracking-widest"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
          />
          <button
            type="submit"
            className="bg-green-600 text-white text-xl py-2 rounded hover:bg-green-700"
            disabled={loading}
          >
            {loading ? "Logger inn..." : "Logg inn"}
          </button>
          {err && <div className="text-red-600 text-center">{err}</div>}
        </form>
        <p className="mt-6 text-center text-gray-400 text-xs">
          Kun ansatte med tildelt PIN har tilgang.<br />
          Du blir automatisk logget ut etter 5 timer.
        </p>
      </div>
    </div>
  );
}

 

'use client';

import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addLog } from "@/lib/log";

type Employee = {
  id: string;
  name: string;
  pin: string;
};

type LogEntry = {
  id: string;
  user: string;
  action: string;
  timestamp?: { seconds: number; nanoseconds: number };
};

export default function AdminPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<'ansatte' | 'logg' | 'database'>('ansatte');
  const [error, setError] = useState<string>("");

  // Hent ansatte fra Firestore
  useEffect(() => {
    if (!isLoggedIn) return;
    const unsub = onSnapshot(collection(db, "employees"), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });
    return () => unsub();
  }, [isLoggedIn]);

  // Hent logger fra Firestore
  useEffect(() => {
    if (!isLoggedIn) return;
    const unsub = onSnapshot(collection(db, "logs"), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry)));
    });
    return () => unsub();
  }, [isLoggedIn]);

  // Admin passord
  function handleLogin() {
    if (password === "Bringeland") {
      setIsLoggedIn(true);
      setError("");
    } else {
      setError("Feil passord. Prøv igjen.");
    }
  }

  // Legg til ansatt
  async function handleAddEmployee() {
    if (!newName || !newPin) {
      setError("Navn og PIN må fylles ut.");
      return;
    }
    try {
      await addDoc(collection(db, "employees"), { name: newName, pin: newPin });
      setNewName("");
      setNewPin("");
      setError("");
      await addLog("admin", `La til ansatt: ${newName}`);
    } catch (e) {
      setError("Kunne ikke legge til ansatt.");
    }
  }

  // Slett ansatt
  async function handleDeleteEmployee(id: string, name: string) {
    try {
      await deleteDoc(doc(db, "employees", id));
      await addLog("admin", `Slettet ansatt: ${name}`);
      setError("");
    } catch (e) {
      setError("Kunne ikke slette ansatt.");
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-100 to-blue-100">
        <div className="bg-white rounded-xl shadow-lg px-8 py-8 flex flex-col items-center w-full max-w-sm">
          <h2 className="text-xl font-extrabold text-center mb-6 text-blue-900">Admin innlogging</h2>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Skriv inn admin-passord"
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
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Adminpanel</h1>
      <div className="flex gap-4 mb-8">
        <button
          className={`px-4 py-2 rounded font-bold ${tab === 'ansatte' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => setTab('ansatte')}
        >
          Ansatte
        </button>
        <button
          className={`px-4 py-2 rounded font-bold ${tab === 'logg' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => setTab('logg')}
        >
          Logg
        </button>
        <button
          className={`px-4 py-2 rounded font-bold ${tab === 'database' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => setTab('database')}
        >
          Database
        </button>
      </div>

      {/* Ansatte-fanen */}
      {tab === 'ansatte' && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Ansatte</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Fullt navn"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="border px-2 py-1 rounded"
            />
            <input
              type="text"
              placeholder="PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="border px-2 py-1 rounded w-24"
            />
            <button
              onClick={handleAddEmployee}
              className="bg-blue-600 text-white px-4 py-1 rounded"
            >
              Legg til
            </button>
          </div>

          <ul className="space-y-2">
            {employees
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((emp) => (
                <li
                  key={emp.id}
                  className="flex items-center justify-between border p-2 rounded"
                >
                  <div>
                    <span className="font-medium">{emp.name}</span> — PIN: <span className="font-mono">{emp.pin}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Slett
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Logg-fanen */}
      {tab === 'logg' && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Logg</h2>
          <div className="flex flex-col gap-3">
            {[...logs]
              .sort((a, b) => {
                const ta = a.timestamp?.seconds ?? 0;
                const tb = b.timestamp?.seconds ?? 0;
                return tb - ta;
              })
              .map((log) => (
              <div
                key={log.id}
                className="bg-gray-900 rounded-lg px-4 py-3 flex flex-col border border-gray-700 shadow"
                style={{ minHeight: 48 }}
              >
                <div className="flex flex-row items-center gap-2 mb-1">
                  <span className="font-bold text-blue-300 text-base">{log.user || 'System'}</span>
                  <span className="text-gray-400 text-xs">{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : "ukjent tid"}</span>
                </div>
                <div className="text-white text-sm" style={{ wordBreak: 'break-word' }}>{log.action}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Database-fanen (placeholder) */}
      {tab === 'database' && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Database</h2>
          <p>Backup og gjenoppretting av fueldepot kommer.</p>
        </section>
      )}
    </div>
  );
}

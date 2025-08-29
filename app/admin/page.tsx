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
  user?: string;
  action: string;
  employeeName?: string;
  timestamp?: { seconds: number; nanoseconds: number };
};

// Backup type
type Backup = {
  id: string;
  createdAt?: { seconds: number; nanoseconds: number };
  depots?: object[];
  users?: object[];
};

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Antall innlogginger siste døgn
  const [recentLoginCount, setRecentLoginCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) return;
    const fetchLogins = async () => {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const { getDocs, query, collection, where } = await import("firebase/firestore");
      // Sjekk at "login" er action for innlogging
      const q = query(
        collection(db, "logs"),
        where("action", "==", "login"),
        where("timestamp", ">", new Date(oneDayAgo))
      );
      const snap = await getDocs(q);
      setRecentLoginCount(snap.size);
    };
    fetchLogins();
  }, [isLoggedIn]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  // Fjernet duplisert isLoggedIn
  useEffect(() => {
    if (!isLoggedIn) return;
    const fetchLogins = async () => {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const { getDocs, query, collection, where } = await import("firebase/firestore");
      // Sjekk at "login" er action for innlogging
      const q = query(
        collection(db, "logs"),
        where("action", "==", "login"),
        where("timestamp", ">", new Date(oneDayAgo))
      );
      const snap = await getDocs(q);
      setRecentLoginCount(snap.size);
    };
    fetchLogins();
  }, [isLoggedIn]);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<'ansatte' | 'logg' | 'database'>('ansatte');
  const [error, setError] = useState<string>("");
  const [currentEmployee, setCurrentEmployee] = useState<{id: string, name: string} | null>(null);

  // Backup UI state
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoreId, setRestoreId] = useState<string|null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string>("");

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

  // Hent backups fra Firestore (siste 3 dager)
  useEffect(() => {
    if (!isLoggedIn || tab !== 'database') return;
    setLoadingBackups(true);
    (async () => {
      const now = Date.now();
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
      const { getDocs } = await import("firebase/firestore");
      const snap = await getDocs(collection(db, "backups"));
      const items = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Backup))
        .filter(b => b.createdAt && typeof b.createdAt.seconds === 'number' && b.createdAt.seconds * 1000 > threeDaysAgo)
        .sort((a, b) => ((b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
      setBackups(items);
      setLoadingBackups(false);
    })();
  }, [isLoggedIn, tab]);

  // Admin passord
  function handleLogin() {
    if (password === "Bringeland") {
      setIsLoggedIn(true);
      setCurrentEmployee({ id: "admin", name: "Admin" });
      setError("");
    } else {
      // Sjekk om det er en ansatt med denne PIN
      const found = employees.find(e => e.pin === password);
      if (found) {
        setIsLoggedIn(true);
        setCurrentEmployee({ id: found.id, name: found.name });
        setError("");
      } else {
        setError("Feil passord eller PIN. Prøv igjen.");
      }
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
      await addLog(`La til ansatt: ${newName}`, currentEmployee?.id, currentEmployee?.name);
    } catch {
      setError("Kunne ikke legge til ansatt.");
    }
  }

  // Slett ansatt
  async function handleDeleteEmployee(id: string, name: string) {
    try {
      await deleteDoc(doc(db, "employees", id));
      await addLog(`Slettet ansatt: ${name}`, currentEmployee?.id, currentEmployee?.name);
      setError("");
    } catch {
      setError("Kunne ikke slette ansatt.");
    }
  }

  // Restore backup
  async function handleRestore(id: string) {
    setRestoreStatus("");
    setShowConfirm(false);
    setRestoreStatus("Gjenoppretter...");
    try {
      const { getDocs } = await import("firebase/firestore");
      // Finn backup
      const backupDoc = backups.find(b => b.id === id);
      if (!backupDoc) throw new Error("Backup ikke funnet");
      // Slett alle depots
      const depotsSnap = await getDocs(collection(db, "depots"));
      await Promise.all(depotsSnap.docs.map(d => deleteDoc(doc(db, "depots", d.id))));
      // Skriv depots fra backup
      await Promise.all((backupDoc.depots ?? []).map(depot => addDoc(collection(db, "depots"), depot)));
      // Slett alle users
      const usersSnap = await getDocs(collection(db, "users"));
      await Promise.all(usersSnap.docs.map(u => deleteDoc(doc(db, "users", u.id))));
      // Skriv users fra backup
      await Promise.all((backupDoc.users ?? []).map(user => addDoc(collection(db, "users"), user)));
      setRestoreStatus("Gjenoppretting fullført ✅");
      await addLog(`Gjenopprettet backup ${id}`, currentEmployee?.id, currentEmployee?.name);
    } catch {
      setRestoreStatus("Feil under gjenoppretting");
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
      <div className="bg-white rounded-xl shadow-lg px-8 py-4 flex flex-col items-center w-full max-w-md mx-auto mt-6 mb-4">
        <h2 className="text-xl font-bold mb-2 text-blue-900">Innlogginger siste døgn</h2>
        <div className="text-3xl font-extrabold text-green-700">{recentLoginCount}</div>
      </div>
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
          <div className="flex flex-col gap-2">
            {[...logs]
              .sort((a, b) => {
                const ta = a.timestamp?.seconds ?? 0;
                const tb = b.timestamp?.seconds ?? 0;
                return tb - ta;
              })
              .map((log) => (
                <div
                  key={log.id}
                  className="bg-gray-900 rounded px-4 py-2 flex flex-row items-center border border-gray-700 shadow text-white text-base"
                  style={{ minHeight: 36, fontWeight: 500 }}
                >
                  <span style={{ color: '#60a5fa', fontWeight: 700, marginRight: 12 }}>{log.employeeName || 'Ukjent'}</span>
                  <span style={{ color: '#cbd5e1', marginRight: 12 }}>{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : "ukjent tid"}</span>
                  <span style={{ wordBreak: 'break-word' }}>{log.action || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Ingen handling</span>}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Database-fanen (placeholder) */}
      {tab === 'database' && (
        <section>
          <h2 className="text-xl font-semibold mb-2">Database backup</h2>
          <p className="mb-4">Her kan du se og gjenopprette backups fra de siste 3 dagene.</p>
          {loadingBackups ? (
            <div>Laster backups...</div>
          ) : backups.length === 0 ? (
            <div>Ingen backups funnet.</div>
          ) : (
            <ul className="space-y-2 mb-4">
              {backups.map(b => (
                <li key={b.id} className="flex items-center justify-between border p-2 rounded">
                  <div>
                    <span className="font-semibold">{b.createdAt && typeof b.createdAt.seconds === 'number' ? new Date(b.createdAt.seconds * 1000).toLocaleString() : 'Ukjent tid'}</span>
                    <span className="ml-2 text-gray-500">({(b.depots?.length ?? 0)} depots, {(b.users?.length ?? 0)} users)</span>
                  </div>
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                    onClick={() => { setRestoreId(b.id); setShowConfirm(true); }}
                  >
                    Gjenopprett
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showConfirm && restoreId && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
                <h3 className="text-lg font-bold mb-4">Bekreft gjenoppretting</h3>
                <p className="mb-4">Er du sikker på at du vil gjenopprette backupen? Dette vil overskrive alle depots og users.</p>
                <div className="flex gap-4">
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                    onClick={() => handleRestore(restoreId)}
                  >
                    Ja, gjenopprett
                  </button>
                  <button
                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded"
                    onClick={() => { setShowConfirm(false); setRestoreId(null); }}
                  >
                    Avbryt
                  </button>
                </div>
                {restoreStatus && <p className="mt-4 font-semibold text-blue-700">{restoreStatus}</p>}
              </div>
            </div>
          )}
          {restoreStatus && !showConfirm && (
            <div className="mt-4 font-semibold text-blue-700">{restoreStatus}</div>
          )}
        </section>
      )}
    </div>
  );
}

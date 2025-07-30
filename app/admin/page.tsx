'use client';

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc
} from "firebase/firestore";

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginPass, setLoginPass] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (loggedIn) {
      loadUsers();
      loadLogs();
    }
  }, [loggedIn]);

  async function loadUsers() {
    const q = query(collection(db, "users"));
    const snap = await getDocs(q);
    setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }

  async function loadLogs() {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }

  async function handleAddUser(e: any) {
    e.preventDefault();
    setMessage("");

    if (!/^\d{4}$/.test(pin)) {
      setMessage("PIN må være 4 tall.");
      return;
    }

    const q = query(collection(db, "users"), where("pin", "==", pin));
    const snap = await getDocs(q);
    if (!snap.empty) {
      setMessage("Denne PIN-koden er allerede i bruk!");
      return;
    }

    await addDoc(collection(db, "users"), {
      name,
      pin,
      createdAt: serverTimestamp(),
    });

    setName("");
    setPin("");
    setMessage("Bruker lagt til!");
    loadUsers();
  }

  async function handleDeleteUser(id: string) {
    await deleteDoc(doc(db, "users", id));
    loadUsers();
  }

  function handleLogin(e: any) {
    e.preventDefault();
    if (loginPass === ADMIN_PASS) {
      setLoggedIn(true);
      setLoginPass("");
    } else {
      setMessage("Feil admin-passord.");
    }
  }

  if (!loggedIn) {
    return (
      <form onSubmit={handleLogin} className="flex flex-col items-center justify-center min-h-screen gap-4 bg-black">
        <div className="text-2xl font-bold mb-2 text-gray-900">Admin Login</div>
        <input
          type="password"
          placeholder="Admin-passord"
          className="border p-2 rounded text-xl text-gray-900"
          value={loginPass}
          onChange={e => setLoginPass(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-6 py-2 rounded text-lg">Logg inn</button>
        {message && <div className="text-red-600">{message}</div>}
      </form>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white p-6 rounded shadow text-lg text-gray-900">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Legg til ansatt</h2>
      <form onSubmit={handleAddUser} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Fullt navn"
          className="border p-2 rounded w-1/2 text-gray-900"
          value={name}
          required
          onChange={e => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="PIN (4 siffer)"
          className="border p-2 rounded w-1/3 text-gray-900"
          value={pin}
          required
          maxLength={4}
          onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <button className="bg-green-600 text-white px-5 py-2 rounded">Legg til</button>
      </form>
      {message && <div className="text-green-600 mb-4">{message}</div>}

      <h3 className="font-bold text-xl mb-3 text-gray-900">Alle ansatte:</h3>
      <table className="w-full text-base mb-8 text-gray-900">
        <thead>
          <tr>
            <th className="text-left text-gray-900">Navn</th>
            <th className="text-gray-900">PIN</th>
            <th className="text-gray-900">Registrert</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} className="border-b last:border-b-0">
              <td className="text-gray-900">{user.name}</td>
              <td className="text-center text-gray-900">{user.pin}</td>
              <td className="text-gray-900">{user.createdAt?.toDate?.().toLocaleString?.() ?? ""}</td>
              <td>
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  className="bg-red-500 text-white text-xs px-2 py-1 rounded"
                >
                  Slett
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        className="bg-blue-500 text-white px-6 py-2 rounded font-bold mb-4"
        onClick={() => { setShowLogs(!showLogs); if (!showLogs) loadLogs(); }}
      >
        {showLogs ? "Skjul logg" : "Vis logg"}
      </button>

      {showLogs && (
        <div className="bg-gray-50 mt-4 rounded p-3 max-h-96 overflow-auto">
          <h3 className="font-bold mb-2 text-lg text-gray-900">Logg (siste hendelser)</h3>
          <table className="w-full text-sm text-gray-900">
            <thead>
              <tr>
                <th className="text-gray-900">Navn</th>
                <th className="text-gray-900">Handling</th>
                <th className="text-gray-900">Detaljer</th>
                <th className="text-gray-900">Tidspunkt</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b last:border-b-0">
                  <td className="text-gray-900">{log.name}</td>
                  <td className="text-gray-900">{log.action}</td>
                  <td className="text-gray-900">{log.details}</td>
                  <td className="text-gray-900">{log.timestamp?.toDate?.().toLocaleString?.() ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="text-gray-500 mt-2">Ingen logger funnet.</div>}
        </div>
      )}
    </div>
  );
}

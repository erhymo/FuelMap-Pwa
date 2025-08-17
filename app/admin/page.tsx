 

'use client';

import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
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

  // Hent ansatte
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "employees"), (snapshot) => {
      setEmployees(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Employee, "id">),
        }))
      );
    });
    return () => unsub();
  }, []);

  // Hent logg
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "logs"), (snapshot) => {
      setLogs(
        snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<LogEntry, "id">),
          }))
          .sort(
            (a, b) =>
              (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0)
          )
      );
    });
    return () => unsub();
  }, []);

  // Legg til ansatt
  const handleAddEmployee = async () => {
    if (!newName || !newPin) return;
    await addDoc(collection(db, "employees"), {
      name: newName,
      pin: newPin,
    });
    await addLog("Admin", `La til ansatt: ${newName} (PIN: ${newPin})`);
    setNewName("");
    setNewPin("");
  };

  // Slett ansatt
  const handleDeleteEmployee = async (id: string, name: string) => {
    await deleteDoc(doc(db, "employees", id));
    await addLog("Admin", `Slettet ansatt: ${name}`);
  };

  // Oppdater ansatt
  const handleUpdateEmployee = async (
    id: string,
    name: string,
    pin: string
  ) => {
    await updateDoc(doc(db, "employees", id), { name, pin });
    await addLog("Admin", `Oppdaterte ansatt: ${name} (PIN: ${pin})`);
  };

  return (
    <div className="p-6 space-y-10">
      <h1 className="text-3xl font-bold mb-4">Adminpanel</h1>

      {/* Ansatte */}
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
          {employees.map((emp) => (
            <li
              key={emp.id}
              className="flex items-center justify-between border p-2 rounded"
            >
              <div>
                <span className="font-medium">{emp.name}</span> — PIN:{" "}
                <span className="font-mono">{emp.pin}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleUpdateEmployee(emp.id, emp.name, emp.pin)
                  }
                  className="bg-yellow-500 text-white px-3 py-1 rounded"
                >
                  Oppdater
                </button>
                <button
                  onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Slett
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Logg */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Logg</h2>
        <ul className="space-y-1">
          {logs.map((log) => (
            <li
              key={log.id}
              className="text-sm border-b py-1"
            >
              <span className="font-medium">{log.user}</span>:{" "}
              {log.action}{" "}
              <span className="text-gray-500">
                (
                {log.timestamp
                  ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                  : "ukjent tid"}
                )
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

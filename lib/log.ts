// lib/log.ts
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function addLog(action: string, employeeId?: string, employeeName?: string) {
  try {
    await addDoc(collection(db, "logs"), {
      action,
      employeeId: employeeId || null,
      employeeName: employeeName || null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Kunne ikke lagre logg:", err);
  }
}

// lib/log.ts
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function addLog(message: string, employeeId?: string) {
  try {
    await addDoc(collection(db, "logs"), {
      message,
      employeeId: employeeId || null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Kunne ikke lagre logg:", err);
  }
}

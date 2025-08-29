import { onSchedule } from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// 📌 Cron-jobb: backup hver 6. time
export const scheduledBackup = onSchedule(
  {
    schedule: "0 */6 * * *", // hver 6. time
    timeZone: "Europe/Oslo",
  },
  async () => {
    console.log("Kjører automatisk backup...");
    try {
      const usersSnap = await db.collection("users").get();
      const depotsSnap = await db.collection("depots").get();
      const users = [];
      usersSnap.forEach((doc) => users.push({ id: doc.id, ...doc.data() }));
      const depots = [];
      depotsSnap.forEach((doc) => depots.push({ id: doc.id, ...doc.data() }));
      await db.collection("backups").add({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        users,
        depots,
      });
      console.log("Backup lagret ✅");
      return null;
    } catch (error) {
      console.error("Backup feilet:", error);
      return null;
    }
  }
);

// 📌 Cron-jobb: slett logger eldre enn 60 dager
export const cleanOldLogs = onSchedule(
  {
    schedule: "0 3 * * *", // hver dag kl 03:00
    timeZone: "Europe/Oslo",
  },
  async () => {
    console.log("Sletter gamle logger...");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60); // 60 dager tilbake
    const oldLogs = await db
      .collection("logs")
      .where("timestamp", "<", cutoff)
      .get();
    const batch = db.batch();
    oldLogs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Slettet ${oldLogs.size} gamle logger ✅`);
    return null;
  }
);

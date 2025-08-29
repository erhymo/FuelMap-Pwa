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
      // Hent alle brukere
      const usersSnap = await db.collection("users").get();
      const users = [];
      usersSnap.forEach((doc) => users.push({ id: doc.id, ...doc.data() }));

      // Hent alle depots
      const depotsSnap = await db.collection("depots").get();
      const depots = [];
      depotsSnap.forEach((doc) => depots.push({ id: doc.id, ...doc.data() }));

      // Hent alle base
      const baseSnap = await db.collection("base").get();
      const base = [];
      baseSnap.forEach((doc) => base.push({ id: doc.id, ...doc.data() }));

      // Hent alle fueldepots
      const fueldepotsSnap = await db.collection("fueldepots").get();
      const fueldepots = [];
      fueldepotsSnap.forEach((doc) => fueldepots.push({ id: doc.id, ...doc.data() }));

      // Hent alle helipad
      const helipadSnap = await db.collection("helipad").get();
      const helipad = [];
      helipadSnap.forEach((doc) => helipad.push({ id: doc.id, ...doc.data() }));

      await db.collection("backups").add({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        users,
        depots,
        base,
        fueldepots,
        helipad,
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

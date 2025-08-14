// app/firebase/index.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Bruk dine egne Firebase config-verdier her
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialiser appen (kun én gang)
const app = initializeApp(firebaseConfig);

// Eksporter Firestore-databasen
export const db = getFirestore(app);

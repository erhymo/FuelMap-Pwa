"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/app/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";

export default function AdminPage() {
  const [depots, setDepots] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [type, setType] = useState("fueldepot");

  // Hent depots fra Firestore
  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "depots"));
      setDepots(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  // Legg til depot
  const addDepot = async () => {
    if (!name || !lat || !lng) return alert("Fyll inn alle felt!");
    await addDoc(collection(db, "depots"), {
      name,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      type,
      full: 0,
      empty: 0,
    });
    setName("");
    setLat("");
    setLng("");
    setType("fueldepot");
    alert("Depot lagt til!");
  };

  // Slett depot
  const removeDepot = async (id: string) => {
    if (confirm("Sikker på at du vil slette?")) {
      await deleteDoc(doc(db, "depots", id));
      setDepots((prev) => prev.filter((d) => d.id !== id));
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Admin-panel</h1>

      {/* Nytt depot */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="font-semibold mb-2">Legg til nytt depot</h2>
        <input
          type="text"
          placeholder="Navn"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 mr-2"
        />
        <input
          type="text"
          placeholder="Lat"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="border p-2 mr-2"
        />
        <input
          type="text"
          placeholder="Lng"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          className="border p-2 mr-2"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border p-2 mr-2"
        >
          <option value="fueldepot">Fueldepot</option>
          <option value="base">Base</option>
          <option value="helipad">Helipad</option>
        </select>
        <button
          onClick={addDepot}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Legg til
        </button>
      </div>

      {/* Liste over depots */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Eksisterende depots</h2>
        <ul>
          {depots.map((depot) => (
            <li key={depot.id} className="flex justify-between border-b py-2">
              <span>{depot.name}</span>
              <button
                onClick={() => removeDepot(depot.id)}
                className="text-red-600"
              >
                Slett
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

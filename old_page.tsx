"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { db } from "../firebase"; // ✅ Riktig import
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { IoTrash, IoChevronDown, IoChevronUp } from "react-icons/io5";

// --- Ikoner ---
const baseIcon = new L.Icon({
  iconUrl: "/Airlift-logo.png",
  iconSize: [32, 32],
});

const fuelDepotGreen = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  iconSize: [32, 32],
});

const fuelDepotRed = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  iconSize: [32, 32],
});

const helipadBlue = new L.Icon({
  iconUrl: "/helipadIcon.svg",
  iconSize: [32, 32],
});

// --- Zoom & Pan helper ---
function FlyToLocation({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 17);
    }
  }, [position, map]);
  return null;
}

export default function DashboardPage() {
  const [depots, setDepots] = useState<any[]>([]);
  const [selectedDepot, setSelectedDepot] = useState<any>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [collapsed, setCollapsed] = useState<{ utstyr: boolean; notat: boolean }>({
    utstyr: true,
    notat: true,
  });

  // --- Hent data fra Firestore ---
  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "depots"));
      setDepots(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  // --- Lagre depot ---
  const saveDepot = async (depotId: string, updatedData: any) => {
    await updateDoc(doc(db, "depots", depotId), updatedData);
    setDepots((prev) =>
      prev.map((d) => (d.id === depotId ? { ...d, ...updatedData } : d))
    );
  };

  // --- Slett depot ---
  const deleteDepot = async (depotId: string) => {
    if (confirm("Er du sikker på at du vil slette dette depotet?")) {
      await deleteDoc(doc(db, "depots", depotId));
      setDepots((prev) => prev.filter((d) => d.id !== depotId));
      setSelectedDepot(null);
    }
  };

  // --- Minusknapp: Flytter fra fulle til tomme fat ---
  const handleMinusFull = (depot: any) => {
    if (depot.full > 0) {
      const updatedDepot = {
        ...depot,
        full: depot.full - 1,
        empty: depot.empty + 1,
      };
      saveDepot(depot.id, updatedDepot);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white p-2 overflow-y-auto">
        {depots.map((depot) => (
          <div
            key={depot.id}
            className="flex items-center justify-between p-2 border-b border-gray-700 cursor-pointer hover:bg-gray-800"
            onClick={() => setFlyTo([depot.lat, depot.lng])}
          >
            <div className="flex items-center gap-2">
              {depot.type === "base" && (
                <img src="/Airlift-logo.png" alt="Base" className="w-6 h-6" />
              )}
              {depot.type === "fueldepot" && (
                <span style={{ color: depot.full <= 2 ? "red" : "green" }}>⛽</span>
              )}
              {depot.type === "helipad" && (
                <img src="/helipadIcon.svg" alt="Helipad" className="w-6 h-6" />
              )}
              <span>{depot.name}</span>
            </div>
            {depot.type === "fueldepot" && (
              <span style={{ color: depot.full <= 2 ? "red" : "green" }}>
                {depot.full}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Kart */}
      <div className="flex-1">
        <MapContainer
          center={[60.472, 8.4689]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FlyToLocation position={flyTo} />

          {depots.map((depot) => {
            let icon = baseIcon;
            if (depot.type === "fueldepot") {
              icon = depot.full <= 2 ? fuelDepotRed : fuelDepotGreen;
            } else if (depot.type === "helipad") {
              icon = helipadBlue;
            }
            return (
              <Marker
                key={depot.id}
                position={[depot.lat, depot.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => setSelectedDepot(depot),
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Popup panel */}
      {selectedDepot && (
        <div className="absolute right-0 top-0 w-80 h-full bg-white shadow-lg p-4 overflow-hidden">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-lg font-bold">{selectedDepot.name}</h2>
            <button onClick={() => deleteDepot(selectedDepot.id)} className="text-red-600">
              <IoTrash size={24} />
            </button>
          </div>

          {selectedDepot.type === "fueldepot" && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span>Fulle fat:</span>
                <div className="flex items-center gap-2">
                  <span>{selectedDepot.full}</span>
                  <button
                    onClick={() => handleMinusFull(selectedDepot)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    -
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Tomme fat:</span>
                <span>{selectedDepot.empty}</span>
              </div>
            </div>
          )}

          {/* Collapse Utstyr */}
          <div className="mt-4 border-t pt-2">
            <button
              onClick={() => setCollapsed((c) => ({ ...c, utstyr: !c.utstyr }))}
              className="flex items-center gap-2"
            >
              Utstyr {collapsed.utstyr ? <IoChevronDown /> : <IoChevronUp />}
            </button>
            {!collapsed.utstyr && (
              <ul className="list-disc ml-4 mt-2">
                {selectedDepot.equipment?.map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Collapse Notat */}
          <div className="mt-4 border-t pt-2">
            <button
              onClick={() => setCollapsed((c) => ({ ...c, notat: !c.notat }))}
              className="flex items-center gap-2"
            >
              Notat {collapsed.notat ? <IoChevronDown /> : <IoChevronUp />}
            </button>
            {!collapsed.notat && <p className="mt-2">{selectedDepot.note}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

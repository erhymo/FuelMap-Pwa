import { Depot, withDepotDefaults, DepotType } from "@/lib/types";
/* eslint-disable */

// components/DashboardContent.tsx
"use client";

import React, { useState, useEffect } from "react";
import { GoogleMap, MarkerF, useLoadScript } from "@react-google-maps/api";
import DepotPopup from "./dashboard/DepotPopup";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addLog } from "@/lib/log";

type DashboardContentProps = {
  employeeId: string;
};

const DashboardContent: React.FC<DashboardContentProps> = ({ employeeId }) => {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const [depots, setDepots] = useState<Depot[]>([]);
  const [selectedDepot, setSelectedDepot] = useState<Depot | null>(null);

  // Hent depoter fra Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "depots"), (snapshot) => {
      const list: Depot[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Depot, "id">),
      }));
      setDepots(list);
    });
    return () => unsub();
  }, []);

  // Opprett nytt depot
  const addDepot = async (type: DepotType, position: google.maps.LatLngLiteral) => {
    const docRef = await addDoc(collection(db, "depots"), {
      type,
      position,
      full: 0,
      empty: 0,
      fuelTrailer: 0,
      fuelTank: 0,
      equipment: "",
    });
    await addLog(employeeId, `Opprettet depot ${docRef.id} (${type})`);
  };

  // Slett depot
  const removeDepot = async (id: string) => {
    await deleteDoc(doc(db, "depots", id));
    await addLog(employeeId, `Slettet depot ${id}`);
    setSelectedDepot(null);
  };

  // Oppdater depot
  const updateDepot = async (id: string, data: Partial<Depot>) => {
    await updateDoc(doc(db, "depots", id), data);
    await addLog(employeeId, `Oppdaterte depot ${id}`);
  };

  if (!isLoaded) return <p>Laster kart...</p>;

  return (
    <div className="w-full h-full">
      <GoogleMap
        zoom={6}
        center={{ lat: 60.472, lng: 8.4689 }} // Norge som default
        mapContainerClassName="w-full h-full"
        onClick={(e) => {
          if (!e.latLng) return;
          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          // Default til fueldepot ved klikk
          addDepot("fueldepot", pos);
        }}
      >
        {depots.map((depot) => (
          <MarkerF
            key={depot.id}
            position={{ lat: depot.lat, lng: depot.lng }}
            onClick={() => setSelectedDepot(depot)}
            icon={{
              url:
                depot.type === "base"
                  ? "/icons/helipad.png"
                  : depot.full ?? 0 <= 2
                  ? "/icons/fuel-red.png"
                  : "/icons/fuel-green.png",
              scaledSize: new google.maps.Size(40, 40),
            }}
          />
        ))}

        {selectedDepot && (
          <DepotPopup
            depot={selectedDepot}
            onClose={() => setSelectedDepot(null)}
            onDelete={removeDepot}
            onUpdate={updateDepot}
          />
        )}
      </GoogleMap>
    </div>
  );
};

export default DashboardContent;

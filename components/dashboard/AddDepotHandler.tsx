import { useState } from "react";
import { Pin } from "@/lib/types";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useAddDepot(pins: Pin[], setPins: (pins: Pin[]) => void) {
  const [addDepotMode, setAddDepotMode] = useState(false);

  function startAddDepot() {
    setAddDepotMode(true);
  }

  function handleMapClick(e: google.maps.MapMouseEvent, setSelected: (pin: Pin) => void, setEditMode: (v: boolean) => void, setEditValues: (v: Partial<Pin>) => void) {
    if (addDepotMode && e.latLng) {
      setSelected({
        id: "ny",
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        name: "",
        type: "base",
        fullBarrels: 0,
        emptyBarrels: 0,
        tank: 0,
        trailer: 0,
        equipment: [],
        images: [],
        createdAt: Date.now(),
        editing: true,
      });
      setEditMode(true);
      setEditValues({ name: "", type: "base" });
      setAddDepotMode(false);
    } else {
      setSelected(null);
    }
  }

  async function handleManualEdit(pin: Pin, setSelected: (pin: Pin|null) => void, setEditMode: (v: boolean) => void, setEditValues: (v: Partial<Pin>) => void) {
    if (pin.id === "ny") {
      const docRef = await addDoc(collection(db, "depots"), {
        name: pin.name,
        type: pin.type,
        lat: pin.lat,
        lng: pin.lng,
        fullBarrels: pin.fullBarrels,
        emptyBarrels: pin.emptyBarrels,
        tank: pin.tank,
        trailer: pin.trailer,
        equipment: pin.equipment,
        images: pin.images,
        createdAt: Date.now(),
      });
      setPins([
        ...pins,
        { ...pin, id: docRef.id },
      ]);
      setSelected(null);
      setEditMode(false);
      setEditValues({});
    } else {
      setEditMode(false);
      setSelected(pin);
      setEditValues({});
    }
  }

  return { addDepotMode, startAddDepot, handleMapClick, handleManualEdit };
}

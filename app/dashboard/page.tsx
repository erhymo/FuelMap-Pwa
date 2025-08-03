'use client';

import { useEffect, useState, useRef } from "react";
import {
  GoogleMap,
  MarkerF,
  InfoWindowF,
  useLoadScript,
} from "@react-google-maps/api";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface Pin {
  id: string;
  lat: number;
  lng: number;
  type: "base" | "fueldepot";
  name: string;
  note?: string;
  fullBarrels: number;
  emptyBarrels: number;
  tank: number;
  trailer: number;
  equipment: string;
  images?: string[];
  createdAt?: any;
}

const center = { lat: 60.472, lng: 8.4689 };
const mapContainerStyle = { width: "100%", height: "100vh" };

export default function Dashboard() {
  const router = useRouter();
  useEffect(() => {
    const session = localStorage.getItem("fuelmap_session");
    if (!session) router.push("/login");
    else {
      const { expires } = JSON.parse(session);
      if (Date.now() > expires) {
        localStorage.removeItem("fuelmap_session");
        router.push("/login");
      }
    }
  }, [router]);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const [addMode, setAddMode] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [selected, setSelected] = useState<(Pin & { editing?: boolean }) | null>(null);
  const [newType, setNewType] = useState<"base" | "fueldepot">("base");
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editValues, setEditValues] = useState<Partial<Pin>>({});
  const [editMode, setEditMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pins"), (snapshot) => {
      const pinData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Pin, "id">),
      }));
      setPins(pinData);
    });
    return () => unsub();
  }, []);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && addMode) {
      setSelected({
        id: "",
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        type: "base",
        name: "",
        note: "",
        fullBarrels: 0,
        emptyBarrels: 0,
        tank: 0,
        trailer: 0,
        equipment: "",
        images: [],
        editing: true,
      });
      setNewType("base");
      setNewName("");
      setNewNote("");
      setAddMode(false);
    } else {
      setSelected(null);
    }
  };

  const saveNewPin = async () => {
    await addDoc(collection(db, "pins"), {
      lat: Number(selected?.lat),
      lng: Number(selected?.lng),
      type: newType,
      name: newName,
      note: newNote,
      createdAt: serverTimestamp(),
      fullBarrels: 0,
      emptyBarrels: 0,
      tank: 0,
      trailer: 0,
      equipment: "",
      images: [],
    });
    setSelected(null);
  };

  const deletePin = async (pin: Pin) => {
    await deleteDoc(doc(db, "pins", pin.id));
    setSelected(null);
  };

  // PLUSS/MINUS LOGIKK FOR FAT
  const adjustBarrels = async (
    pin: Pin,
    field: "fullBarrels" | "emptyBarrels",
    delta: number
  ) => {
    let full = Number(
      editMode && typeof editValues.fullBarrels === "number"
        ? editValues.fullBarrels
        : pin.fullBarrels || 0
    );
    let empty = Number(
      editMode && typeof editValues.emptyBarrels === "number"
        ? editValues.emptyBarrels
        : pin.emptyBarrels || 0
    );

    if (field === "fullBarrels") {
      full += delta;
      empty -= delta;
    } else {
      empty += delta;
      full -= delta;
    }
    // Unngå negative verdier
    if (full < 0) full = 0;
    if (empty < 0) empty = 0;

    if (editMode) {
      setEditValues({
        ...editValues,
        fullBarrels: full,
        emptyBarrels: empty,
      });
    } else {
      await updateDoc(doc(db, "pins", pin.id), {
        fullBarrels: full,
        emptyBarrels: empty,
      });
      // Oppdater state for å vise korrekt umiddelbart
      setSelected({
        ...pin,
        fullBarrels: full,
        emptyBarrels: empty,
      });
    }
  };

  // Endre antall fat direkte i edit
  const handleEditValue = (field: keyof Pin, value: string | number) => {
    setEditValues((prev) => ({
      ...prev,
      [field]: typeof value === "string" ? value.replace(/\D/g, "") : value,
    }));
  };

  // For tekstfelter
  const handleEditText = (field: keyof Pin, value: string) => {
    setEditValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleManualEdit = async (pin: Pin) => {
    const updateData: any = {};
    for (const field in editValues) {
      let value = (editValues as any)[field];
      // Gjør om til tall for numeric felter
      if (["fullBarrels", "emptyBarrels", "trailer", "tank"].includes(field)) {
        value = Number(value);
        if (isNaN(value)) continue;
      }
      updateData[field] = value;
    }
    if (Object.keys(updateData).length) {
      await updateDoc(doc(db, "pins", pin.id), updateData);
    }
    setEditValues({});
    setEditMode(false);
    const updatedPin = (await getDoc(doc(db, "pins", pin.id))).data();
    if (updatedPin)
      setSelected({ id: pin.id, ...(updatedPin as Omit<Pin, "id">) });
  };

  const flyTo = (pin: Pin) => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat: Number(pin.lat), lng: Number(pin.lng) });
      mapRef.current.setZoom(13);
      setSelected(pin);
      setDropdownOpen(false);
    }
  };

  const startEdit = (pin: Pin) => {
    setEditMode(true);
    setEditValues({
      fullBarrels: pin.fullBarrels,
      emptyBarrels: pin.emptyBarrels,
      trailer: pin.trailer,
      tank: pin.tank,
      equipment: pin.equipment,
    });
  };

  if (!isLoaded) return <p>Laster kart...</p>;

  return (
    <div className="relative w-full h-screen">
      {/* DEPOTDROPDOWN */}
      <div className="absolute z-20 left-4 top-4">
        <button
          className="bg-white rounded-full shadow p-3 mb-2 text-3xl font-bold"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >☰</button>
        {dropdownOpen && (
          <div className="bg-white shadow-lg rounded-lg p-4 max-h-96 w-72 overflow-y-auto mt-2">
            <div className="mb-2 text-2xl font-bold">Alle depoter:</div>
            {pins
              .filter((p) => p.type === "fueldepot")
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((pin) => (
                <div
                  key={pin.id}
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-green-100 cursor-pointer"
                  onClick={() => flyTo(pin)}
                >
                  <span className="font-semibold text-lg">{pin.name}</span>
                  <div className="ml-auto flex flex-col items-center">
                    <span className="flex gap-6">
                      <span className="flex flex-col items-center mr-2">
                        <span className="text-green-600 text-xs font-bold border-b-2 border-green-500 mb-[-4px]">F</span>
                        <span className="text-xl">{pin.fullBarrels}</span>
                      </span>
                      <span className="flex flex-col items-center">
                        <span className="text-red-600 text-xs font-bold border-b-2 border-red-500 mb-[-4px]">T</span>
                        <span className="text-xl">{pin.emptyBarrels}</span>
                      </span>
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
        {/* Nytt depot */}
        <button
          className="bg-green-500 text-white rounded-full shadow p-4 text-4xl mt-3"
          onClick={() => setAddMode(true)}
          title="Legg til nytt depot"
        >+</button>
      </div>
      {/* KART */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={6}
        onClick={handleMapClick}
        onLoad={(map) => { mapRef.current = map; }}
      >
        {pins.map((pin) => (
          <MarkerF
            key={pin.id}
            position={{ lat: Number(pin.lat), lng: Number(pin.lng) }}
            onClick={() => setSelected(pin)}
            icon={{
              url:
                pin.type === "base"
                  ? "https://maps.google.com/mapfiles/kml/shapes/heliport.png"
                  : pin.fullBarrels > 2
                    ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
              scaledSize: new google.maps.Size(48, 48),
            }}
          />
        ))}

        {/* --- Nytt punkt --- */}
        {selected?.editing && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="p-3 text-2xl w-[95vw] max-w-[440px]">
              <div className="mb-2 font-bold">Nytt punkt</div>
              <div>
                <label>
                  Type:{" "}
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as "base" | "fueldepot")}
                    className="text-xl p-2 border"
                  >
                    <option value="base">Base</option>
                    <option value="fueldepot">Fueldepot</option>
                  </select>
                </label>
              </div>
              <div className="mt-2">
                Navn:{" "}
                <input
                  className="border p-2 text-xl"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="mt-2">
                Notat:{" "}
                <input
                  className="border p-2 text-xl"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
              </div>
              <button
                onClick={saveNewPin}
                className="mt-4 bg-green-600 text-white px-6 py-2 rounded text-2xl"
              >
                Lagre
              </button>
            </div>
          </InfoWindowF>
        )}

        {/* --- INFOWINDOW FOR DEPOT --- */}
        {selected && !selected.editing && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
            options={{
              maxWidth: 440,
              pixelOffset: new window.google.maps.Size(0, -10),
              // disables automatic resizing on mobile
              disableAutoPan: false,
            }}
          >
            <div className="p-6 pt-5 w-[95vw] max-w-[440px] rounded-xl shadow-lg relative overflow-visible" style={{ maxHeight: '92vh', minHeight: 300, display: "flex", flexDirection: "column" }}>
              <div className="flex items-start justify-between mb-1">
                <span className="font-bold text-4xl">{selected.name || "Uten navn"}</span>
                <button
                  onClick={() => editMode ? setEditMode(false) : startEdit(selected)}
                  className="text-2xl ml-3 bg-blue-600 hover:bg-blue-700 text-white px-7 py-2 rounded-lg font-bold"
                >
                  {editMode ? "Avslutt" : "Edit"}
                </button>
              </div>

              {/* EDIT-MODUS */}
              {editMode ? (
                <div className="w-full flex flex-col gap-4 mt-3 mb-2">
                  <div className="flex justify-around items-end">
                    <div className="flex flex-col items-center">
                      <span className="text-green-600 text-xl font-bold mb-1">Fulle</span>
                      <div className="flex items-center gap-2">
                        <input
                          className="border text-2xl p-1 w-20 text-center"
                          type="number"
                          value={editValues.fullBarrels ?? selected.fullBarrels}
                          onChange={(e) =>
                            handleEditValue("fullBarrels", Number(e.target.value))
                          }
                        />
                        <button
                          onClick={() => adjustBarrels(selected, "fullBarrels", 1)}
                          className="bg-green-500 text-white text-3xl rounded-full w-12 h-12 flex items-center justify-center"
                        >+</button>
                        <button
                          onClick={() => adjustBarrels(selected, "fullBarrels", -1)}
                          className="bg-red-500 text-white text-3xl rounded-full w-12 h-12 flex items-center justify-center"
                        >–</button>
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-red-600 text-xl font-bold mb-1">Tomme</span>
                      <div className="flex items-center gap-2">
                        <input
                          className="border text-2xl p-1 w-20 text-center"
                          type="number"
                          value={editValues.emptyBarrels ?? selected.emptyBarrels}
                          onChange={(e) =>
                            handleEditValue("emptyBarrels", Number(e.target.value))
                          }
                        />
                        <button
                          onClick={() => adjustBarrels(selected, "emptyBarrels", 1)}
                          className="bg-green-500 text-white text-3xl rounded-full w-12 h-12 flex items-center justify-center"
                        >+</button>
                        <button
                          onClick={() => adjustBarrels(selected, "emptyBarrels", -1)}
                          className="bg-red-500 text-white text-3xl rounded-full w-12 h-12 flex items-center justify-center"
                        >–</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <span>Fuelhenger:</span>
                    <input
                      className="border text-2xl p-1 w-28 text-center"
                      type="number"
                      value={editValues.trailer ?? selected.trailer}
                      onChange={(e) =>
                        handleEditValue("trailer", Number(e.target.value))
                      }
                    />
                    <span className="ml-1">liter</span>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <span>Fueltank:</span>
                    <input
                      className="border text-2xl p-1 w-32 text-center"
                      type="number"
                      value={editValues.tank ?? selected.tank}
                      onChange={(e) =>
                        handleEditValue("tank", Number(e.target.value))
                      }
                    />
                    <span className="ml-1">liter</span>
                  </div>
                  <div className="flex flex-row items-start gap-2">
                    <span className="mt-2">Utstyr:</span>
                    <textarea
                      rows={2}
                      className="border text-2xl w-full"
                      value={editValues.equipment ?? selected.equipment}
                      onChange={(e) =>
                        handleEditText("equipment", e.target.value)
                      }
                    />
                  </div>
                  <button
                    onClick={() => handleManualEdit(selected)}
                    className="w-full mt-1 bg-green-600 text-white px-6 py-3 rounded text-3xl font-bold"
                  >
                    Lagre
                  </button>
                </div>
              ) : (
                <>
                  {/* VISNINGSMODUS */}
                  <div className="flex justify-around items-center mt-5 mb-3">
                    <div className="flex flex-col items-center">
                      <span className="text-green-600 text-xl font-bold mb-1">Fulle</span>
                      <span className="text-3xl">{selected.fullBarrels}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-red-600 text-xl font-bold mb-1">Tomme</span>
                      <span className="text-3xl">{selected.emptyBarrels}</span>
                    </div>
                  </div>
                  <div className="text
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
    });
    setSelected(null);
  };

  const deletePin = async (pin: Pin) => {
    await deleteDoc(doc(db, "pins", pin.id));
    setSelected(null);
  };

  // --- Juster logikk for fat ---
  const adjustBarrels = async (
    pin: Pin,
    field: "fullBarrels" | "emptyBarrels",
    delta: number
  ) => {
    let full = pin.fullBarrels || 0;
    let empty = pin.emptyBarrels || 0;
    if (field === "fullBarrels") {
      if (delta > 0 && empty > 0) {
        full++;
        empty--;
      } else if (delta < 0 && full > 0) {
        full--;
        empty++;
      }
    }
    if (field === "emptyBarrels") {
      if (delta > 0 && full > 0) {
        empty++;
        full--;
      } else if (delta < 0 && empty > 0) {
        empty--;
        full++;
      }
    }
    await updateDoc(doc(db, "pins", pin.id), {
      fullBarrels: full,
      emptyBarrels: empty,
    });
    // Oppdater visning umiddelbart
    setSelected({ ...pin, fullBarrels: full, emptyBarrels: empty });
  };

  const handleManualEdit = async (pin: Pin) => {
    const updateData: any = {};
    for (const field in editValues) {
      let value = (editValues as any)[field];
      if (field === "equipment") {
        // Tekst
      } else {
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
    if (updatedPin) setSelected({ id: pin.id, ...(updatedPin as Omit<Pin, "id">) });
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

  // ----- RENDER -----
  if (!isLoaded) return <p>Laster kart...</p>;

  return (
    <div className="relative w-full h-screen">
      {/* --- DEPOTDROPDOWN --- */}
      <div className="absolute z-20 left-4 top-4">
        <button
          className="bg-white rounded-full shadow p-3 mb-2 text-3xl font-bold"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >☰</button>
        {dropdownOpen && (
          <div className="bg-white shadow-lg rounded-xl p-4 max-h-[80vh] w-72 overflow-y-auto mt-2 text-black">
            <div className="mb-3 text-2xl font-bold">Alle depoter:</div>
            {pins
              .filter((p) => p.type === "fueldepot")
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((pin) => (
                <div
                  key={pin.id}
                  className="flex items-center gap-2 px-2 py-3 rounded hover:bg-green-100 cursor-pointer"
                  onClick={() => flyTo(pin)}
                >
                  <span className="font-semibold text-xl w-32 truncate">{pin.name}</span>
                  <div className="flex flex-col items-center w-12">
                    <span className="font-bold text-green-700 text-lg">F</span>
                    <span className="text-xl font-bold border-b-4 border-green-500">{pin.fullBarrels}</span>
                  </div>
                  <div className="flex flex-col items-center w-12 ml-1">
                    <span className="font-bold text-red-700 text-lg">T</span>
                    <span className="text-xl font-bold border-b-4 border-red-500">{pin.emptyBarrels}</span>
                  </div>
                </div>
              ))}
            <button
              className="bg-green-500 text-white rounded-full shadow p-4 text-4xl mt-3"
              onClick={() => setAddMode(true)}
              title="Legg til nytt depot"
            >+</button>
          </div>
        )}
      </div>

      {/* --- KART --- */}
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
            <div className="p-3 text-xl w-[340px] max-w-full">
              <div className="mb-2 font-bold text-2xl">Nytt punkt</div>
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

        {/* --- INFOBOBLE FOR DEPOT --- */}
        {selected && !selected.editing && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
          >
            <div
              className="flex flex-col justify-between w-[360px] max-w-full p-6 bg-white rounded-2xl text-black"
              style={{ minHeight: 360, maxHeight: 420, overflow: "visible" }}
            >
              <div className="flex flex-row justify-between items-center mb-2">
                <span className="font-bold text-3xl">{selected.name || "Uten navn"}</span>
                {!editMode && (
                  <button
                    onClick={() => startEdit(selected)}
                    className="bg-blue-600 text-white px-6 py-2 rounded text-xl font-bold ml-4"
                  >
                    Edit
                  </button>
                )}
                {editMode && (
                  <button
                    onClick={() => setEditMode(false)}
                    className="bg-blue-600 text-white px-6 py-2 rounded text-xl font-bold ml-4"
                  >
                    Avslutt
                  </button>
                )}
              </div>
              {/* --- Fulle/Tomme i to kolonner --- */}
              <div className="flex flex-row justify-between items-end gap-6 mb-4 mt-1">
                <div className="flex flex-col items-center flex-1">
                  <span className="font-bold text-green-700 text-xl">Fulle</span>
                  {!editMode ? (
                    <span className="text-3xl font-bold mt-0 border-b-4 border-green-500">{selected.fullBarrels}</span>
                  ) : (
                    <div className="flex flex-row items-center mt-1">
                      <input
                        type="number"
                        value={editValues.fullBarrels ?? selected.fullBarrels}
                        onChange={(e) =>
                          setEditValues({ ...editValues, fullBarrels: e.target.value })
                        }
                        className="border rounded text-2xl text-center w-16 mx-2"
                        min={0}
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        className="bg-green-500 text-white text-2xl rounded-full w-9 h-9 flex items-center justify-center ml-1"
                        onClick={() => adjustBarrels(selected, "fullBarrels", 1)}
                        tabIndex={-1}
                      >+</button>
                      <button
                        className="bg-red-500 text-white text-2xl rounded-full w-9 h-9 flex items-center justify-center ml-1"
                        onClick={() => adjustBarrels(selected, "fullBarrels", -1)}
                        tabIndex={-1}
                      >–</button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center flex-1">
                  <span className="font-bold text-red-700 text-xl">Tomme</span>
                  {!editMode ? (
                    <span className="text-3xl font-bold mt-0 border-b-4 border-red-500">{selected.emptyBarrels}</span>
                  ) : (
                    <div className="flex flex-row items-center mt-1">
                      <input
                        type="number"
                        value={editValues.emptyBarrels ?? selected.emptyBarrels}
                        onChange={(e) =>
                          setEditValues({ ...editValues, emptyBarrels: e.target.value })
                        }
                        className="border rounded text-2xl text-center w-16 mx-2"
                        min={0}
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        className="bg-green-500 text-white text-2xl rounded-full w-9 h-9 flex items-center justify-center ml-1"
                        onClick={() => adjustBarrels(selected, "emptyBarrels", 1)}
                        tabIndex={-1}
                      >+</button>
                      <button
                        className="bg-red-500 text-white text-2xl rounded-full w-9 h-9 flex items-center justify-center ml-1"
                        onClick={() => adjustBarrels(selected, "emptyBarrels", -1)}
                        tabIndex={-1}
                      >–</button>
                    </div>
                  )}
                </div>
              </div>
              {/* --- Resten --- */}
              <div className="mt-2 mb-2 text-xl">
                <div>Fuelhenger: <span className="font-bold">{selected.trailer || 0} liter</span></div>
                <div>Fueltank: <span className="font-bold">{selected.tank || 0} liter</span></div>
                <div>Utstyr: <span className="font-bold whitespace-pre-wrap">{selected.equipment || ""}</span></div>
              </div>
              {editMode && (
                <button
                  onClick={() => handleManualEdit(selected)}
                  className="mt-3 mb-2 bg-green-600 text-white px-6 py-2 rounded text-xl font-bold"
                >
                  Lagre
                </button>
              )}
              <button
                onClick={() => deletePin(selected)}
                className="mt-2 bg-red-600 text-white px-8 py-2 rounded text-xl font-bold self-end"
              >
                Slett
              </button>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}

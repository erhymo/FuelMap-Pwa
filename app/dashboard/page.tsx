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

// --- TYPER ---
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
  images: string[];
  createdAt?: any;
}

// Midtpunkt for Norge
const center = { lat: 60.472, lng: 8.4689 };
const mapContainerStyle = { width: "100%", height: "100vh" };

export default function Dashboard() {
  // --- Auth ---
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

  // --- Fetch pins fra Firestore ---
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

  // --- Map click ---
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

  // --- Lagre nytt punkt ---
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

  // --- Slett punkt ---
  const deletePin = async (pin: Pin) => {
    await deleteDoc(doc(db, "pins", pin.id));
    setSelected(null);
  };

  // --- Oppdater felter manuelt (kontrollerte inputs og tallkonvertering) ---
  const handleManualEdit = async (pin: Pin) => {
    const updateData: any = {};
    for (const field in editValues) {
      let value = (editValues as any)[field];
      if (field === "equipment") {
        // Utstyr kan være tekst
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

  // --- Pluss/minus fat --- (nå 100% synk med input og kan ikke gå under 0)
  const adjustBarrels = async (
    pin: Pin,
    field: "fullBarrels" | "emptyBarrels",
    delta: number
  ) => {
    let newFull = pin.fullBarrels;
    let newEmpty = pin.emptyBarrels;

    if (field === "fullBarrels") {
      if (delta > 0 && pin.emptyBarrels > 0) {
        newFull += 1;
        newEmpty -= 1;
      } else if (delta < 0 && pin.fullBarrels > 0) {
        newFull -= 1;
        newEmpty += 1;
      }
    } else {
      if (delta > 0 && pin.fullBarrels > 0) {
        newEmpty += 1;
        newFull -= 1;
      } else if (delta < 0 && pin.emptyBarrels > 0) {
        newEmpty -= 1;
        newFull += 1;
      }
    }

    newFull = Math.max(0, newFull);
    newEmpty = Math.max(0, newEmpty);

    await updateDoc(doc(db, "pins", pin.id), {
      fullBarrels: newFull,
      emptyBarrels: newEmpty,
    });

    setSelected({ ...pin, fullBarrels: newFull, emptyBarrels: newEmpty });
    setEditValues((v) => ({
      ...v,
      fullBarrels: newFull,
      emptyBarrels: newEmpty,
    }));
  };

  // --- Zoom til depot ---
  const flyTo = (pin: Pin) => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat: Number(pin.lat), lng: Number(pin.lng) });
      mapRef.current.setZoom(13);
      setSelected(pin);
      setDropdownOpen(false);
    }
  };

  // --- Start edit ---
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

  if (!isLoaded) return <p className="text-black font-bold text-xl">Laster kart...</p>;

  return (
    <div className="relative w-full h-screen">
      {/* --- DEPOTDROPDOWN --- */}
      <div className="absolute z-20 left-4 top-4">
        <button
          className="bg-white rounded-full shadow p-3 mb-2 text-3xl font-extrabold text-black"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          ☰
        </button>
        {dropdownOpen && (
          <div className="bg-white shadow-lg rounded-lg p-4 max-h-96 w-72 overflow-y-auto mt-2">
            <div className="mb-2 text-2xl font-extrabold text-black">Alle depoter:</div>
            {pins
              .filter((p) => p.type === "fueldepot")
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((pin) => (
                <div
                  key={pin.id}
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-green-100 cursor-pointer"
                  onClick={() => flyTo(pin)}
                >
                  <span className="font-bold text-lg text-black">{pin.name}</span>
                  <span className="ml-auto flex flex-row items-center gap-3">
                    <span className="flex flex-row items-center gap-1">
                      <span className="text-xs text-green-600 font-bold">F</span>
                      <span className="underline text-green-600 font-extrabold text-lg">{pin.fullBarrels}</span>
                    </span>
                    <span className="flex flex-row items-center gap-1">
                      <span className="text-xs text-red-600 font-bold">T</span>
                      <span className="underline text-red-600 font-extrabold text-lg">{pin.emptyBarrels}</span>
                    </span>
                  </span>
                </div>
              ))}
          </div>
        )}
        {/* Nytt depot */}
        <button
          className="bg-green-500 text-white rounded-full shadow p-4 text-4xl mt-3 font-extrabold"
          onClick={() => setAddMode(true)}
          title="Legg til nytt depot"
        >
          +
        </button>
      </div>
      {/* --- KART --- */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={6}
        onClick={handleMapClick}
        onLoad={(map) => {
          mapRef.current = map;
        }}
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
            <div className="p-3 text-2xl font-extrabold text-black">
              <div className="mb-2 font-extrabold">Nytt punkt</div>
              <div>
                <label className="text-black font-extrabold">
                  Type:{" "}
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as "base" | "fueldepot")}
                    className="text-xl p-2 border text-black font-extrabold"
                  >
                    <option value="base">Base</option>
                    <option value="fueldepot">Fueldepot</option>
                  </select>
                </label>
              </div>
              <div className="mt-2">
                <label className="text-black font-extrabold">
                  Navn:{" "}
                  <input
                    className="border p-2 text-xl text-black font-extrabold"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </label>
              </div>
              <div className="mt-2">
                <label className="text-black font-extrabold">
                  Notat:{" "}
                  <input
                    className="border p-2 text-xl text-black font-extrabold"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                </label>
              </div>
              <button
                onClick={saveNewPin}
                className="mt-4 bg-green-600 text-white px-6 py-2 rounded text-2xl font-extrabold"
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
            options={{
              pixelOffset: new window.google.maps.Size(0, -25),
              maxWidth: 340,
              minWidth: 260,
              disableAutoPan: false,
            }}
          >
            <div
              className="p-3 rounded-xl"
              style={{
                background: "#fff",
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                width: "94vw",
                maxWidth: 340,
                minWidth: 260,
                fontSize: 19,
                fontWeight: 800,
                color: "#000",
                overflow: "visible",
                maxHeight: "none",
              }}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-2xl font-extrabold text-black">{selected.name || "Uten navn"}</span>
                {editMode ? (
                  <button
                    onClick={() => setEditMode(false)}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-lg font-extrabold"
                  >
                    Avslutt
                  </button>
                ) : (
                  <button
                    onClick={() => startEdit(selected)}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-lg font-extrabold"
                  >
                    Edit
                  </button>
                )}
              </div>
              {/* Fulle og Tomme */}
              {!editMode ? (
                <div className="flex justify-around mb-3">
                  <div className="flex flex-row items-center gap-3">
                    <span className="text-green-700 font-bold text-base">Fulle:</span>
                    <span className="text-2xl font-extrabold text-green-700">
                      {selected.fullBarrels}
                    </span>
                  </div>
                  <div className="flex flex-row items-center gap-3">
                    <span className="text-red-700 font-bold text-base">Tomme:</span>
                    <span className="text-2xl font-extrabold text-red-700">
                      {selected.emptyBarrels}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-around mb-3 gap-1 items-center">
                  {/* Fulle fat */}
                  <div className="flex flex-col items-center">
                    <span className="text-green-700 font-bold text-base">Fulle</span>
                    <div className="flex flex-row items-center gap-1">
                      <button
                        className="bg-green-500 text-white text-3xl rounded-full w-10 h-10 flex items-center justify-center font-extrabold"
                        onClick={() =>
                          adjustBarrels(selected, "fullBarrels", 1)
                        }
                      >
                        +
                      </button>
                      <input
                        type="number"
                        className="w-10 text-xl font-extrabold text-center text-black border"
                        value={
                          editValues.fullBarrels !== undefined
                            ? editValues.fullBarrels
                            : selected.fullBarrels
                        }
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            fullBarrels: Number(e.target.value),
                          })
                        }
                        min={0}
                      />
                      <button
                        className="bg-red-500 text-white text-3xl rounded-full w-10 h-10 flex items-center justify-center font-extrabold"
                        onClick={() =>
                          adjustBarrels(selected, "fullBarrels", -1)
                        }
                      >
                        –
                      </button>
                    </div>
                  </div>
                  {/* Tomme fat */}
                  <div className="flex flex-col items-center">
                    <span className="text-red-700 font-bold text-base">Tomme</span>
                    <div className="flex flex-row items-center gap-1">
                      <button
                        className="bg-green-500 text-white text-3xl rounded-full w-10 h-10 flex items-center justify-center font-extrabold"
                        onClick={() =>
                          adjustBarrels(selected, "emptyBarrels", 1)
                        }
                      >
                        +
                      </button>
                      <input
                        type="number"
                        className="w-10 text-xl font-extrabold text-center text-black border"
                        value={
                          editValues.emptyBarrels !== undefined
                            ? editValues.emptyBarrels
                            : selected.emptyBarrels
                        }
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            emptyBarrels: Number(e.target.value),
                          })
                        }
                        min={0}
                      />
                      <button
                        className="bg-red-500 text-white text-3xl rounded-full w-10 h-10 flex items-center justify-center font-extrabold"
                        onClick={() =>
                          adjustBarrels(selected, "emptyBarrels", -1)
                        }
                      >
                        –
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Fuel og utstyr */}
              <div className="mb-1 flex flex-col gap-1 mt-2">
                <div>
                  <span className="font-bold text-black">Fuelhenger: </span>
                  {editMode ? (
                    <input
                      type="number"
                      className="border w-24 p-1 text-base font-extrabold text-black"
                      value={
                        editValues.trailer !== undefined
                          ? editValues.trailer
                          : selected.trailer
                      }
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          trailer: Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <span className="font-extrabold text-black">{selected.trailer || 0} liter</span>
                  )}
                </div>
                <div>
                  <span className="font-bold text-black">Fueltank: </span>
                  {editMode ? (
                    <input
                      type="number"
                      className="border w-24 p-1 text-base font-extrabold text-black"
                      value={
                        editValues.tank !== undefined
                          ? editValues.tank
                          : selected.tank
                      }
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          tank: Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <span className="font-extrabold text-black">{selected.tank || 0} liter</span>
                  )}
                </div>
                <div>
                  <span className="font-bold text-black">Utstyr: </span>
                  {editMode ? (
                    <input
                      type="text"
                      className="border w-40 p-1 text-base font-extrabold text-black"
                      value={
                        editValues.equipment !== undefined
                          ? editValues.equipment
                          : selected.equipment
                      }
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          equipment: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <span className="font-extrabold text-black">{selected.equipment || "-"}</span>
                  )}
                </div>
              </div>

              {/* Lagre / Slett */}
              {editMode && (
                <div className="flex items-center mt-4">
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded text-lg font-extrabold flex-1"
                    onClick={() => handleManualEdit(selected)}
                  >
                    Lagre
                  </button>
                  <button
                    className="bg-red-600 text-white px-3 py-2 rounded text-base font-extrabold ml-3"
                    style={{
                      flex: "0 0 70px",
                      minWidth: 40,
                      maxWidth: 80,
                      fontSize: "1.05rem",
                    }}
                    onClick={() => deletePin(selected)}
                  >
                    Slett
                  </button>
                </div>
              )}
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}

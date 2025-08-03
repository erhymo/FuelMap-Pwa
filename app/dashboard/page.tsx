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
  arrayUnion,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

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
  createdAt?: any; // Firestore Timestamp
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
    if (pin.images?.length) {
      for (const url of pin.images) {
        const path = url.split("%2F")[1]?.split("?")[0];
        if (path) {
          const refToDelete = ref(storage, `images/${path}`);
          await deleteObject(refToDelete).catch(() => {});
        }
      }
    }
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

  // --- Pluss/minus fat med logikk ---
  const adjustBarrels = async (pin: Pin, field: "fullBarrels" | "emptyBarrels", delta: number) => {
    let full = pin.fullBarrels || 0;
    let empty = pin.emptyBarrels || 0;

    if (field === "fullBarrels") {
      full = Math.max(0, full + delta);
      empty = Math.max(0, empty - delta);
    } else {
      empty = Math.max(0, empty + delta);
      full = Math.max(0, full - delta);
    }

    await updateDoc(doc(db, "pins", pin.id), { fullBarrels: full, emptyBarrels: empty });
  };

  // --- Bildeopplasting --- (utgår for nå, ikke synlig)
  // const uploadImage = async (pin: Pin, file: File) => { ... }

  // --- Zoom til depot ---
  const flyTo = (pin: Pin) => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat: Number(pin.lat), lng: Number(pin.lng) });
      mapRef.current.setZoom(13);
      setSelected(pin);
      setDropdownOpen(false);
    }
  };

  // --- Start edit (kopierer valgte felter til editValues) ---
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
      {/* --- DEPOTDROPDOWN --- */}
      <div className="absolute z-20 left-4 top-4">
        <button
          className="bg-white rounded-full shadow p-3 mb-2 text-3xl font-bold"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >☰</button>
        {dropdownOpen && (
          <div className="bg-white shadow-lg rounded-lg p-4 max-h-[70vh] w-72 overflow-y-auto mt-2">
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
                  <div className="flex flex-col text-right ml-auto mr-2">
                    <span className="flex items-end gap-4">
                      <span className="flex flex-col items-center mr-1">
                        <span className="text-green-600 text-sm font-bold">F</span>
                        <span className="text-green-600 border-b-2 border-green-500">{pin.fullBarrels}</span>
                      </span>
                      <span className="flex flex-col items-center">
                        <span className="text-red-600 text-sm font-bold">T</span>
                        <span className="text-red-600 border-b-2 border-red-500">{pin.emptyBarrels}</span>
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
            <div className="p-3 text-2xl min-w-[320px] max-w-[370px]">
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

        {/* --- INFOBOBLE FOR DEPOT --- */}
        {selected && !selected.editing && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
          >
            <div
              className="flex flex-col p-6 rounded-2xl shadow-lg bg-white min-w-[340px] max-w-[420px] max-h-[95vh]"
              style={{ fontSize: '1.6rem', boxSizing: 'border-box', overflow: "visible" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-3xl">{selected.name || "Uten navn"}</span>
                <button
                  onClick={() => editMode ? setEditMode(false) : startEdit(selected)}
                  className="ml-4 bg-blue-600 text-white px-8 py-2 text-2xl font-bold rounded"
                >
                  {editMode ? "Avslutt" : "Edit"}
                </button>
              </div>
              {!editMode ? (
                <>
                  <div className="flex w-full justify-center gap-12 mb-1">
                    <div className="flex flex-col items-center">
                      <span className="text-green-600 font-bold text-xl mb-[-6px]">Fulle</span>
                      <span className="text-3xl text-green-700">{selected.fullBarrels}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-red-600 font-bold text-xl mb-[-6px]">Tomme</span>
                      <span className="text-3xl text-red-600">{selected.emptyBarrels}</span>
                    </div>
                  </div>
                  <div className="text-lg mt-2 mb-1">
                    <span>Fuelhenger: <b>{selected.trailer ?? 0} liter</b></span>
                  </div>
                  <div className="text-lg mb-1">
                    <span>Fueltank: <b>{selected.tank ?? 0} liter</b></span>
                  </div>
                  <div className="text-lg mb-2">
                    <span>Utstyr: {selected.equipment || <span className="text-gray-400">Ingen info</span>}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex w-full justify-center gap-12 mb-1">
                    {/* Fulle fat */}
                    <div className="flex flex-col items-center">
                      <span className="text-green-600 font-bold text-xl mb-[-6px]">Fulle</span>
                      <div className="flex flex-row items-center mt-1">
                        <input
                          type="number"
                          min={0}
                          className="border text-2xl w-16 text-center mr-2"
                          value={editValues.fullBarrels ?? selected.fullBarrels}
                          onChange={e =>
                            setEditValues({
                              ...editValues,
                              fullBarrels: e.target.value === "" ? 0 : Number(e.target.value)
                            })
                          }
                        />
                        <button
                          className="bg-green-500 text-white text-3xl rounded-full w-12 h-12 flex items-center justify-center mr-2"
                          onClick={() => setEditValues({
                            ...editValues,
                            fullBarrels: Number(editValues.fullBarrels ?? selected.fullBarrels) + 1,
                            emptyBarrels: Math.max(0, Number(editValues.emptyBarrels ?? selected.emptyBarrels) - 1)
                          })}
                        >+</button>
                        <button
                          className="bg-red-500 text-white text-3xl rounded-full w-12 h-12 flex items-center justify-center"
                          onClick={() => setEditValues({
                            ...editValues,
                            fullBarrels: Math.max(0, Number(editValues.fullBarrels ?? selected.fullBarrels) - 1),
                            emptyBarrels: Number(editValues.emptyBarrels ?? selected.emptyBarrels) + 1
                          })}
                        >–</button>
                      </div>
                    </div>
                    {/* Tomme fat */}
                    <div className="flex flex-col items-center">
                      <span className="text-red-600 font-bold text-xl mb-[-6px]">Tomme</span>
                      <div className="flex flex-row items-center mt-1">
                        <input
                          type="number"
                          min={0}
                          className="border text-2xl w-16 text-center mr-2"
                          value={editValues.emptyBarrels ?? selected.emptyBarrels}
                          onChange={e =>
                            setEditValues({
                              ...editValues,
                              emptyBarrels: e.target.value === "" ? 0 : Number(e.target.value)
                            })
                          }
                        />
                        <button
                          className="bg-green-500 text-white text-3xl rounded-full w-12 h-12 flex items-center justify-center mr-2"
                          onClick={() => setEditValues({
                            ...editValues,
                            emptyBarrels: Number(editValues.emptyBarrels ?? selected.emptyBarrels) + 1,
                            fullBarrels: Math.max(0, Number(editValues.fullBarrels ?? selected.fullBarrels) - 1)
                          })}
                        >+</button>
                        <button
                          className="bg-red-500 text-white text-3xl rounded-full w-12 h-12 flex items-center justify-center"
                          onClick={() => setEditValues({
                            ...editValues,
                            emptyBarrels: Math.max(0, Number(editValues.emptyBarrels ?? selected.emptyBarrels) - 1),
                            fullBarrels: Number(editValues.fullBarrels ?? selected.fullBarrels) + 1
                          })}
                        >–</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row gap-2 mb-2 mt-2 items-center">
                    <span className="text-lg min-w-[105px]">Fuelhenger:</span>
                    <input
                      type="number"
                      min={0}
                      className="border text-2xl w-32 p-1 mr-2"
                      value={editValues.trailer ?? selected.trailer ?? 0}
                      onChange={e => setEditValues({ ...editValues, trailer: Number(e.target.value) })}
                    />
                    <span className="text-lg">liter</span>
                  </div>
                  <div className="flex flex-row gap-2 mb-2 items-center">
                    <span className="text-lg min-w-[105px]">Fueltank:</span>
                    <input
                      type="number"
                      min={0}
                      className="border text-2xl w-32 p-1 mr-2"
                      value={editValues.tank ?? selected.tank ?? 0}
                      onChange={e => setEditValues({ ...editValues, tank: Number(e.target.value) })}
                    />
                    <span className="text-lg">liter</span>
                  </div>
                  <div className="flex flex-row gap-2 mb-3 items-center">
                    <span className="text-lg min-w-[105px]">Utstyr:</span>
                    <input
                      className="border text-2xl w-56 p-1"
                      value={editValues.equipment ?? selected.equipment ?? ""}
                      onChange={e => setEditValues({ ...editValues, equipment: e.target.value })}
                    />
                  </div>
                  <button
                    className="bg-green-600 text-white px-14 py-3 rounded text-2xl font-bold mt-2 mb-1"
                    onClick={() => handleManualEdit(selected)}
                  >
                    Lagre
                  </button>
                </>
              )}
              <div className="flex justify-end items-end mt-auto mb-[-8px]">
                <button
                  onClick={() => deletePin(selected)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded text-base font-bold mr-2 mb-2"
                  style={{ minWidth: 65, fontSize: "1.2rem" }}
                >
                  Slett
                </button>
              </div>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}

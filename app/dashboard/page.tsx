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

  // --- Oppdater felter manuelt ---
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

  // --- Pluss/minus fat ---
  const adjustBarrels = async (pin: Pin, field: "fullBarrels" | "emptyBarrels", delta: number) => {
    const current = pin[field] || 0;
    const update: any = { [field]: Math.max(0, current + delta) };
    if (field === "fullBarrels" && delta < 0)
      update.emptyBarrels = Math.max(0, (pin.emptyBarrels || 0) + Math.abs(delta));
    if (field === "emptyBarrels" && delta < 0)
      update.fullBarrels = Math.max(0, (pin.fullBarrels || 0) + Math.abs(delta));
    if (field === "fullBarrels" && delta > 0 && pin.emptyBarrels > 0)
      update.emptyBarrels = Math.max(0, pin.emptyBarrels - 1);
    if (field === "emptyBarrels" && delta > 0 && pin.fullBarrels > 0)
      update.fullBarrels = Math.max(0, pin.fullBarrels - 1);

    await updateDoc(doc(db, "pins", pin.id), update);
  };

  // --- Bildeopplasting ---
  const uploadImage = async (pin: Pin, file: File) => {
    const imageRef = ref(storage, `images/${uuidv4()}`);
    await uploadBytes(imageRef, file);
    const url = await getDownloadURL(imageRef);
    const images = pin.images || [];
    if (images.length >= 5) {
      const oldest = images[0];
      const path = oldest.split("%2F")[1]?.split("?")[0];
      if (path) await deleteObject(ref(storage, `images/${path}`)).catch(() => {});
      await updateDoc(doc(db, "pins", pin.id), { images: [...images.slice(1), url] });
    } else {
      await updateDoc(doc(db, "pins", pin.id), { images: arrayUnion(url) });
    }
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
          <div className="bg-white rounded-2xl shadow-lg p-4 max-h-[80vh] w-[94vw] max-w-sm overflow-y-auto text-black">
            <div className="mb-2 text-2xl font-bold text-black">Alle depoter:</div>
            {pins
              .filter((p) => p.type === "fueldepot")
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((pin) => (
                <div
                  key={pin.id}
                  className="flex items-center justify-between px-2 py-2 rounded hover:bg-green-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                  onClick={() => flyTo(pin)}
                >
                  <span className="font-semibold text-lg text-black min-w-[90px]">{pin.name}</span>
                  <div className="flex gap-6">
                    <div className="flex flex-col items-center w-9">
                      <span className="text-xs text-green-600 font-bold border-b-2 border-green-500 pb-0.5">F</span>
                      <span className="text-xl text-black">{pin.fullBarrels}</span>
                    </div>
                    <div className="flex flex-col items-center w-9">
                      <span className="text-xs text-red-600 font-bold border-b-2 border-red-500 pb-0.5">T</span>
                      <span className="text-xl text-black">{pin.emptyBarrels}</span>
                    </div>
                  </div>
                </div>
              ))}
            {/* Nytt depot */}
            <button
              className="bg-green-500 text-white rounded-full shadow p-4 text-4xl mt-3"
              onClick={() => setAddMode(true)}
              title="Legg til nytt depot"
            >+</button>
          </div>
        )}
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
        {/* Nytt punkt */}
        {selected?.editing && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="p-3 text-2xl max-w-xs text-black">
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

        {/* INFOBOBLE FOR DEPOT */}
        {selected && !selected.editing && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
            options={{ maxWidth: 340 }}
          >
            <div className="bg-white rounded-3xl shadow-xl p-5 w-[320px] max-w-xs text-black flex flex-col gap-2">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-2xl">{selected.name || "Uten navn"}</span>
                <button
                  onClick={() => editMode ? setEditMode(false) : startEdit(selected)}
                  className="text-xl ml-3 bg-blue-500 text-white px-4 py-1 rounded font-bold"
                >
                  {editMode ? "Avslutt" : "Edit"}
                </button>
              </div>
              <div className="flex gap-4 mb-2">
                <div className="flex flex-col items-center w-1/2">
                  <span className="text-xs text-green-600 font-bold border-b-2 border-green-500 pb-0.5">Fulle</span>
                  <span className="text-2xl">{selected.fullBarrels}</span>
                </div>
                <div className="flex flex-col items-center w-1/2">
                  <span className="text-xs text-red-600 font-bold border-b-2 border-red-500 pb-0.5">Tomme</span>
                  <span className="text-2xl">{selected.emptyBarrels}</span>
                </div>
              </div>
              <div>Fuelhenger: <span className="font-semibold">{selected.trailer || 0} liter</span></div>
              <div>Fueltank: <span className="font-semibold">{selected.tank || 0} liter</span></div>
              <div>
                Utstyr:
                <pre className="ml-2 whitespace-pre-wrap inline">{selected.equipment}</pre>
              </div>
              {/* Bilder */}
              <div className="flex flex-wrap gap-2 my-2">
                {selected.images?.map((img: string, i: number) => (
                  <img key={i} src={img} alt="" className="rounded w-20 h-20 object-cover" />
                ))}
              </div>
              <div className="mt-2 flex gap-2 items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files?.[0] && uploadImage(selected, e.target.files[0])
                  }
                />
                <button
                  onClick={() => deletePin(selected)}
                  className="text-xl bg-red-600 text-white px-4 py-1 rounded"
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

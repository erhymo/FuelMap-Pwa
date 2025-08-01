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

  const handleManualEdit = async (pin: Pin) => {
    const updateData: any = {};
    for (const field in editValues) {
      let value = (editValues as any)[field];
      if (field === "equipment") {
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

  const adjustBarrels = async (pin: Pin, field: "fullBarrels" | "emptyBarrels", delta: number) => {
    const current = Number(editValues[field] ?? pin[field]) || 0;
    const update: any = { [field]: Math.max(0, current + delta) };
    if (field === "fullBarrels" && delta < 0)
      update.emptyBarrels = Math.max(0, Number(editValues.emptyBarrels ?? pin.emptyBarrels) + Math.abs(delta));
    if (field === "emptyBarrels" && delta < 0)
      update.fullBarrels = Math.max(0, Number(editValues.fullBarrels ?? pin.fullBarrels) + Math.abs(delta));
    if (field === "fullBarrels" && delta > 0 && (editValues.emptyBarrels ?? pin.emptyBarrels) > 0)
      update.emptyBarrels = Math.max(0, (editValues.emptyBarrels ?? pin.emptyBarrels) - 1);
    if (field === "emptyBarrels" && delta > 0 && (editValues.fullBarrels ?? pin.fullBarrels) > 0)
      update.fullBarrels = Math.max(0, (editValues.fullBarrels ?? pin.fullBarrels) - 1);

    await updateDoc(doc(db, "pins", pin.id), update);
    const updatedPin = (await getDoc(doc(db, "pins", pin.id))).data();
    if (updatedPin) setSelected({ id: pin.id, ...(updatedPin as Omit<Pin, "id">), editing: true });
    setEditValues({});
  };

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
    setSelected({ ...pin, editing: true });
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
            <div className="divide-y">
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
                    <div className="ml-auto grid grid-cols-2 gap-2">
                      <div className="flex flex-col items-center mr-2">
                        <span className="text-xs border-b-2 border-green-500 font-bold">F</span>
                        <span className="text-lg">{pin.fullBarrels}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs border-b-2 border-red-500 font-bold">T</span>
                        <span className="text-lg">{pin.emptyBarrels}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
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
        {/* Nytt punkt */}
        {selected?.editing && !selected.id && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="p-3 text-2xl">
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
        {/* Info-boble for depot (visning) */}
        {selected && !selected.editing && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="p-4 rounded-2xl shadow-lg bg-white min-w-[340px] max-w-[370px] flex flex-col gap-2">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-2xl">{selected.name || "Uten navn"}</h2>
                <button
                  onClick={() => startEdit(selected)}
                  className="text-lg px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
                >
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-lg">
                <div className="text-center">
                  <div className="font-bold border-b-4 border-green-500 inline-block mb-1">Fulle fat</div>
                  <div className="text-2xl">{selected.fullBarrels}</div>
                </div>
                <div className="text-center">
                  <div className="font-bold border-b-4 border-red-500 inline-block mb-1">Tomme fat</div>
                  <div className="text-2xl">{selected.emptyBarrels}</div>
                </div>
              </div>
              <div className="text-lg mt-2">
                <span className="font-bold">Fuelhenger: </span>
                {selected.trailer || 0} liter
              </div>
              <div className="text-lg">
                <span className="font-bold">Fueltank: </span>
                {selected.tank || 0} liter
              </div>
              <div className="text-lg">
                <span className="font-bold">Utstyr:</span>
                <span className="ml-2">{selected.equipment}</span>
              </div>
              <div className="flex flex-wrap gap-2 my-2">
                {selected.images?.map((img: string, i: number) => (
                  <img key={i} src={img} alt="" className="rounded w-20 h-20 object-cover" />
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => deletePin(selected)}
                  className="text-lg bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                >
                  Slett
                </button>
              </div>
            </div>
          </InfoWindowF>
        )}
        {/* Info-boble for redigering */}
        {selected && selected.editing && selected.id && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="p-4 rounded-2xl shadow-lg bg-white min-w-[340px] max-w-[370px] flex flex-col gap-2">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-2xl">{selected.name || "Uten navn"}</h2>
                <button
                  onClick={() => setEditMode(false)}
                  className="text-lg px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
                >
                  Avslutt
                </button>
              </div>
              {/* Fulle og tomme fat: To kolonner */}
              <div className="grid grid-cols-2 gap-4 mb-2">
                {/* Fulle fat */}
                <div className="flex flex-col items-center">
                  <span className="font-bold border-b-4 border-green-500 mb-1">Fulle fat</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="bg-green-500 text-white text-2xl rounded-full w-9 h-9 flex items-center justify-center"
                      onClick={() => adjustBarrels(selected, "fullBarrels", 1)}
                    >+</button>
                    <input
                      className="border text-2xl w-16 text-center"
                      type="number"
                      value={editValues.fullBarrels ?? selected.fullBarrels}
                      onChange={(e) =>
                        setEditValues({ ...editValues, fullBarrels: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="bg-red-500 text-white text-2xl rounded-full w-9 h-9 flex items-center justify-center"
                      onClick={() => adjustBarrels(selected, "fullBarrels", -1)}
                    >−</button>
                  </div>
                </div>
                {/* Tomme fat */}
                <div className="flex flex-col items-center">
                  <span className="font-bold border-b-4 border-red-500 mb-1">Tomme fat</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="bg-green-500 text-white text-2xl rounded-full w-9 h-9 flex items-center justify-center"
                      onClick={() => adjustBarrels(selected, "emptyBarrels", 1)}
                    >+</button>
                    <input
                      className="border text-2xl w-16 text-center"
                      type="number"
                      value={editValues.emptyBarrels ?? selected.emptyBarrels}
                      onChange={(e) =>
                        setEditValues({ ...editValues, emptyBarrels: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="bg-red-500 text-white text-2xl rounded-full w-9 h-9 flex items-center justify-center"
                      onClick={() => adjustBarrels(selected, "emptyBarrels", -1)}
                    >−</button>
                  </div>
                </div>
              </div>
              {/* Fuelhenger */}
              <div className="text-lg mt-2 flex items-center">
                <span className="font-bold mr-2">Fuelhenger:</span>
                <input
                  className="border text-2xl w-24 text-center"
                  type="number"
                  value={editValues.trailer ?? selected.trailer}
                  onChange={(e) =>
                    setEditValues({ ...editValues, trailer: e.target.value })
                  }
                />
                <span className="ml-2">liter</span>
              </div>
              {/* Fueltank */}
              <div className="text-lg flex items-center">
                <span className="font-bold mr-2">Fueltank:</span>
                <input
                  className="border text-2xl w-24 text-center"
                  type="number"
                  value={editValues.tank ?? selected.tank}
                  onChange={(e) =>
                    setEditValues({ ...editValues, tank: e.target.value })
                  }
                />
                <span className="ml-2">liter</span>
              </div>
              {/* Utstyr */}
              <div className="text-lg flex flex-col mt-2">
                <span className="font-bold mb-1">Utstyr:</span>
                <textarea
                  className="border text-2xl w-full min-h-[48px]"
                  value={editValues.equipment ?? selected.equipment}
                  onChange={(e) =>
                    setEditValues({ ...editValues, equipment: e.target.value })
                  }
                />
              </div>
              {/* Bilder */}
              <div className="flex flex-wrap gap-2 my-2">
                {selected.images?.map((img: string, i: number) => (
                  <img key={i} src={img} alt="" className="rounded w-20 h-20 object-cover" />
                ))}
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2"
                  onChange={(e) =>
                    e.target.files?.[0] && uploadImage(selected, e.target.files[0])
                  }
                />
              </div>
              {/* Lagre og Slett-knapper */}
              <div className="flex justify-between items-center mt-2">
                <button
                  onClick={() => handleManualEdit(selected)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded text-lg font-bold"
                >
                  Lagre
                </button>
                <button
                  onClick={() => deletePin(selected)}
                  className="text-lg bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
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

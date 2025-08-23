
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
import DepotPopup from "@/components/dashboard/DepotPopup";
import { useRouter } from "next/navigation";

interface Pin {
  id: string;
  lat: number;
  lng: number;
  type: "base" | "fueldepot" | "helipad";
  name: string;
  note?: string;
  fullBarrels: number;
  emptyBarrels: number;
  tank: number;
  trailer: number;
  equipment: string[];
  images: string[];
  createdAt?: number | string;
}

function ensureArray(equipment: string | string[] | undefined): string[] {
  if (!equipment) return [];
  if (Array.isArray(equipment)) return equipment;
  return equipment.split('\n').map(s => s.trim()).filter(Boolean);
}

const center = { lat: 60.472, lng: 8.4689 };
const mapContainerStyle = { width: "100%", height: "100vh" };

const HELIPAD_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Helipad">
  <circle cx="32" cy="32" r="30" fill="#FFD200" stroke="#000000" stroke-width="2"/>
  <rect x="18" y="14" width="8" height="36" fill="#000000" rx="1"/>
  <rect x="38" y="14" width="8" height="36" fill="#000000" rx="1"/>
  <rect x="18" y="29" width="28" height="6" fill="#000000" rx="1"/>
</svg>
`.trim();
const HELIPAD_ICON_URL = `data:image/svg+xml;utf8,${encodeURIComponent(HELIPAD_SVG)}`;

function sizeForZoom(zoom: number | undefined, min=24, max=48, zMin=5, zMax=12) {
  if (zoom === undefined || zoom === null) return max;
  if (zoom <= zMin) return min;
  if (zoom >= zMax) return max;
  const t = (zoom - zMin) / (zMax - zMin);
  return Math.round(min + t * (max - min));
}

function panMarkerIntoView(map: google.maps.Map, pos: google.maps.LatLngLiteral) {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const offsetY = isMobile ? 220 : 160;
  map.panTo(pos);
  setTimeout(() => {
    map.panBy(0, -offsetY);
  }, 0);
}

export default function MapView() {
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
  const [newType, setNewType] = useState<"base" | "fueldepot" | "helipad">("base");
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editValues, setEditValues] = useState<Partial<Pin> & { newEquipment?: string }>({});
  const [editMode, setEditMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEquip, setShowEquip] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState<number>(6);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pins"), (snapshot) => {
      const pinData = snapshot.docs.map((doc) => {
        const data = doc.data() as Pin;
        return {
          ...data,
          id: doc.id,
          equipment: ensureArray(data.equipment),
        };
      });
      setPins(pinData as Pin[]);
    });
    return () => unsub();
  }, []);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && addMode) {
      setSelected({
        id: "",
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        type: newType,
        name: "",
        note: "",
        fullBarrels: 0,
        emptyBarrels: 0,
        tank: 0,
        trailer: 0,
        equipment: [],
        images: [],
        editing: true,
      });
      setAddMode(false);
    } else {
      setSelected(null);
      setEditMode(false);
      setShowDeleteConfirm(false);
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
      equipment: [],
      images: [],
    });
    setSelected(null);
  };

  const deletePin = async (pin: Pin) => {
    await deleteDoc(doc(db, "pins", pin.id));
    setShowDeleteConfirm(false);
    setSelected(null);
    setEditMode(false);
  };

  const handleManualEdit = async (pin: Pin) => {
    const updateData: Record<string, unknown> = {};
    for (const field of Object.keys(pin) as Array<keyof Pin>) {
      if (field === "id" || field === "images" || field === "createdAt") continue;
      if (field === "equipment") {
        updateData.equipment = pin.equipment;
        continue;
      }
      updateData[field] = pin[field];
    }
    await updateDoc(doc(db, "pins", pin.id), updateData);
    setEditValues({});
    setEditMode(false);
    const updatedPin = (await getDoc(doc(db, "pins", pin.id))).data();
    if (updatedPin) setSelected({ id: pin.id, ...(updatedPin as Omit<Pin, "id">), equipment: ensureArray(updatedPin.equipment) });
  };

  const minusOneFromFull = (pin: Pin) => {
    const currentFull = editValues.fullBarrels ?? pin.fullBarrels;
    const currentEmpty = editValues.emptyBarrels ?? pin.emptyBarrels;
    if (currentFull <= 0) return;
    setEditValues((v) => ({
      ...v,
      fullBarrels: currentFull - 1,
      emptyBarrels: currentEmpty + 1,
    }));
  };

  const addEquipment = () => {
    const trimmed = (editValues.newEquipment || "").trim();
    if (!trimmed) return;
    setEditValues((prev) => ({
      ...prev,
      equipment: [...(prev.equipment || []), trimmed],
      newEquipment: "",
    }));
  };

  const removeEquipment = (idx: number) => {
    setEditValues((prev) => ({
      ...prev,
      equipment: (prev.equipment || []).filter((_: string, i: number) => i !== idx),
    }));
  };

  const flyTo = (pin: Pin) => {
    if (mapRef.current) {
      const pos = { lat: Number(pin.lat), lng: Number(pin.lng) };
      mapRef.current.panTo(pos);
      setTimeout(() => panMarkerIntoView(mapRef.current!, pos), 0);
      mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 6, 13));
      setSelected({ ...pin, equipment: ensureArray(pin.equipment) });
      setDropdownOpen(false);
      setEditMode(false);
      setShowDeleteConfirm(false);
      setShowEquip(false);
      setShowNote(false);
    }
  };

  const startEdit = (pin: Pin) => {
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    setEditMode(true);
    setEditValues({
      fullBarrels: pin.fullBarrels,
      emptyBarrels: pin.emptyBarrels,
      trailer: pin.trailer,
      tank: pin.tank,
      equipment: ensureArray(pin.equipment),
      note: pin.note,
      newEquipment: "",
    });
    setShowEquip(!isMobile);
    setShowNote(!isMobile);
  };

  useEffect(() => {
    if (!showDeleteConfirm) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showDeleteConfirm]);

  if (!isLoaded) return <p className="text-black font-bold text-xl">Laster kart...</p>;

  return (
    <div className="relative w-full h-screen">
      {/* DEPOTDROPDOWN & PLUSS: flyttet ned under Google-kontroller */}
      <div className="absolute z-20 left-4 top-24 md:top-28">
        <button
          className="bg-white rounded-full shadow p-3 mb-2 text-3xl font-extrabold text-black"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-label="Åpne depotliste"
        >
          ☰
        </button>
        {dropdownOpen && (
          <div className="bg-white shadow-lg rounded-lg p-4 max-h-96 w-72 overflow-y-auto mt-2">
            <div className="mb-2 text-2xl font-extrabold text-black">Alle depoter:</div>
            {pins
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((pin) => (
                <div
                  key={pin.id}
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-green-100 cursor-pointer"
                  onClick={() => flyTo(pin)}
                >
                  <span className="font-bold text-lg text-black truncate">{pin.name}</span>
                  <span className="ml-auto flex flex-row items-center gap-2">
                    {/* Tall til høyre: grønne (fulle) og røde (tomme) */}
                    <span className="text-green-600 font-extrabold text-base tabular-nums">{pin.fullBarrels ?? 0}</span>
                    <span className="text-red-600 font-extrabold text-base tabular-nums">{pin.emptyBarrels ?? 0}</span>
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
          aria-label="Legg til nytt depot"
        >
          +
        </button>
      </div>
      {/* KART */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={6}
        onClick={handleMapClick}
        onLoad={(map) => {
          mapRef.current = map;
          setZoom(map.getZoom() ?? 6);
        }}
        onZoomChanged={() => {
          if (mapRef.current) setZoom(mapRef.current.getZoom() ?? zoom);
        }}
      >
        {pins.map((pin) => {
          const size = sizeForZoom(zoom);
          if (pin.type === "helipad") {
            return (
              <MarkerF
                key={pin.id}
                position={{ lat: Number(pin.lat), lng: Number(pin.lng) }}
                onClick={() => {
                  const pos = { lat: Number(pin.lat), lng: Number(pin.lng) };
                  setSelected({ ...pin, equipment: ensureArray(pin.equipment) });
                  setEditMode(false);
                  setShowDeleteConfirm(false);
                  setShowEquip(false);
                  setShowNote(false);
                  if (mapRef.current) setTimeout(() => panMarkerIntoView(mapRef.current!, pos), 0);
                }}
                icon={{
                  url: HELIPAD_ICON_URL,
                  scaledSize: new google.maps.Size(size, size),
                  anchor: new google.maps.Point(Math.floor(size/2), Math.floor(size/2)),
                }}
              />
            );
          }
          return (
            <MarkerF
              key={pin.id}
              position={{ lat: Number(pin.lat), lng: Number(pin.lng) }}
              onClick={() => {
                const pos = { lat: Number(pin.lat), lng: Number(pin.lng) };
                setSelected({ ...pin, equipment: ensureArray(pin.equipment) });
                setEditMode(false);
                setShowDeleteConfirm(false);
                setShowEquip(false);
                setShowNote(false);
                if (mapRef.current) setTimeout(() => panMarkerIntoView(mapRef.current!, pos), 0);
              }}
              icon={{
                url:
                  pin.type === "base"
                    ? "https://maps.google.com/mapfiles/kml/shapes/heliport.png"
                    : pin.type === "fueldepot"
                      ? (pin.fullBarrels > 2
                          ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                          : "http://maps.google.com/mapfiles/ms/icons/red-dot.png")
                      : undefined,
                scaledSize: new google.maps.Size(size, size),
              }}
            />
          );
        })}

        {/* For ny-oppføring: vis HELIPAD-ikonet som forhåndsvisning KUN når type=helipad */}
        {selected?.editing && newType === "helipad" && (
          <MarkerF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            icon={{
              url: HELIPAD_ICON_URL,
              scaledSize: new google.maps.Size(sizeForZoom(zoom), sizeForZoom(zoom)),
              anchor: new google.maps.Point(Math.floor(sizeForZoom(zoom)/2), Math.floor(sizeForZoom(zoom)/2)),
            }}
          />
        )}

        {/* Nytt punkt */}
        {selected?.editing && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
            options={{ maxWidth: 370, minWidth: 180, pixelOffset: new window.google.maps.Size(0, -10) }}
          >
            <div className="p-2 text-xl font-extrabold text-black" style={{ minWidth: 160 }}>
              <div className="mb-2 font-extrabold">Nytt punkt</div>
              <div>
                <label className="text-black font-extrabold">
                  Type:{" "}
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as "base" | "fueldepot" | "helipad")}
                    className="text-xl p-2 border text-black font-extrabold"
                  >
                    <option value="base">Base</option>
                    <option value="fueldepot">Fueldepot</option>
                    <option value="helipad">Helipad</option>
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

        {/* INFOBOBLE FOR DEPOT */}
        {selected && !selected.editing && (
          <DepotPopup
            selected={selected}
            editMode={editMode}
            editValues={editValues}
            setEditMode={setEditMode}
            setEditValues={setEditValues}
            setShowEquip={setShowEquip}
            setShowNote={setShowNote}
            showEquip={showEquip}
            showNote={showNote}
            startEdit={startEdit}
            handleManualEdit={handleManualEdit}
            minusOneFromFull={minusOneFromFull}
            addEquipment={addEquipment}
            removeEquipment={removeEquipment}
            setShowDeleteConfirm={setShowDeleteConfirm}
            showDeleteConfirm={showDeleteConfirm}
            deletePin={deletePin}
            setSelected={setSelected}
          />
        )}
      </GoogleMap>
      {/* Slettebekreftelse-popup */}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            left: 0, top: 0, width: "100vw", height: "100vh",
            background: "rgba(0,0,0,0.22)",
            zIndex: 20000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div style={{
            background: "#fff",
            borderRadius: 13,
            boxShadow: "0 8px 24px rgba(0,0,0,0.19)",
            padding: 21,
            minWidth: 220,
            maxWidth: 320,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            border: "2px solid #dc2626"
          }}>
            <span style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: "#dc2626", textAlign: "center" }}>
              Er du sikker på at du vil slette depot?
            </span>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: 7,
                  padding: "8px 17px",
                  fontWeight: 900,
                  fontSize: 14,
                  border: "none"
                }}
                onClick={() => selected && deletePin(selected)}
              >
                Ja, slett
              </button>
              <button
                type="button"
                style={{
                  background: "#f3f4f6",
                  color: "#222",
                  borderRadius: 7,
                  padding: "8px 17px",
                  fontWeight: 900,
                  fontSize: 14,
                  border: "none"
                }}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

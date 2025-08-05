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
  type: "base" | "fueldepot" | "helipad";
  name: string;
  note?: string;
  fullBarrels: number;
  emptyBarrels: number;
  tank: number;
  trailer: number;
  equipment: string[];
  images: string[];
  createdAt?: any;
}

function ensureArray(equipment: string | string[] | undefined): string[] {
  if (!equipment) return [];
  if (Array.isArray(equipment)) return equipment;
  return equipment.split('\n').map(s => s.trim()).filter(Boolean);
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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pins"), (snapshot) => {
      const pinData = snapshot.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          ...data,
          equipment: ensureArray(data.equipment),
        };
      });
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
    const updateData: any = {};
    for (const field in editValues) {
      let value = (editValues as any)[field];
      if (field === "equipment" || field === "newEquipment") continue;
      value = Number(value);
      if (isNaN(value)) continue;
      updateData[field] = value;
    }
    if (editValues.equipment) updateData.equipment = editValues.equipment;
    await updateDoc(doc(db, "pins", pin.id), updateData);
    setEditValues({});
    setEditMode(false);
    const updatedPin = (await getDoc(doc(db, "pins", pin.id))).data();
    if (updatedPin) setSelected({ id: pin.id, ...(updatedPin as Omit<Pin, "id">), equipment: ensureArray(updatedPin.equipment) });
  };

  const adjustBarrels = (
    pin: Pin,
    field: "fullBarrels" | "emptyBarrels",
    delta: number
  ) => {
    let newFull = editValues.fullBarrels ?? pin.fullBarrels;
    let newEmpty = editValues.emptyBarrels ?? pin.emptyBarrels;

    if (field === "fullBarrels") {
      if (delta > 0 && newEmpty > 0) {
        newFull += 1;
        newEmpty -= 1;
      } else if (delta < 0 && newFull > 0) {
        newFull -= 1;
        newEmpty += 1;
      }
    } else {
      if (delta > 0 && newFull > 0) {
        newEmpty += 1;
        newFull -= 1;
      } else if (delta < 0 && newEmpty > 0) {
        newEmpty -= 1;
        newFull += 1;
      }
    }

    newFull = Math.max(0, newFull);
    newEmpty = Math.max(0, newEmpty);

    setEditValues((v) => ({
      ...v,
      fullBarrels: newFull,
      emptyBarrels: newEmpty,
    }));
  };

  // Utstyr: Legg til ny linje
  const addEquipment = () => {
    const trimmed = (editValues.newEquipment || "").trim();
    if (!trimmed) return;
    setEditValues((prev) => ({
      ...prev,
      equipment: [...(prev.equipment || []), trimmed],
      newEquipment: "",
    }));
  };

  // Utstyr: Slett én linje
  const removeEquipment = (idx: number) => {
    setEditValues((prev) => ({
      ...prev,
      equipment: (prev.equipment || []).filter((_: string, i: number) => i !== idx),
    }));
  };

  const flyTo = (pin: Pin) => {
    if (mapRef.current) {
      mapRef.current.panTo({ lat: Number(pin.lat), lng: Number(pin.lng) });
      mapRef.current.setZoom(13);
      setSelected({ ...pin, equipment: ensureArray(pin.equipment) });
      setDropdownOpen(false);
      setEditMode(false);
      setShowDeleteConfirm(false);
      setShowEquip(false);
      setShowNote(false);
    }
  };

  const startEdit = (pin: Pin) => {
    setEditMode(true);
    setEditValues({
      fullBarrels: pin.fullBarrels,
      emptyBarrels: pin.emptyBarrels,
      trailer: pin.trailer,
      tank: pin.tank,
      equipment: ensureArray(pin.equipment),
      newEquipment: "",
    });
    setShowEquip(true);
    setShowNote(true);
  };

  if (!isLoaded) return <p className="text-black font-bold text-xl">Laster kart...</p>;

  return (
    <div className="relative w-full h-screen">
      {/* DEPOTDROPDOWN */}
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
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((pin) => (
                <div
                  key={pin.id}
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-green-100 cursor-pointer"
                  onClick={() => flyTo(pin)}
                >
                  <span className="font-bold text-lg text-black">{pin.name}</span>
                  <span className="ml-auto flex flex-row items-center gap-3">
                    {pin.type === "fueldepot" && (
                      <>
                        <span className="flex flex-row items-center gap-1">
                          <span className="text-xs text-green-600 font-bold">F</span>
                          <span className="underline text-green-600 font-extrabold text-lg">{pin.fullBarrels}</span>
                        </span>
                        <span className="flex flex-row items-center gap-1">
                          <span className="text-xs text-red-600 font-bold">T</span>
                          <span className="underline text-red-600 font-extrabold text-lg">{pin.emptyBarrels}</span>
                        </span>
                      </>
                    )}
                    {pin.type === "helipad" && (
                      <img src="https://maps.google.com/mapfiles/kml/shapes/heliport.png" alt="helipad" style={{ width: 30, height: 30 }} />
                    )}
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
      {/* KART */}
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
            onClick={() => {
              setSelected({ ...pin, equipment: ensureArray(pin.equipment) });
              setEditMode(false);
              setShowDeleteConfirm(false);
              setShowEquip(false);
              setShowNote(false);
            }}
            icon={{
              url:
                pin.type === "base"
                  ? "https://maps.google.com/mapfiles/kml/shapes/heliport.png"
                  : pin.type === "fueldepot"
                    ? (pin.fullBarrels > 2
                        ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                        : "http://maps.google.com/mapfiles/ms/icons/red-dot.png")
                    : "https://maps.google.com/mapfiles/kml/shapes/heliport.png",
              scaledSize: new google.maps.Size(48, 48),
            }}
          />
        ))}
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
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
            options={{
              maxWidth: 350,
              minWidth: 170,
              pixelOffset: new window.google.maps.Size(0, -10),
              disableAutoPan: false,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 10,
                fontSize: 15,
                fontWeight: 700,
                color: "#000",
                minWidth: 140,
                width: "95vw",
                maxWidth: 330,
                wordBreak: "break-word",
                boxShadow: "0 6px 24px rgba(0,0,0,0.14)",
                boxSizing: "border-box",
                maxHeight: "98vh",
                overflowY: "visible",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
              }}
            >
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5,
              }}>
                <span style={{ fontSize: 21, fontWeight: 900 }}>{selected.name || "Uten navn"}</span>
                {editMode ? (
                  <button
                    onClick={() => setEditMode(false)}
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      borderRadius: 6,
                      padding: "6px 13px",
                      fontWeight: 900,
                      fontSize: 14,
                      border: "none"
                    }}
                  >
                    Avslutt
                  </button>
                ) : (
                  <button
                    onClick={() => startEdit(selected)}
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      borderRadius: 6,
                      padding: "6px 13px",
                      fontWeight: 900,
                      fontSize: 14,
                      border: "none"
                    }}
                  >
                    Rediger
                  </button>
                )}
              </div>

              {/* Fulle og tomme fat */}
              {!editMode && (
                <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 4 }}>
                  <div>
                    <span style={{ color: "#059669" }}>Fulle: </span>
                    <b>{selected.fullBarrels}</b>
                  </div>
                  <div>
                    <span style={{ color: "#dc2626" }}>Tomme: </span>
                    <b>{selected.emptyBarrels}</b>
                  </div>
                </div>
              )}

              {/* Henger/tank */}
              {!editMode && (
                <div style={{ fontSize: 14, marginBottom: 2 }}>
                  <div>Henger: <b>{selected.trailer || 0} L</b></div>
                  <div>Tank: <b>{selected.tank || 0} L</b></div>
                </div>
              )}

              {/* Utstyr-liste COLLAPSE */}
              <div style={{ marginTop: 4 }}>
                <button
                  style={{
                    background: "#f3f4f6",
                    border: "none",
                    fontWeight: 800,
                    fontSize: 14,
                    color: "#111",
                    padding: "3px 7px",
                    borderRadius: 5,
                    marginBottom: 2
                  }}
                  onClick={() => setShowEquip((prev) => !prev)}
                >
                  {showEquip ? "−" : "+"} Utstyr
                </button>
                {showEquip && (selected.equipment && selected.equipment.length > 0 ? (
                  <ul style={{ marginTop: 1, marginBottom: 0, fontWeight: 500, fontSize: 14 }}>
                    {selected.equipment.map((eq, i) => (
                      <li key={i}>- {eq}</li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ marginLeft: 7, fontSize: 13 }}>Ingen utstyr registrert</span>
                ))}
              </div>

              {/* Notat COLLAPSE */}
              {selected.note && (
                <div style={{ marginTop: 3 }}>
                  <button
                    style={{
                      background: "#f3f4f6",
                      border: "none",
                      fontWeight: 800,
                      fontSize: 14,
                      color: "#111",
                      padding: "3px 7px",
                      borderRadius: 5,
                      marginBottom: 2
                    }}
                    onClick={() => setShowNote((prev) => !prev)}
                  >
                    {showNote ? "−" : "+"} Notat
                  </button>
                  {showNote && (
                    <div style={{ fontWeight: 500, fontSize: 14, marginLeft: 7 }}>{selected.note}</div>
                  )}
                </div>
              )}

              {/* REDIGERINGSMODUS */}
              {editMode && (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleManualEdit(selected); }}
                  style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 5 }}
                >
                  <div style={{ fontSize: 19, fontWeight: 800, textAlign: "center" }}>
                    {selected.name || "Uten navn"}
                  </div>
                  {/* Fulle */}
                  <div style={{ display: "flex", gap: 9, alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#059669", fontSize: 15, minWidth: 50 }}>Fulle</span>
                    <button
                      type="button"
                      style={{
                        background: "#22c55e",
                        color: "#fff",
                        borderRadius: "50%",
                        width: 40,
                        height: 40,
                        fontSize: 23,
                        border: "none",
                        fontWeight: 800
                      }}
                      onClick={() => adjustBarrels(selected, "fullBarrels", 1)}
                      tabIndex={-1}
                    >+</button>
                    <input
                      type="number"
                      style={{
                        width: 38,
                        textAlign: "center",
                        fontWeight: 800,
                        fontSize: 17
                      }}
                      value={
                        editValues.fullBarrels !== undefined
                          ? (editValues.fullBarrels === 0 ? "" : editValues.fullBarrels)
                          : ""
                      }
                      placeholder="0"
                      onFocus={(e) => {
                        if (e.target.value === "0") {
                          e.target.value = "";
                          setEditValues({ ...editValues, fullBarrels: undefined });
                        }
                      }}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          fullBarrels: Number(e.target.value),
                        })
                      }
                      min={0}
                    />
                    <button
                      type="button"
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: "50%",
                        width: 40,
                        height: 40,
                        fontSize: 23,
                        border: "none",
                        fontWeight: 800
                      }}
                      onClick={() => adjustBarrels(selected, "fullBarrels", -1)}
                      tabIndex={-1}
                    >–</button>
                  </div>
                  {/* Tomme */}
                  <div style={{ display: "flex", gap: 9, alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#dc2626", fontSize: 15, minWidth: 50 }}>Tomme</span>
                    <button
                      type="button"
                      style={{
                        background: "#22c55e",
                        color: "#fff",
                        borderRadius: "50%",
                        width: 40,
                        height: 40,
                        fontSize: 23,
                        border: "none",
                        fontWeight: 800
                      }}
                      onClick={() => adjustBarrels(selected, "emptyBarrels", 1)}
                      tabIndex={-1}
                    >+</button>
                    <input
                      type="number"
                      style={{
                        width: 38,
                        textAlign: "center",
                        fontWeight: 800,
                        fontSize: 17
                      }}
                      value={
                        editValues.emptyBarrels !== undefined
                          ? (editValues.emptyBarrels === 0 ? "" : editValues.emptyBarrels)
                          : ""
                      }
                      placeholder="0"
                      onFocus={(e) => {
                        if (e.target.value === "0") {
                          e.target.value = "";
                          setEditValues({ ...editValues, emptyBarrels: undefined });
                        }
                      }}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          emptyBarrels: Number(e.target.value),
                        })
                      }
                      min={0}
                    />
                    <button
                      type="button"
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: "50%",
                        width: 40,
                        height: 40,
                        fontSize: 23,
                        border: "none",
                        fontWeight: 800
                      }}
                      onClick={() => adjustBarrels(selected, "emptyBarrels", -1)}
                      tabIndex={-1}
                    >–</button>
                  </div>
                  {/* Henger */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Henger (liter):</span>
                    <input
                      type="number"
                      style={{ width: 55, fontWeight: 700, fontSize: 14 }}
                      value={editValues.trailer !== undefined ? (editValues.trailer === 0 ? "" : editValues.trailer) : ""}
                      placeholder="0"
                      onFocus={(e) => {
                        if (e.target.value === "0") {
                          e.target.value = "";
                          setEditValues({ ...editValues, trailer: undefined });
                        }
                      }}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          trailer: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  {/* Tank */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Tank (liter):</span>
                    <input
                      type="number"
                      style={{ width: 55, fontWeight: 700, fontSize: 14 }}
                      value={editValues.tank !== undefined ? (editValues.tank === 0 ? "" : editValues.tank) : ""}
                      placeholder="0"
                      onFocus={(e) => {
                        if (e.target.value === "0") {
                          e.target.value = "";
                          setEditValues({ ...editValues, tank: undefined });
                        }
                      }}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          tank: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  {/* Utstyr */}
                  <div style={{ marginBottom: 4 }}>
                    <span>Utstyr:</span>
                    <div style={{ display: "flex", marginTop: 2, gap: 4 }}>
                      <input
                        type="text"
                        style={{ width: 95, fontWeight: 700, fontSize: 13 }}
                        value={editValues.newEquipment || ""}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            newEquipment: e.target.value,
                          })
                        }
                        placeholder="Legg til utstyr"
                      />
                      <button
                        type="button"
                        style={{
                          background: "#22c55e",
                          color: "#fff",
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontWeight: 800,
                          fontSize: 14,
                          border: "none"
                        }}
                        onClick={addEquipment}
                      >
                        +
                      </button>
                    </div>
                    <ul style={{ marginTop: 3, marginBottom: 0 }}>
                      {(editValues.equipment || []).map((eq, idx) => (
                        <li key={idx} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span>- {eq}</span>
                          <button
                            type="button"
                            style={{
                              background: "#ef4444",
                              color: "#fff",
                              borderRadius: "50%",
                              width: 17,
                              height: 17,
                              fontSize: 11,
                              border: "none",
                              fontWeight: 900,
                              marginLeft: 2,
                              marginTop: -1
                            }}
                            onClick={() => removeEquipment(idx)}
                            title="Slett"
                          >
                            x
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Lagre/slett */}
                  <div style={{ display: "flex", alignItems: "center", marginTop: 7 }}>
                    <button
                      type="submit"
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        borderRadius: 7,
                        padding: "8px 0",
                        fontWeight: 900,
                        fontSize: 15,
                        border: "none",
                        flex: 1,
                        marginRight: 8
                      }}
                    >
                      Lagre
                    </button>
                    <button
                      type="button"
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: 7,
                        padding: "3px 9px",
                        fontWeight: 900,
                        fontSize: 10,
                        border: "none",
                        minWidth: 22,
                        maxWidth: 30,
                        marginLeft: 0
                      }}
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Slett
                    </button>
                  </div>
                </form>
              )}
              {/* Slettebekreftelse-popup */}
              {showDeleteConfirm && (
                <div style={{
                  position: "fixed",
                  left: 0, top: 0, width: "100vw", height: "100vh",
                  background: "rgba(0,0,0,0.14)",
                  zIndex: 99999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <div style={{
                    background: "#fff",
                    borderRadius: 11,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                    padding: 16,
                    minWidth: 200,
                    maxWidth: 280,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center"
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "#dc2626" }}>
                      Er du sikker på at du vil slette depot?
                    </span>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          borderRadius: 7,
                          padding: "6px 14px",
                          fontWeight: 900,
                          fontSize: 12,
                          border: "none"
                        }}
                        onClick={() => deletePin(selected)}
                      >
                        Ja, slett
                      </button>
                      <button
                        type="button"
                        style={{
                          background: "#f3f4f6",
                          color: "#222",
                          borderRadius: 7,
                          padding: "6px 14px",
                          fontWeight: 900,
                          fontSize: 12,
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
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}

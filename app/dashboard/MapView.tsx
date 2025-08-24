import { useEffect, useState, useRef } from "react";
import { GoogleMap, MarkerF, useLoadScript } from "@react-google-maps/api";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import DepotList from "@/components/dashboard/DepotList";
import DepotPopup from "@/components/dashboard/DepotPopup";
import { Pin } from "@/lib/types";

function ensureArray(equipment: string | string[] | undefined): string[] {
  if (!equipment) return [];
  if (Array.isArray(equipment)) return equipment;
  return equipment.split('\n').map(s => s.trim()).filter(Boolean);
}

const center = { lat: 60.472, lng: 8.4689 };
const mapContainerStyle = { width: "100%", height: "100vh" };

const HELIPAD_SVG = `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" role=\"img\" aria-label=\"Helipad\"><circle cx=\"32\" cy=\"32\" r=\"30\" fill=\"#FFD200\" stroke=\"#000000\" stroke-width=\"2\"/><rect x=\"18\" y=\"14\" width=\"8\" height=\"36\" fill=\"#000000\" rx=\"1\"/><rect x=\"38\" y=\"14\" width=\"8\" height=\"36\" fill=\"#000000\" rx=\"1\"/><rect x=\"18\" y=\"29\" width=\"28\" height=\"6\" fill=\"#000000\" rx=\"1\"/></svg>`;
const HELIPAD_ICON_URL = `data:image/svg+xml;utf8,${encodeURIComponent(HELIPAD_SVG)}`;
const FUELFAT_ICON = (color: string) => `data:image/svg+xml;utf8,<svg width='32' height='32' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'><ellipse cx='16' cy='7' rx='10' ry='4' fill='${encodeURIComponent(color)}' stroke='%23222' stroke-width='2'/><rect x='6' y='7' width='20' height='18' rx='6' fill='${encodeURIComponent(color)}' stroke='%23222' stroke-width='2'/><ellipse cx='16' cy='25' rx='10' ry='4' fill='${encodeURIComponent(color)}' stroke='%23222' stroke-width='2'/><rect x='10' y='13' width='12' height='6' rx='2' fill='%23fff' stroke='%23222' stroke-width='1'/><rect x='13' y='15' width='6' height='2' rx='1' fill='%23222' /></svg>`;
function getFuelFatColor(fullBarrels: number) {
  if (fullBarrels > 2) return '#38a169'; // grønn
  if (fullBarrels > 0) return '#FFD600'; // gul
  return '#e53e3e'; // rød
}

function sizeForZoom(zoom: number | undefined, min=24, max=48, zMin=5, zMax=12) {
  if (zoom === undefined || zoom === null) return max;
  if (zoom <= zMin) return min;
  if (zoom >= zMax) return max;
  const t = (zoom - zMin) / (zMax - zMin);
  return Math.round(min + t * (max - min));
}

export default function MapView() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [selected, setSelected] = useState<Pin | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEquip, setShowEquip] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [zoom, setZoom] = useState<number>(6);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [editValues, setEditValues] = useState<Partial<Pin> & { newEquipment?: string }>({});

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pins"), (snapshot) => {
      const pinData = snapshot.docs.map((doc) => {
        const data = doc.data() as Pin;
        return { ...data, id: doc.id };
      });
      setPins(pinData);
    });
    return () => unsub();
  }, []);

  function flyTo(pin: Pin) {
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
  }

  function panMarkerIntoView(map: google.maps.Map, pos: google.maps.LatLngLiteral) {
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    const offsetY = isMobile ? 220 : 160;
    map.panTo(pos);
    setTimeout(() => {
      map.panBy(0, -offsetY);
    }, 0);
  }

  const [addDepotMode, setAddDepotMode] = useState(false);
  // State for nytt depot
  const [newDepot, setNewDepot] = useState<Partial<Pin>>({
    name: "",
    type: "fueldepot",
    lat: 0,
    lng: 0,
  });

  // Når plusstegnet trykkes
  function handleAddDepotClick() {
    setAddDepotMode(true);
    setNewDepot({ name: "", type: "fueldepot", lat: 0, lng: 0 });
  }

  // Når brukeren klikker på kartet i addDepotMode
  function handleMapClickForAddDepot(e: google.maps.MapMouseEvent) {
    if (!addDepotMode || !e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setNewDepot(nd => ({ ...nd, lat, lng }));
    setAddDepotMode(false);
    setShowNewDepotPopup(true);
  }

  // State for å vise popup etter kartklikk
  const [showNewDepotPopup, setShowNewDepotPopup] = useState(false);

  // Når depot lagres fra popup
  function handleSaveNewDepot() {
    const depot: Pin = {
      id: "new",
      lat: newDepot.lat!,
      lng: newDepot.lng!,
      type: newDepot.type as Pin['type'],
      name: newDepot.name || "",
      note: "",
      fullBarrels: 0,
      emptyBarrels: 0,
      tank: 0,
      trailer: 0,
      equipment: [],
      images: [],
      createdAt: Date.now(),
    };
    setSelected(depot);
    setEditMode(true);
    setEditValues(depot);
    setShowNewDepotPopup(false);
  }
  if (!isLoaded) return <p className="text-black font-bold text-xl">Laster kart...</p>;

  const markers = pins.map((pin) => {
    const size = sizeForZoom(zoom);
    let zIndex = 1;
    if (selected && selected.id === pin.id) {
      zIndex = 100;
    } else if (pin.type === "helipad") {
      zIndex = 30;
    } else if (pin.type === "base") {
      zIndex = 20;
    } else if (pin.type === "fueldepot") {
      zIndex = 10;
    }
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
            scaledSize: new window.google.maps.Size(size, size),
            anchor: new window.google.maps.Point(Math.floor(size/2), Math.floor(size/2)),
          }}
          zIndex={zIndex}
        />
      );
    }
    if (pin.type === "fueldepot") {
      const color = getFuelFatColor(pin.fullBarrels);
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
            url: FUELFAT_ICON(color),
            scaledSize: new window.google.maps.Size(size, size),
            anchor: new window.google.maps.Point(Math.floor(size/2), Math.floor(size/2)),
          }}
          zIndex={zIndex}
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
                : "",
          scaledSize: new window.google.maps.Size(size, size),
        }}
        zIndex={zIndex}
      />
    );
  });

  function startEdit(pin: Pin) {
    setEditMode(true);
    setEditValues({ ...pin });
  }
  function minusOneFromFull(pin: Pin) {
    if ((pin.fullBarrels ?? 0) > 0) {
      setEditValues({
        ...editValues,
        fullBarrels: (editValues.fullBarrels ?? pin.fullBarrels) - 1,
        emptyBarrels: (editValues.emptyBarrels ?? pin.emptyBarrels) + 1,
      });
    }
  }
  function addEquipment() {
    setEditValues({
      ...editValues,
      equipment: [...(editValues.equipment ?? []), ""]
    });
  }
  function removeEquipment(idx: number) {
    setEditValues({
      ...editValues,
      equipment: (editValues.equipment ?? []).filter((_, i) => i !== idx)
    });
  }
  function deletePin() {
    if (selected && selected.id) {
      import("firebase/firestore").then(async ({ doc, deleteDoc }) => {
        const { db } = await import("@/lib/firebase");
        await deleteDoc(doc(db, "pins", selected.id));
        setPins(pins => pins.filter(p => p.id !== selected.id));
        setSelected(null);
        setEditMode(false);
        setEditValues({});
      });
    } else {
      setSelected(null);
      setEditMode(false);
      setEditValues({});
    }
  }

  return (
    <div className="relative w-full h-screen">
      <DepotList
        pins={pins}
        dropdownOpen={dropdownOpen}
        setDropdownOpen={setDropdownOpen}
        flyTo={flyTo}
        onAddDepot={handleAddDepotClick}
      />
      {/* Popup for nytt depot etter kartklikk */}
      {showNewDepotPopup && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            padding: typeof window !== 'undefined' && window.innerWidth < 600 ? 12 : 24,
            minWidth: typeof window !== 'undefined' && window.innerWidth < 600 ? 260 : 320,
            maxWidth: typeof window !== 'undefined' && window.innerWidth < 600 ? 340 : 400,
            width: '100%',
          }}
        >
          <h2 style={{ fontSize: typeof window !== 'undefined' && window.innerWidth < 600 ? 20 : 24, fontWeight: 700, marginBottom: 12, color: '#222', letterSpacing: 0.2 }}>Opprett nytt depot</h2>
          <label style={{ fontWeight: 700, color: '#222', fontSize: typeof window !== 'undefined' && window.innerWidth < 600 ? 16 : 18 }}>Navn</label>
          <input
            type="text"
            value={newDepot.name}
            onChange={e => setNewDepot({ ...newDepot, name: e.target.value })}
            style={{ border: '1.5px solid #222', borderRadius: 6, padding: '8px 12px', fontSize: typeof window !== 'undefined' && window.innerWidth < 600 ? 16 : 18, width: '100%', marginBottom: 12, color: '#222', background: '#fff' }}
            placeholder="Navn på depotet"
            autoFocus
          />
          <label style={{ fontWeight: 700, color: '#222', fontSize: typeof window !== 'undefined' && window.innerWidth < 600 ? 16 : 18 }}>Type</label>
          <select
            value={newDepot.type}
            onChange={e => setNewDepot({ ...newDepot, type: e.target.value as Pin['type'] })}
            style={{ border: '1.5px solid #222', borderRadius: 6, padding: '8px 12px', fontSize: typeof window !== 'undefined' && window.innerWidth < 600 ? 16 : 18, width: '100%', marginBottom: 12, color: '#222', background: '#fff' }}
          >
            <option value="fueldepot">Fueldepot</option>
            <option value="base">Base</option>
            <option value="helipad">Helipad</option>
          </select>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button
              style={{ background: '#38a169', color: 'white', padding: typeof window !== 'undefined' && window.innerWidth < 600 ? '8px 16px' : '8px 24px', borderRadius: 6, border: 'none', fontWeight: 'bold', fontSize: typeof window !== 'undefined' && window.innerWidth < 600 ? 16 : 18 }}
              onClick={handleSaveNewDepot}
              disabled={!newDepot.name}
            >
              Lagre
            </button>
            <button
              style={{ background: '#a0aec0', color: 'white', padding: typeof window !== 'undefined' && window.innerWidth < 600 ? '8px 16px' : '8px 24px', borderRadius: 6, border: 'none', fontWeight: 'bold', fontSize: typeof window !== 'undefined' && window.innerWidth < 600 ? 16 : 18 }}
              onClick={() => setShowNewDepotPopup(false)}
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={zoom}
        onLoad={(map) => {
          mapRef.current = map;
          setZoom(map.getZoom() ?? 6);
        }}
        onZoomChanged={() => {
          if (mapRef.current) setZoom(mapRef.current.getZoom() ?? zoom);
        }}
        onClick={e => {
          if (addDepotMode) {
            handleMapClickForAddDepot(e);
          } else {
            // Lukk alle popups hvis bruker klikker på kartet
            setShowNewDepotPopup(false);
            setSelected(null);
            setEditMode(false);
          }
        }}
      >
        {markers}
        {selected && (
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
            minusOneFromFull={minusOneFromFull}
            addEquipment={addEquipment}
            removeEquipment={removeEquipment}
            setShowDeleteConfirm={setShowDeleteConfirm}
            showDeleteConfirm={showDeleteConfirm}
            setSelected={setSelected}
            deletePin={deletePin}
          />
        )}
      </GoogleMap>
    </div>
  );
}

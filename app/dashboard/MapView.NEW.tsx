import { useEffect, useState, useRef } from "react";
import { GoogleMap, MarkerF, useLoadScript } from "@react-google-maps/api";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import DepotList from "@/components/dashboard/DepotList";
import DepotPopup from "@/components/dashboard/DepotPopup";
import { useAddDepot } from "@/components/dashboard/AddDepotHandler";
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

  const { startAddDepot, handleMapClick } = useAddDepot(pins, setPins);

  if (!isLoaded) return <p className="text-black font-bold text-xl">Laster kart...</p>;

  const markers = pins.map((pin) => {
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
            scaledSize: new window.google.maps.Size(size, size),
            anchor: new window.google.maps.Point(Math.floor(size/2), Math.floor(size/2)),
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
                : "",
          scaledSize: new window.google.maps.Size(size, size),
        }}
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
    setSelected(null);
    setEditMode(false);
    setEditValues({});
  }

  return (
    <div className="relative w-full h-screen">
      <DepotList
        pins={pins}
        dropdownOpen={dropdownOpen}
        setDropdownOpen={setDropdownOpen}
        flyTo={flyTo}
        onAddDepot={startAddDepot}
      />
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
        onClick={(e) => handleMapClick(e, setSelected, setEditMode, setEditValues)}
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

"use client";
import { InfoWindowF } from "@react-google-maps/api";

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

interface DepotPopupProps {
  selected: Pin;
  editMode: boolean;
  editValues: Partial<Pin> & { newEquipment?: string };
  setEditMode: (v: boolean) => void;
  setEditValues: (v: Partial<Pin> & { newEquipment?: string }) => void;
  setShowEquip: (v: boolean) => void;
  setShowNote: (v: boolean) => void;
  showEquip: boolean;
  showNote: boolean;
  startEdit: (pin: Pin) => void;
  handleManualEdit: (pin: Pin) => void;
  minusOneFromFull: (pin: Pin) => void;
  removeEquipment: (idx: number) => void;
  // setShowDeleteConfirm: (v: boolean) => void;
  setSelected: (v: Pin | null) => void;
}

export default function DepotPopup(props: DepotPopupProps) {
  
  const { selected } = props;

  const infoWindowOptions = typeof window !== 'undefined' && window.google && window.google.maps
    ? { maxWidth: 370, minWidth: 180, pixelOffset: new window.google.maps.Size(0, -10) }
    : { maxWidth: 370, minWidth: 180 };

  return (
    <InfoWindowF
      position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
  // onCloseClick fjernet, kun 'selected' brukes
      options={infoWindowOptions}
    >
      <div
        style={{
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 6, textAlign: "left", lineHeight: 1.15 }}>
          {selected.name || "Uten navn"}
        </div>
        {/* Her kan du fylle på med mer JSX for popupen */}
      </div>
    </InfoWindowF>
  );
}
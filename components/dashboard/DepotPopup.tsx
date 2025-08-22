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
  addEquipment: () => void;
  removeEquipment: (idx: number) => void;
  setShowDeleteConfirm: (v: boolean) => void;
  setSelected: (v: Pin | null) => void;
  deletePin: (pin: Pin) => void;
}

export default function DepotPopup(props: DepotPopupProps) {
  const {
    selected,
    editMode,
    editValues,
    setEditMode,
    setEditValues,
    setShowEquip,
    setShowNote,
    showEquip,
    showNote,
    startEdit,
    handleManualEdit,
    minusOneFromFull,
    addEquipment,
    removeEquipment,
    setShowDeleteConfirm,
    setSelected,
    deletePin,
  } = props;
  if (!selected) return null;

  return (
    <div style={{ padding: 16, background: 'white', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      <h2 style={{ marginBottom: 8 }}>{selected.name || 'Depot'}</h2>
      <p><b>Type:</b> {selected.type}</p>
      <p><b>Full Barrels:</b> {selected.fullBarrels}</p>
      <p><b>Empty Barrels:</b> {selected.emptyBarrels}</p>
      <p><b>Tank:</b> {selected.tank}</p>
      <p><b>Trailer:</b> {selected.trailer}</p>
      <p><b>Note:</b> {selected.note || '-'}</p>
      <button
        style={{ marginTop: 16, background: '#e53e3e', color: 'white', padding: '8px 16px', borderRadius: 4, border: 'none', fontWeight: 'bold' }}
        onClick={() => deletePin(selected)}
      >
        Slett depot
      </button>
    </div>
  );
}
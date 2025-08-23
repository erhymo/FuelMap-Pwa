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
    <InfoWindowF
      position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
      onCloseClick={() => setSelected(null)}
      options={{ maxWidth: 370, minWidth: 180, pixelOffset: new window.google.maps.Size(0, -10) }}
    >
  <div style={{ padding: 20, background: 'white', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', minWidth: 440, maxWidth: 520 }}>
  <h2 style={{ marginBottom: 18, color: '#222', fontWeight: 'bold', fontSize: 36, textAlign: 'center', letterSpacing: '1px' }}>{selected.name || 'Depot'}</h2>
        {editMode ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              handleManualEdit({ ...selected, ...editValues });
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          >
            {/* Fulle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 18, width: '100%' }}>
              {/* Fulle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%' }}>
                <span style={{ fontSize: 28, fontWeight: 'bold', color: '#222', marginRight: 18, minWidth: 90 }}>Fulle</span>
                <input
                  type="number"
                  value={editValues.fullBarrels ?? selected.fullBarrels}
                  onChange={e => setEditValues({ ...editValues, fullBarrels: Number(e.target.value) })}
                  style={{ width: 80, fontSize: 26, textAlign: 'center', marginRight: 12, background: '#fff', color: '#222', border: '1.5px solid #ccc', borderRadius: 6, height: 48 }}
                />
                <button
                  type="button"
                  style={{ background: '#e53e3e', color: 'white', fontSize: 32, fontWeight: 'bold', borderRadius: 6, border: 'none', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setEditValues({ ...editValues, fullBarrels: Math.max((editValues.fullBarrels ?? selected.fullBarrels) - 1, 0) })}
                >
                  -
                </button>
              </div>
              {/* Tomme */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%' }}>
                <span style={{ fontSize: 28, fontWeight: 'bold', color: '#222', marginRight: 18, minWidth: 90 }}>Tomme</span>
                <input
                  type="number"
                  value={editValues.emptyBarrels ?? selected.emptyBarrels}
                  onChange={e => setEditValues({ ...editValues, emptyBarrels: Number(e.target.value) })}
                  style={{ width: 80, fontSize: 26, textAlign: 'center', marginRight: 12, background: '#fff', color: '#222', border: '1.5px solid #ccc', borderRadius: 6, height: 48 }}
                />
              </div>
            </div>
            {/* Tank */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 18, width: '100%' }}>
              <span style={{ fontSize: 22, fontWeight: 'bold', color: '#222', marginRight: 18, minWidth: 90 }}>Tank</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                value={editValues.tank?.toString().slice(0,5) ?? selected.tank?.toString().slice(0,5) ?? ''}
                onChange={e => setEditValues({ ...editValues, tank: Number(e.target.value.slice(0,5)) })}
                placeholder="Liter"
                style={{ width: 80, fontSize: 22, textAlign: 'center', background: '#fff', color: '#222', border: '1.5px solid #ccc', borderRadius: 6, height: 40 }}
              />
            </div>
            {/* Fuelhenger */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 18, width: '100%' }}>
              <span style={{ fontSize: 22, fontWeight: 'bold', color: '#222', marginRight: 18, minWidth: 90 }}>Fuelhenger</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                value={editValues.trailer?.toString().slice(0,5) ?? selected.trailer?.toString().slice(0,5) ?? ''}
                onChange={e => setEditValues({ ...editValues, trailer: Number(e.target.value.slice(0,5)) })}
                placeholder="Liter"
                style={{ width: 80, fontSize: 22, textAlign: 'center', background: '#fff', color: '#222', border: '1.5px solid #ccc', borderRadius: 6, height: 40 }}
              />
            </div>
            {/* Utstyr */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 18, width: '100%' }}>
              <span style={{ fontSize: 20, fontWeight: 'bold', color: '#222', marginRight: 12 }}>Utstyr</span>
              <input
                type="text"
                value={editValues.note ?? selected.note ?? ''}
                onChange={e => setEditValues({ ...editValues, note: e.target.value })}
                style={{ width: 120, fontSize: 18, textAlign: 'left', background: '#fff', color: '#222', border: '1.5px solid #ccc', borderRadius: 6, height: 40, marginRight: 8 }}
              />
              <button
                type="button"
                style={{ background: '#38a169', color: 'white', fontSize: 24, fontWeight: 'bold', borderRadius: 6, border: 'none', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => {/* Her kan du legge til utstyr i en liste */}}
              >
                +
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
              <button
                type="submit"
                style={{ background: '#38a169', color: 'white', padding: '8px 16px', borderRadius: 4, border: 'none', fontWeight: 'bold', fontSize: 18 }}
              >
                Lagre
              </button>
              <button
                type="button"
                style={{ background: '#a0aec0', color: 'white', padding: '8px 16px', borderRadius: 4, border: 'none', fontWeight: 'bold', fontSize: 18 }}
                onClick={() => { setEditMode(false); setEditValues({}); }}
              >
                Avbryt
              </button>
            </div>
          </form>
        ) : (
          <>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Type:</b> <span style={{ color: '#444' }}>{selected.type}</span></p>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Fulle:</b> <span style={{ color: '#444' }}>{selected.fullBarrels}</span></p>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Tomme:</b> <span style={{ color: '#444' }}>{selected.emptyBarrels}</span></p>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Tank:</b> <span style={{ color: '#444' }}>{selected.tank}</span></p>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Fuelhenger:</b> <span style={{ color: '#444' }}>{selected.trailer}</span></p>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Utstyr:</b> <span style={{ color: '#444' }}>{selected.note || '-'}</span></p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                style={{ background: '#3182ce', color: 'white', padding: '8px 16px', borderRadius: 4, border: 'none', fontWeight: 'bold', fontSize: 18 }}
                onClick={() => setEditMode(true)}
              >
                Rediger
              </button>
              <button
                style={{ background: '#e53e3e', color: 'white', padding: '8px 16px', borderRadius: 4, border: 'none', fontWeight: 'bold', fontSize: 18 }}
                onClick={() => deletePin(selected)}
              >
                Slett depot
              </button>
            </div>
          </>
        )}
      </div>
    </InfoWindowF>
  );
}
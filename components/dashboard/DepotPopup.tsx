"use client";
import React from "react";
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
  minusOneFromFull: (pin: Pin) => void;
  addEquipment: () => void;
  removeEquipment: (idx: number) => void;
  setShowDeleteConfirm: (v: boolean) => void;
  showDeleteConfirm: boolean;
  setSelected: (v: Pin | null) => void;
  deletePin: (pin: Pin) => void;
}

export default function DepotPopup(props: DepotPopupProps) {
  const { selected, editMode, editValues, setEditMode, setEditValues, setSelected, deletePin, showDeleteConfirm, setShowDeleteConfirm } = props;
  const [showAllEquipment, setShowAllEquipment] = React.useState(false);
  const [equipmentInputs, setEquipmentInputs] = React.useState(editValues.equipment ? editValues.equipment.map(e => e) : selected.equipment ? selected.equipment.map(e => e) : []);

  React.useEffect(() => {
    if (editMode) {
      setEquipmentInputs(editValues.equipment ? [...editValues.equipment] : selected.equipment ? [...selected.equipment] : []);
    }
  }, [editMode, selected, editValues.equipment]);
  if (!selected) return null;
  return (
    <InfoWindowF
      position={{ lat: selected.lat, lng: selected.lng }}
      onCloseClick={() => setSelected(null)}
      options={{ maxWidth: 520 }}
    >
      <div
        style={{
          padding: 20,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          minWidth: 'min(98vw, 340px)',
          maxWidth: 'min(98vw, 520px)',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Depot name, centered (always visible) */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 28, fontWeight: 'bold', color: '#222' }}>{editMode ? (editValues.name ?? selected.name) : selected.name}</span>
        </div>
        {editMode ? (
          <form
            onSubmit={async e => {
              e.preventDefault();
              const newValues = {
                ...editValues,
                equipment: equipmentInputs.filter(e => e.trim() !== ""),
                tank: editValues.tank !== undefined ? Number(editValues.tank) : selected.tank,
                trailer: editValues.trailer !== undefined ? Number(editValues.trailer) : selected.trailer,
              };
              try {
                const { id, ...rest } = { ...selected, ...newValues };
                const { doc, updateDoc, addDoc, collection } = await import("firebase/firestore");
                const { db } = await import("@/lib/firebase");
                if (id === "new") {
                  // Opprett nytt depot
                  const docRef = await addDoc(collection(db, "pins"), rest);
                  if (props.setSelected) {
                    props.setSelected({ ...rest, id: docRef.id });
                  }
                } else {
                  // Oppdater eksisterende depot
                  await updateDoc(doc(db, "pins", id), rest);
                  if (props.setSelected) {
                    props.setSelected({ ...selected, ...newValues });
                  }
                }
              } catch (err) {
                console.error("Kunne ikke lagre depot", err);
              }
              setEditMode(false);
              setEditValues({});
            }}
          >
            {/* Typevalg dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 18, width: '100%' }}>
              <span style={{ fontSize: 22, fontWeight: 'bold', color: '#222', marginRight: 18, minWidth: 90 }}>Type</span>
              <select
                value={editValues.type ?? selected.type}
                onChange={e => setEditValues({ ...editValues, type: e.target.value as Pin['type'] })}
                style={{ fontSize: 20, padding: '6px 12px', borderRadius: 6, border: '1.5px solid #ccc', background: '#fff', color: '#222', minWidth: 120 }}
              >
                <option value="fueldepot">Fueldepot</option>
                <option value="base">Base</option>
                <option value="helipad">Helipad</option>
              </select>
            </div>
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
                  onClick={() => {
                    const currentFull = editValues.fullBarrels ?? selected.fullBarrels;
                    const currentEmpty = editValues.emptyBarrels ?? selected.emptyBarrels;
                    if (currentFull > 0) {
                      setEditValues({
                        ...editValues,
                        fullBarrels: currentFull - 1,
                        emptyBarrels: currentEmpty + 1,
                      });
                    }
                  }}
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
                type="number"
                maxLength={5}
                value={editValues.tank ?? selected.tank}
                onChange={e => setEditValues({ ...editValues, tank: Number(e.target.value) })}
                placeholder=""
                style={{ width: 80, fontSize: 22, textAlign: 'center', background: '#fff', color: '#222', border: '1.5px solid #ccc', borderRadius: 6, height: 40 }}
              />
              <span style={{ fontSize: 18, color: '#222', marginLeft: 8 }}>Liter</span>
            </div>
            {/* Fuelhenger */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 18, width: '100%' }}>
              <span style={{ fontSize: 22, fontWeight: 'bold', color: '#222', marginRight: 18, minWidth: 90 }}>Fuelhenger</span>
              <input
                type="number"
                maxLength={5}
                value={editValues.trailer ?? selected.trailer}
                onChange={e => setEditValues({ ...editValues, trailer: Number(e.target.value) })}
                placeholder=""
                style={{ width: 80, fontSize: 22, textAlign: 'center', background: '#fff', color: '#222', border: '1.5px solid #ccc', borderRadius: 6, height: 40 }}
              />
              <span style={{ fontSize: 18, color: '#222', marginLeft: 8 }}>Liter</span>
            </div>
            {/* Utstyr */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 18, width: '100%' }}>
              <span style={{ fontSize: 20, fontWeight: 'bold', color: '#222', marginRight: 12 }}>Utstyr</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                {equipmentInputs.map((eq, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={eq}
                    onChange={e => {
                      const newInputs = [...equipmentInputs];
                      newInputs[idx] = e.target.value;
                      setEquipmentInputs(newInputs);
                    }}
                    style={{ width: '100%', fontSize: 18, textAlign: 'left', background: '#fff', color: '#222', border: '1.5px solid #ccc', borderRadius: 6, height: 40, marginBottom: 2 }}
                  />
                ))}
                <button
                  type="button"
                  style={{ background: '#38a169', color: 'white', fontSize: 24, fontWeight: 'bold', borderRadius: 6, border: 'none', width: 40, height: 40, marginTop: 4, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setEquipmentInputs([...equipmentInputs, ""])}
                >
                  +
                </button>
              </div>
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
                style={{ background: '#a0aec0', color: 'white', padding: '4px 8px', borderRadius: 4, border: 'none', fontWeight: 'bold', fontSize: 18, minWidth: 60 }}
                onClick={() => { setEditMode(false); setEditValues({}); }}
              >
                Avbryt
              </button>
              <button
                type="button"
                style={{ background: '#e53e3e', color: 'white', padding: '4px 8px', borderRadius: 4, border: 'none', fontWeight: 'bold', fontSize: 14, minWidth: 32 }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Slett depot
              </button>
        {showDeleteConfirm && (
          <div style={{ position: 'absolute', top: 40, left: 0, right: 0, margin: 'auto', background: '#fff', border: '2px solid #e53e3e', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', padding: 18, zIndex: 1000, maxWidth: 320, textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', color: '#e53e3e', fontSize: 18, marginBottom: 12 }}>Er du helt sikker på at du vil slette depotet?</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                style={{ background: '#e53e3e', color: 'white', padding: '6px 16px', borderRadius: 4, border: 'none', fontWeight: 'bold', fontSize: 16 }}
                onClick={() => { deletePin(selected); setShowDeleteConfirm(false); }}
              >
                Slett
              </button>
              <button
                style={{ background: '#a0aec0', color: 'white', padding: '6px 16px', borderRadius: 4, border: 'none', fontWeight: 'bold', fontSize: 16 }}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
            </div>
          </form>
        ) : (
          <>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Type:</b> <span style={{ color: '#444' }}>{selected.type}</span></p>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Fulle:</b> <span style={{ color: '#444' }}>{selected.fullBarrels}</span></p>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Tomme:</b> <span style={{ color: '#444' }}>{selected.emptyBarrels}</span></p>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Tank:</b> <span style={{ color: '#444' }}>{selected.tank}</span></p>
            <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Fuelhenger:</b> <span style={{ color: '#444' }}>{selected.trailer}</span></p>
            <div style={{ margin: '4px 0', width: '100%' }}>
              <b style={{ color: '#222', fontSize: 16 }}>Utstyr:</b>
              {(selected.equipment && selected.equipment.length > 0) ? (
                <>
                  {(showAllEquipment ? selected.equipment : selected.equipment.slice(0, 3)).map((eq, idx) => (
                    <div key={idx} style={{ color: '#444', fontSize: 16, margin: '2px 0', textAlign: 'left' }}>{eq}</div>
                  ))}
                  {selected.equipment.length > 3 && (
                    <button
                      type="button"
                      style={{ background: '#3182ce', color: 'white', fontSize: 14, borderRadius: 4, border: 'none', padding: '2px 8px', marginTop: 2 }}
                      onClick={() => setShowAllEquipment(v => !v)}
                    >
                      {showAllEquipment ? 'Vis mindre' : `Vis alle (${selected.equipment.length})`}
                    </button>
                  )}
                </>
              ) : (
                <span style={{ color: '#444', fontSize: 16, marginLeft: 8 }}>Ingen</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                style={{ background: '#3182ce', color: 'white', padding: '8px 16px', borderRadius: 4, border: 'none', fontWeight: 'bold', fontSize: 18 }}
                onClick={() => setEditMode(true)}
              >
                Rediger
              </button>
            </div>
          </>
        )}
      </div>
    </InfoWindowF>
  );
}
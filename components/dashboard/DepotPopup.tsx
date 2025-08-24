"use client";
import React from "react";
import EquipmentPopup from "./EquipmentPopup";
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
  const [showEquipmentPopup, setShowEquipmentPopup] = React.useState(false);
  const [equipmentInputs, setEquipmentInputs] = React.useState(editValues.equipment ? [...editValues.equipment] : selected.equipment ? [...selected.equipment] : []);

  React.useEffect(() => {
    if (editMode) {
      setEquipmentInputs(editValues.equipment ? [...editValues.equipment] : selected.equipment ? [...selected.equipment] : []);
    }
  }, [editMode, selected, editValues.equipment]);
  if (!selected) return null;
  return (
    <React.Fragment>
      <InfoWindowF
        position={{ lat: selected.lat, lng: selected.lng }}
        onCloseClick={() => setSelected(null)}
        options={{
          maxWidth: typeof window !== 'undefined' && window.innerWidth < 600 ? 420 : 520,
          pixelOffset: new window.google.maps.Size(0, typeof window !== 'undefined' && window.innerWidth < 600 ? 40 : 80)
        }}
      >
        <div
          style={{
            padding: typeof window !== 'undefined' && window.innerWidth < 600 ? 2 : 12,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            minWidth: typeof window !== 'undefined' && window.innerWidth < 600 ? 'min(98vw, 180px)' : 'min(98vw, 320px)',
            maxWidth: typeof window !== 'undefined' && window.innerWidth < 600 ? 'min(98vw, 340px)' : 'min(98vw, 480px)',
            width: '100%',
            maxHeight: typeof window !== 'undefined' && window.innerWidth < 600 ? 'none' : 'calc(100vh - 32px)',
            boxSizing: 'border-box',
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: typeof window !== 'undefined' && window.innerWidth < 600 ? 12 : undefined,
            zIndex: 99999,
            marginTop: typeof window !== 'undefined' && window.innerWidth < 600 ? 16 : 32,
          }}
        >
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                  const { addLog } = await import("@/lib/log");
                  let employeeName = "Ukjent";
                  if (typeof window !== "undefined") {
                    try {
                      const session = localStorage.getItem("fuelmap_session");
                      if (session) {
                        const obj = JSON.parse(session);
                        if (obj.employeeName) employeeName = obj.employeeName;
                      }
                    } catch {}
                  }
                  if (id === "new") {
                    // Opprett nytt depot
                    const docRef = await addDoc(collection(db, "pins"), rest);
                    await addLog(`Opprettet depot: ${rest.name}`, undefined, employeeName);
                    if (props.setSelected) {
                      props.setSelected({ ...rest, id: docRef.id });
                    }
                  } else {
                    // Oppdater eksisterende depot
                    await updateDoc(doc(db, "pins", id), rest);
                    await addLog(`Endret depot: ${rest.name}`, undefined, employeeName);
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
              {/* Fjerner type/base-valg for bedre plass */}
              {/* Fulle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 18, width: '100%' }}>
                {/* Fulle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', width: '100%' }}>
                  <span style={{ fontSize: 28, fontWeight: 'bold', color: '#222', marginRight: 18, minWidth: 90 }}>Fulle</span>
                  <input
                    type="number"
                    value={(editValues.fullBarrels ?? selected.fullBarrels) === 0 ? '' : (editValues.fullBarrels ?? selected.fullBarrels)}
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
                    value={(editValues.emptyBarrels ?? selected.emptyBarrels) === 0 ? '' : (editValues.emptyBarrels ?? selected.emptyBarrels)}
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
                  value={(editValues.tank ?? selected.tank) === 0 ? '' : (editValues.tank ?? selected.tank)}
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
                  value={(editValues.trailer ?? selected.trailer) === 0 ? '' : (editValues.trailer ?? selected.trailer)}
                  onChange={e => setEditValues({ ...editValues, trailer: Number(e.target.value) })}
                  placeholder=""
                  style={{ width: 80, fontSize: 22, textAlign: 'center', background: '#fff', color: '#222', border: '1.5px solid #ccc', borderRadius: 6, height: 40 }}
                />
                <span style={{ fontSize: 18, color: '#222', marginLeft: 8 }}>Liter</span>
              </div>
              {/* Utstyr kun tekst og plusstegn */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 18, width: '100%' }}>
                <span style={{ fontSize: 20, fontWeight: 'bold', color: '#222', marginRight: 12 }}>Utstyr</span>
                <button
                  type="button"
                  style={{ background: '#38a169', color: 'white', fontSize: 24, fontWeight: 'bold', borderRadius: 6, border: 'none', width: 40, height: 40, marginLeft: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setShowEquipmentPopup(true)}
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
                  onClick={async () => {
                    try {
                      const { addLog } = await import("@/lib/log");
                      let employeeName = "Ukjent";
                      if (typeof window !== "undefined") {
                        try {
                          const session = localStorage.getItem("fuelmap_session");
                          if (session) {
                            const obj = JSON.parse(session);
                            if (obj.employeeName) employeeName = obj.employeeName;
                          }
                        } catch {}
                      }
                      await addLog(`Slettet depot: ${selected.name}`, undefined, employeeName);
                    } catch (err) {
                      console.error("Kunne ikke logge sletting", err);
                    }
                    deletePin(selected); setShowDeleteConfirm(false);
                  }}
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
              <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Fulle:</b> <span style={{ color: '#444' }}>{selected.fullBarrels}</span></p>
              <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Tomme:</b> <span style={{ color: '#444' }}>{selected.emptyBarrels}</span></p>
              <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Tank:</b> <span style={{ color: '#444' }}>{selected.tank}</span></p>
              <p style={{ color: '#222', fontSize: 16, margin: '4px 0' }}><b>Fuelhenger:</b> <span style={{ color: '#444' }}>{selected.trailer}</span></p>
              {/* Utstyr vises kun i info-popupen, ikke i redigerings-popupen */}
              <div style={{ width: '100%', textAlign: 'center', margin: '12px 0 0 0', padding: '8px 0', background: '#f7fafc', borderRadius: 8 }}>
                <b style={{ color: '#222', fontSize: 17 }}>Utstyr</b>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  {(selected.equipment && selected.equipment.length > 0) ? (
                    selected.equipment.map((eq, idx) => (
                      <div key={idx} style={{ color: '#444', fontSize: 16, margin: '2px 0', textAlign: 'center', background: '#edf2f7', borderRadius: 4, padding: '2px 8px', minWidth: 80 }}>{eq}</div>
                    ))
                  ) : (
                    <span style={{ color: '#888', fontSize: 15, textAlign: 'center', display: 'inline-block', marginTop: 2 }}>Ingen</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
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
      </div>
      </InfoWindowF>
      {showEquipmentPopup && (
        <EquipmentPopup
          equipment={equipmentInputs}
          onSave={eqs => setEquipmentInputs(eqs)}
          onClose={() => setShowEquipmentPopup(false)}
        />
      )}
    </React.Fragment>
  );
}
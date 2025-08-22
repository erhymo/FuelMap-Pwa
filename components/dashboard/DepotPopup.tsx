
'use client';
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
  createdAt?: any;
}

type DepotPopupProps = {
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
  deletePin: (pin: Pin) => void;
  setSelected: (v: Pin | null) => void;
};

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
    deletePin,
    setSelected,
  } = props;

  return (
    <InfoWindowF
      position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
      onCloseClick={() => setSelected(null)}
      options={{ maxWidth: 370, minWidth: 180, pixelOffset: new window.google.maps.Size(0, -10) }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 10,
          fontSize: 15,
          fontWeight: 700,
          color: "#000",
          minWidth: 200,
          width: "96vw",
          maxWidth: 370,
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
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 6, textAlign: "left", lineHeight: 1.15 }}>
          {selected.name || "Uten navn"}
        </div>
        {!editMode ? (
          <div style={{ width: "100%", display: "flex", justifyContent: "flex-start", marginBottom: 6 }}>
            <button
              onClick={() => {
                setShowEquip(false);
                setShowNote(false);
                startEdit(selected);
              }}
              style={{
                background: "#2563eb",
                color: "#fff",
                borderRadius: 6,
                padding: "6px 14px",
                fontWeight: 900,
                fontSize: 15,
                border: "none",
              }}
            >
              Rediger
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <button
              onClick={() => setEditMode(false)}
              style={{
                background: "#2563eb",
                color: "#fff",
                borderRadius: 6,
                padding: "6px 16px",
                fontWeight: 900,
                fontSize: 15,
                border: "none",
              }}
            >
              Avslutt
            </button>
          </div>
        )}
        {!editMode && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ color: "#059669", fontSize: 19, fontWeight: 800 }}>Fulle:</span>
              <span style={{ fontWeight: 900, fontSize: 26 }}>{selected.fullBarrels}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ color: "#dc2626", fontSize: 19, fontWeight: 800 }}>Tomme:</span>
              <span style={{ fontWeight: 900, fontSize: 26 }}>{selected.emptyBarrels}</span>
            </div>
            <div style={{ fontSize: 16, marginBottom: 8, textAlign: "left", lineHeight: 1.2 }}>
              <div>Henger (liter): <b>{selected.trailer || 0}</b></div>
              <div>Tank (liter): <b>{selected.tank || 0}</b></div>
            </div>
          </>
        )}
        {editMode && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleManualEdit(selected); }}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ color: "#059669", fontSize: 18, fontWeight: 800 }}>Fulle</span>
                <span style={{ fontSize: 28, fontWeight: 900 }}>
                  {(editValues.fullBarrels ?? selected.fullBarrels) || 0}
                </span>
              </div>
              <button
                type="button"
                aria-label="Trekk fra ett fullt fat og legg til ett tomt"
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: 8,
                  width: 44,
                  height: 44,
                  fontSize: 28,
                  border: "none",
                  fontWeight: 900
                }}
                onClick={() => minusOneFromFull(selected)}
              >
                –
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#dc2626", fontSize: 18, fontWeight: 800 }}>Tomme</span>
              <span style={{ fontSize: 28, fontWeight: 900 }}>
                {(editValues.emptyBarrels ?? selected.emptyBarrels) || 0}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>Henger (liter):</span>
              <input
                type="number"
                style={{ width: 80, fontWeight: 800, fontSize: 16 }}
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>Tank (liter):</span>
              <input
                type="number"
                style={{ width: 80, fontWeight: 800, fontSize: 16 }}
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
            {/* Utstyr COLLAPSE (nederst) */}
            <div>
              <button
                type="button"
                style={{
                  background: "#f3f4f6",
                  border: "none",
                  fontWeight: 800,
                  fontSize: 15,
                  color: "#111",
                  padding: "6px 10px",
                  borderRadius: 6,
                  marginBottom: 6
                }}
                onClick={() => setShowEquip(!showEquip)}
              >
                {showEquip ? "−" : "+"} Utstyr
              </button>
              {showEquip && (
                <>
                  <div style={{ display: "flex", marginTop: 6, gap: 6 }}>
                    <input
                      type="text"
                      style={{ flex: 1, fontWeight: 700, fontSize: 14 }}
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
                        padding: "4px 10px",
                        fontWeight: 800,
                        fontSize: 16,
                        border: "none"
                      }}
                      onClick={addEquipment}
                    >
                      +
                    </button>
                  </div>
                  <ul style={{ marginTop: 6, marginBottom: 0 }}>
                    {(editValues.equipment || []).map((eq, idx) => (
                      <li key={idx} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14 }}>
                        <span>- {eq}</span>
                        <button
                          type="button"
                          style={{
                            background: "#ef4444",
                            color: "#fff",
                            borderRadius: "50%",
                            width: 18,
                            height: 18,
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
                </>
              )}
            </div>
            {/* Notat COLLAPSE helt nederst */}
            <div>
              <button
                type="button"
                style={{
                  background: "#f3f4f6",
                  border: "none",
                  fontWeight: 800,
                  fontSize: 15,
                  color: "#111",
                  padding: "6px 10px",
                  borderRadius: 6,
                  marginBottom: 6
                }}
                onClick={() => setShowNote(!showNote)}
              >
                {showNote ? "−" : "+"} Notat
              </button>
              {showNote && (
                <input
                  type="text"
                  style={{ width: "100%", fontWeight: 700, fontSize: 15, marginTop: 6 }}
                  value={editValues.note !== undefined ? editValues.note : (selected.note || "")}
                  onChange={e => setEditValues({ ...editValues, note: e.target.value })}
                  placeholder="Legg til eller endre notat"
                />
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 12, gap: 10 }}>
              <button
                type="submit"
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "14px 0",
                  fontWeight: 900,
                  fontSize: 16,
                  border: "none",
                  flex: 1,
                  height: 48
                }}
              >
                Lagre
              </button>
              <button
                type="button"
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "12px 0",
                  fontWeight: 900,
                  fontSize: 14,
                  border: "none",
                  width: 120,
                  height: 44
                }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Slett
              </button>
            </div>
          </form>
        )}
      </div>
    </InfoWindowF>
  );
}

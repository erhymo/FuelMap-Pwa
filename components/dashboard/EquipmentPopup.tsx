import React, { useState } from "react";

interface EquipmentPopupProps {
  equipment: string[];
  onSave: (equipment: string[]) => void;
  onClose: () => void;
}

export default function EquipmentPopup({ equipment, onSave, onClose }: EquipmentPopupProps) {
  const [inputs, setInputs] = useState<string[]>(equipment.length ? [...equipment] : [""]);

  const handleChange = (idx: number, value: string) => {
    const newInputs = [...inputs];
    newInputs[idx] = value;
    setInputs(newInputs);
  };

  const handleAdd = () => {
    setInputs([...inputs, ""]);
  };

  const handleRemove = (idx: number) => {
    setInputs(inputs.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave(inputs.filter(e => e.trim() !== ""));
    onClose();
  };

  // Sjekk om mobil (bredde < 600)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.18)",
      zIndex: 999999,
      display: "flex",
      alignItems: isMobile ? "flex-end" : "center",
      justifyContent: "center"
    }}>
      <div style={{
        background: "white",
        borderRadius: isMobile ? "24px 24px 0 0" : 12,
        boxShadow: "0 4px 32px rgba(0,0,0,0.22)",
        padding: isMobile ? 16 : 24,
        minWidth: isMobile ? '100vw' : 280,
        maxWidth: isMobile ? '100vw' : 340,
        width: isMobile ? '100vw' : '100%',
        maxHeight: isMobile ? '60vh' : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        <div style={{ fontWeight: "bold", fontSize: 24, marginBottom: 16, color: "#222", textShadow: "0 1px 4px #fff, 0 0 2px #222" }}>Legg til utstyr</div>
        {inputs.map((eq, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", width: "100%", marginBottom: 8 }}>
            <input
              type="text"
              value={eq}
              onChange={e => handleChange(idx, e.target.value)}
              style={{ flex: 1, fontSize: 20, fontWeight: "bold", color: "#222", background: "#fff", borderRadius: 6, border: "2px solid #222", padding: "10px 14px", marginRight: 8, boxShadow: "0 1px 4px #eee" }}
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              style={{ background: "#e53e3e", color: "white", border: "none", borderRadius: 6, width: 32, height: 32, fontSize: 20, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              -
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={handleAdd}
            style={{ background: "#3182ce", color: "white", borderRadius: 6, border: "none", padding: "8px 16px", fontWeight: "bold", fontSize: 16 }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{ background: "#38a169", color: "white", borderRadius: 6, border: "none", padding: "8px 16px", fontWeight: "bold", fontSize: 16 }}
          >
            Lagre
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "#a0aec0", color: "white", borderRadius: 6, border: "none", padding: "8px 16px", fontWeight: "bold", fontSize: 16 }}
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

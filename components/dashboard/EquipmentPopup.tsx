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

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.18)",
      zIndex: 100000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        background: "white",
        borderRadius: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        padding: 24,
        minWidth: 280,
        maxWidth: 340,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        <div style={{ fontWeight: "bold", fontSize: 22, marginBottom: 12 }}>Legg til utstyr</div>
        {inputs.map((eq, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", width: "100%", marginBottom: 8 }}>
            <input
              type="text"
              value={eq}
              onChange={e => handleChange(idx, e.target.value)}
              style={{ flex: 1, fontSize: 18, borderRadius: 6, border: "1.5px solid #ccc", padding: "8px 12px", marginRight: 8 }}
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

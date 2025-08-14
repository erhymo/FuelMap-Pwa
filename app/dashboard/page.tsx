"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow
} from "@react-google-maps/api";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { FaHelicopter } from "react-icons/fa";
import { IoChevronDown, IoChevronUp } from "react-icons/io5";
import { collection, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/firebase";

const containerStyle = {
  width: "100%",
  height: "100vh"
};

const center = {
  lat: 60.472,
  lng: 8.4689
};

const getIcon = (type: string, fulleFat: number) => {
  if (type === "helipad") {
    return {
      url: "/helipadIcon.svg",
      scaledSize: new window.google.maps.Size(40, 40)
    };
  }
  if (type === "fueldepot") {
    return {
      url: fulleFat <= 2 ? "/redMarker.svg" : "/greenMarker.svg",
      scaledSize: new window.google.maps.Size(40, 40)
    };
  }
  return {
    url: "/blueMarker.svg",
    scaledSize: new window.google.maps.Size(40, 40)
  };
};

export default function DashboardPage() {
  const [depots, setDepots] = useState<any[]>([]);
  const [selectedDepot, setSelectedDepot] = useState<any>(null);
  const [showNote, setShowNote] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    const fetchDepots = async () => {
      const querySnapshot = await getDocs(collection(db, "depots"));
      const depotList: any[] = [];
      querySnapshot.forEach((doc) => {
        depotList.push({ id: doc.id, ...doc.data() });
      });
      setDepots(depotList);
    };
    fetchDepots();
  }, []);

  const handleMinusFull = async () => {
    if (!selectedDepot) return;
    if (selectedDepot.fulleFat > 0) {
      const updatedDepot = {
        ...selectedDepot,
        fulleFat: selectedDepot.fulleFat - 1,
        tommeFat: (selectedDepot.tommeFat || 0) + 1
      };
      setSelectedDepot(updatedDepot);
      await updateDoc(doc(db, "depots", selectedDepot.id), updatedDepot);
    }
  };

  const handleSave = async () => {
    if (!selectedDepot) return;
    await updateDoc(doc(db, "depots", selectedDepot.id), selectedDepot);
    setSelectedDepot(null);
  };

  const handleDelete = async () => {
    if (!selectedDepot) return;
    await deleteDoc(doc(db, "depots", selectedDepot.id));
    setDepots(depots.filter((d) => d.id !== selectedDepot.id));
    setSelectedDepot(null);
    setConfirmDelete(false);
  };

  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={5}
        onLoad={(map) => (mapRef.current = map)}
      >
        {depots.map((depot) => (
          <Marker
            key={depot.id}
            position={depot.position}
            icon={getIcon(depot.type, depot.fulleFat)}
            onClick={() => {
              setSelectedDepot(depot);
              if (mapRef.current) {
                mapRef.current.panTo(depot.position);
                mapRef.current.setZoom(10);
              }
            }}
          />
        ))}

        {selectedDepot && (
          <InfoWindow
            position={selectedDepot.position}
            onCloseClick={() => setSelectedDepot(null)}
          >
            <div style={{ width: "250px", fontSize: "14px", fontWeight: "bold", color: "#000" }}>
              <h3>{selectedDepot.name}</h3>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Fulle fat: {selectedDepot.fulleFat}</span>
                <button
                  onClick={handleMinusFull}
                  style={{
                    background: "#ccc",
                    border: "none",
                    padding: "4px 8px",
                    fontSize: "16px",
                    cursor: "pointer"
                  }}
                >
                  −
                </button>
              </div>
              <div>Tomme fat: {selectedDepot.tommeFat}</div>

              {/* Collapse for Equipment */}
              <div style={{ marginTop: "8px" }}>
                <div
                  onClick={() => setShowEquipment(!showEquipment)}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  <strong>Utstyr</strong>
                  {showEquipment ? <IoChevronUp /> : <IoChevronDown />}
                </div>
                {showEquipment && (
                  <div>
                    {(selectedDepot.utstyr || []).map((item: string, idx: number) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{item}</span>
                        <button
                          onClick={() => {
                            const updated = { ...selectedDepot, utstyr: selectedDepot.utstyr.filter((_: any, i: number) => i !== idx) };
                            setSelectedDepot(updated);
                          }}
                          style={{ background: "red", color: "#fff", border: "none", padding: "2px 6px" }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <input
                      type="text"
                      placeholder="Legg til utstyr"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim() !== "") {
                          const updated = {
                            ...selectedDepot,
                            utstyr: [...(selectedDepot.utstyr || []), e.currentTarget.value.trim()]
                          };
                          setSelectedDepot(updated);
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Collapse for Note */}
              <div style={{ marginTop: "8px" }}>
                <div
                  onClick={() => setShowNote(!showNote)}
                  style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  <strong>Notat</strong>
                  {showNote ? <IoChevronUp /> : <IoChevronDown />}
                </div>
                {showNote && (
                  <textarea
                    value={selectedDepot.notat || ""}
                    onChange={(e) =>
                      setSelectedDepot({ ...selectedDepot, notat: e.target.value })
                    }
                    rows={3}
                    style={{ width: "100%" }}
                  />
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                <button
                  onClick={handleSave}
                  style={{ background: "green", color: "#fff", border: "none", padding: "6px 12px" }}
                >
                  Lagre
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ background: "red", color: "#fff", border: "none", padding: "6px 12px" }}
                >
                  Slett
                </button>
              </div>

              {confirmDelete && (
                <div style={{ marginTop: "8px", background: "#eee", padding: "8px" }}>
                  <p>Er du sikker på at du vil slette?</p>
                  <button
                    onClick={handleDelete}
                    style={{ background: "red", color: "#fff", border: "none", padding: "4px 8px", marginRight: "4px" }}
                  >
                    Ja
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{ background: "#ccc", border: "none", padding: "4px 8px" }}
                  >
                    Nei
                  </button>
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </LoadScript>
  );
}

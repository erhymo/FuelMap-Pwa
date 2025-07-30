'use client';

import {
  GoogleMap,
  MarkerF,
  InfoWindowF,
  useLoadScript,
} from '@react-google-maps/api';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useCallback, useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Hjelpefunksjon for logging av alle handlinger:
async function logAction(action: string, details?: string) {
  const sessionStr = typeof window !== "undefined" ? localStorage.getItem("fuelmap_session") : null;
  const user = sessionStr ? JSON.parse(sessionStr) : null;
  if (user) {
    await addDoc(collection(db, "logs"), {
      name: user.name,
      pin: user.pin,
      action,
      details: details || "",
      timestamp: serverTimestamp(),
    });
  }
}

const center = { lat: 60.472, lng: 8.4689 };
const mapContainerStyle = { width: '100%', height: '100vh' };

export default function MapView() {
  // Automatisk utlogging etter 5 timer og redirect til login hvis ikke session finnes
  useEffect(() => {
    const session = localStorage.getItem("fuelmap_session");
    if (session) {
      const { expires } = JSON.parse(session);
      if (Date.now() > expires) {
        localStorage.removeItem("fuelmap_session");
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const [addMode, setAddMode] = useState(false);
  const [pins, setPins] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [newType, setNewType] = useState('base');
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [editValues, setEditValues] = useState<any>({});
  const [editMode, setEditMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const mapRef = useRef<google.maps.Map>();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'pins'), (snapshot) => {
      const pinData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPins(pinData);
    });
    return () => unsub();
  }, []);

  // Panorer og zoom inn hver gang du klikker på et depot (boblen vises alltid)
  useEffect(() => {
    if (selected && selected.lat && selected.lng && mapRef.current) {
      mapRef.current.panTo({ lat: Number(selected.lat), lng: Number(selected.lng) });
      mapRef.current.setZoom(13);
    }
  }, [selected]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng && addMode) {
      setSelected({ lat: e.latLng.lat(), lng: e.latLng.lng(), editing: true });
      setNewType('base');
      setNewName('');
      setNewNote('');
      setAddMode(false);
    } else {
      setSelected(null);
    }
  }, [addMode]);

  const saveNewPin = async () => {
    await addDoc(collection(db, 'pins'), {
      lat: Number(selected.lat),
      lng: Number(selected.lng),
      type: newType,
      name: newName,
      note: newNote,
      createdAt: serverTimestamp(),
      fullBarrels: 0,
      emptyBarrels: 0,
      tank: 0,
      trailer: 0,
      equipment: '',
      images: [],
    });
    await logAction("Opprettet depot", `Depotnavn: ${newName}`);
    setSelected(null);
  };

  const deletePin = async (pin: any) => {
    await deleteDoc(doc(db, 'pins', pin.id));
    await logAction("Slettet depot", `Depotnavn: ${pin.name}`);
    if (pin.images?.length) {
      for (const url of pin.images) {
        const path = url.split('%2F')[1].split('?')[0];
        const refToDelete = ref(storage, `images/${path}`);
        await deleteObject(refToDelete).catch(() => {});
      }
    }
    setSelected(null);
  };

  const updatePinField = async (pin: any, field: string, value: any) => {
    const refDoc = doc(db, 'pins', pin.id);
    await updateDoc(refDoc, { [field]: value });
  };

  const uploadImage = async (pin: any, file: File) => {
    const imageRef = ref(storage, `images/${uuidv4()}`);
    await uploadBytes(imageRef, file);
    const url = await getDownloadURL(imageRef);
    const images = pin.images || [];
    if (images.length >= 5) {
      const oldest = images[0];
      const path = oldest.split('%2F')[1].split('?')[0];
      await deleteObject(ref(storage, `images/${path}`)).catch(() => {});
      await updateDoc(doc(db, 'pins', pin.id), {
        images: [...images.slice(1), url],
      });
    } else {
      await updateDoc(doc(db, 'pins', pin.id), {
        images: arrayUnion(url),
      });
    }
    await logAction("Lastet opp bilde", `Depotnavn: ${pin.name}`);
  };

  const handleManualEdit = async (pin: any) => {
    const fields: any = {};
    if (editValues.fullBarrels !== undefined && !isNaN(Number(editValues.fullBarrels))) fields.fullBarrels = Number(editValues.fullBarrels);
    if (editValues.emptyBarrels !== undefined && !isNaN(Number(editValues.emptyBarrels))) fields.emptyBarrels = Number(editValues.emptyBarrels);
    if (editValues.tank !== undefined && !isNaN(Number(editValues.tank))) fields.tank = Number(editValues.tank);
    if (editValues.trailer !== undefined && !isNaN(Number(editValues.trailer))) fields.trailer = Number(editValues.trailer);
    if (editValues.equipment !== undefined) fields.equipment = editValues.equipment;
    if (Object.keys(fields).length) await updateDoc(doc(db, 'pins', pin.id), fields);

    await logAction("Endret depot", `Depotnavn: ${pin.name}`);

    setEditValues({});
    setEditMode(false);
    const updatedPin = (await getDoc(doc(db, 'pins', pin.id))).data();
    if (updatedPin) {
      setSelected({ id: pin.id, ...updatedPin });
    }
  };

  const adjustBarrels = async (
    pin: any,
    type: 'fullBarrels' | 'emptyBarrels',
    delta: number
  ) => {
    let full = Number(pin.fullBarrels) || 0;
    let empty = Number(pin.emptyBarrels) || 0;
    if (type === 'fullBarrels' && delta !== 0) {
      full = Math.max(0, full + delta);
      empty = Math.max(0, empty - delta);
    }
    if (type === 'emptyBarrels' && delta !== 0) {
      empty = Math.max(0, empty + delta);
      full = Math.max(0, full - delta);
    }
    await updateDoc(doc(db, 'pins', pin.id), {
      fullBarrels: full,
      emptyBarrels: empty,
    });
    await logAction("Endret fat", `Depotnavn: ${pin.name}. Fulle: ${full}, Tomme: ${empty}`);
  };

  if (!isLoaded) return <p>Laster kart...</p>;

  return (
    <div className="relative w-full h-screen">
      {/* Nedtrekksmeny */}
      <button
        className="absolute top-4 left-4 z-10 bg-white border px-4 py-2 rounded-lg shadow font-bold text-lg"
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        ☰
      </button>
      {dropdownOpen && (
        <div className="absolute top-16 left-4 z-20 bg-white shadow rounded w-64 max-h-[70vh] overflow-auto text-xl">
          <div className="p-2 font-bold text-lg border-b bg-blue-100">Fueldepoter</div>
          {pins
            .filter((p) => p.type === 'fueldepot')
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map((p) => (
              <div
                key={p.id}
                className="flex justify-between items-center px-3 py-2 border-b hover:bg-blue-50 cursor-pointer"
                onClick={() => {
                  setSelected(p);
                  setDropdownOpen(false);
                  // Kartet auto-zoomer og panorerer via useEffect!
                }}
              >
                <span>{p.name}</span>
                <span className="flex gap-2">
                  <span>F:{p.fullBarrels || 0}</span>
                  <span>T:{p.emptyBarrels || 0}</span>
                </span>
              </div>
            ))}
        </div>
      )}
      {/* Pluss-knapp */}
      <button
        className={`absolute left-20 top-4 z-10 bg-green-500 text-white text-3xl w-12 h-12 rounded-full shadow flex items-center justify-center ${
          addMode ? 'ring-4 ring-green-400' : ''
        }`}
        title="Legg til nytt depot/base"
        onClick={() => setAddMode(true)}
      >
        +
      </button>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={6}
        onClick={handleMapClick}
        onLoad={(map) => (mapRef.current = map)}
      >
        {pins.map((pin) => (
          <MarkerF
            key={pin.id}
            position={{ lat: Number(pin.lat), lng: Number(pin.lng) }}
            onClick={() => setSelected(pin)}
            icon={{
              url: pin.type === 'base'
                ? 'https://maps.google.com/mapfiles/kml/shapes/heliport.png'
                : pin.fullBarrels > 2
                ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
                : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
            }}
            title={pin.name}
          />
        ))}

        {/* Ny pin popup */}
        {selected?.editing && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="p-2 text-xl w-64">
              <div>
                <label className="block mb-2">
                  <span className="font-bold">Type:</span>
                  <select
                    className="w-full p-2 border mt-1"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                  >
                    <option value="base">Base</option>
                    <option value="fueldepot">Fueldepot</option>
                  </select>
                </label>
                <label className="block mb-2">
                  <span className="font-bold">Navn:</span>
                  <input
                    className="w-full p-2 border mt-1"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={40}
                  />
                </label>
                <label className="block mb-2">
                  <span className="font-bold">Notat:</span>
                  <textarea
                    className="w-full p-2 border mt-1"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    maxLength={200}
                  />
                </label>
                <button
                  onClick={saveNewPin}
                  className="w-full bg-blue-600 text-white font-bold py-2 rounded mt-2"
                >
                  Lagre
                </button>
              </div>
            </div>
          </InfoWindowF>
        )}

        {/* Eksisterende pin popup */}
        {selected && !selected.editing && (
          <InfoWindowF
            position={{ lat: Number(selected.lat), lng: Number(selected.lng) }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="p-2 text-xl max-w-[340px]">
              <div className="flex justify-between items-center">
                <h2 className="font-bold">{selected.name || 'Uten navn'}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className="text-sm bg-blue-500 text-white px-3 rounded"
                  >
                    {editMode ? 'Avslutt' : 'Edit'}
                  </button>
                  <button
                    onClick={() => deletePin(selected)}
                    className="text-xs bg-red-600 text-white px-3 rounded"
                  >
                    Slett
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {/* Fulle fat */}
                <div className="flex items-center gap-2">
                  <span>Fulle fat:</span>
                  {editMode ? (
                    <>
                      <input
                        type="number"
                        className="border p-1 w-14 text-xl"
                        value={editValues.fullBarrels ?? selected.fullBarrels ?? 0}
                        onChange={e =>
                          setEditValues(vals => ({
                            ...vals,
                            fullBarrels: e.target.value,
                          }))
                        }
                      />
                      <button
                        onClick={() => adjustBarrels(selected, 'fullBarrels', 1)}
                        className="px-3 py-1 text-white text-2xl bg-green-500 rounded"
                      >+</button>
                      <button
                        onClick={() => adjustBarrels(selected, 'fullBarrels', -1)}
                        className="px-3 py-1 text-white text-2xl bg-red-500 rounded"
                      >–</button>
                    </>
                  ) : (
                    <b>{selected.fullBarrels}</b>
                  )}
                </div>
                {/* Tomme fat */}
                <div className="flex items-center gap-2">
                  <span>Tomme fat:</span>
                  {editMode ? (
                    <>
                      <input
                        type="number"
                        className="border p-1 w-14 text-xl"
                        value={editValues.emptyBarrels ?? selected.emptyBarrels ?? 0}
                        onChange={e =>
                          setEditValues(vals => ({
                            ...vals,
                            emptyBarrels: e.target.value,
                          }))
                        }
                      />
                      <button
                        onClick={() => adjustBarrels(selected, 'emptyBarrels', 1)}
                        className="px-3 py-1 text-white text-2xl bg-green-500 rounded"
                      >+</button>
                      <button
                        onClick={() => adjustBarrels(selected, 'emptyBarrels', -1)}
                        className="px-3 py-1 text-white text-2xl bg-red-500 rounded"
                      >–</button>
                    </>
                  ) : (
                    <b>{selected.emptyBarrels}</b>
                  )}
                </div>
                {/* Fuelhenger */}
                <div>
                  Fuelhenger:{' '}
                  {editMode ? (
                    <input
                      className="ml-1 border p-1 w-20"
                      value={editValues.trailer ?? selected.trailer ?? ''}
                      onChange={(e) =>
                        setEditValues((vals: any) => ({ ...vals, trailer: e.target.value }))
                      }
                    />
                  ) : `${selected.trailer || 0} liter`}
                </div>
                {/* Fueltank */}
                <div>
                  Fueltank:{' '}
                  {editMode ? (
                    <input
                      className="ml-1 border p-1 w-20"
                      value={editValues.tank ?? selected.tank ?? ''}
                      onChange={(e) =>
                        setEditValues((vals: any) => ({ ...vals, tank: e.target.value }))
                      }
                    />
                  ) : `${selected.tank || 0} liter`}
                </div>
                {/* Utstyr */}
                <div>
                  Utstyr:{' '}
                  {editMode ? (
                    <textarea
                      rows={2}
                      className="ml-1 border p-1 w-full"
                      value={editValues.equipment ?? selected.equipment ?? ''}
                      onChange={(e) =>
                        setEditValues((vals: any) => ({ ...vals, equipment: e.target.value }))
                      }
                    />
                  ) : <pre className="whitespace-pre-wrap">{selected.equipment}</pre>}
                </div>
                {/* Lagre-knapp */}
                {editMode && (
                  <button
                    onClick={() => handleManualEdit(selected)}
                    className="mt-2 bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Lagre endringer
                  </button>
                )}
                {/* Bilder */}
                <div className="flex flex-row flex-wrap gap-2">
                  {(selected.images || []).map((url: string, i: number) => (
                    <img key={i} src={url} alt="bilde" className="w-24 h-20 object-cover rounded" />
                  ))}
                </div>
                {/* Kamera-opplasting */}
                <label className="w-full flex flex-col items-center mt-2">
                  <span className="mb-1 text-lg">📷 Ta bilde</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadImage(selected, e.target.files[0])}
                  />
                  <button
                    type="button"
                    onClick={() => document.querySelector<HTMLInputElement>('input[type=\"file\"]')?.click()}
                    className="bg-gray-200 px-4 py-2 rounded shadow text-lg w-full"
                  >
                    Last opp bilde
                  </button>
                </label>
              </div>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}

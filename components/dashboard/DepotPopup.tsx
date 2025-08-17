import { Depot, withDepotDefaults } from "@/lib/types";
 

'use client';

import { InfoWindowF } from "@react-google-maps/api";

type DepotPopupProps = {
  depot: Depot;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Depot>) => void;
  onDelete: (id: string, name: string) => void;
};

export default function DepotPopup({
  depot,
  onClose,
  onUpdate,
  onDelete,
}: DepotPopupProps) {
  return (
    <InfoWindowF position={{ lat: depot.lat, lng: depot.lng }} onCloseClick={onClose}>
      <div className="p-2 text-sm max-w-xs">
        <h2 className="font-bold mb-1">{depot.name}</h2>
        <p className="mb-2">Type: {depot.type}</p>
        <div className="space-y-1">
          <label>
            Fulle fat:{" "}
            <input
              type="number"
              value={depot.full ?? 0}
              onChange={(e) =>
                onUpdate(depot.id, { full: parseInt(e.target.value) })
              }
              className="border w-16 px-1"
            />
          </label>
          <label>
            Tomme fat:{" "}
            <input
              type="number"
              value={depot.empty}
              onChange={(e) =>
                onUpdate(depot.id, { empty: parseInt(e.target.value) })
              }
              className="border w-16 px-1"
            />
          </label>
          <label>
            Fuelhenger (L):{" "}
            <input
              type="number"
              value={depot.fuelTrailer}
              onChange={(e) =>
                onUpdate(depot.id, { fuelTrailer: parseInt(e.target.value) })
              }
              className="border w-24 px-1"
            />
          </label>
          <label>
            Fueltank (L):{" "}
            <input
              type="number"
              value={depot.fuelTank}
              onChange={(e) =>
                onUpdate(depot.id, { fuelTank: parseInt(e.target.value) })
              }
              className="border w-24 px-1"
            />
          </label>
          <label>
            Utstyr:{" "}
            <input
              type="text"
              value={depot.equipment}
              onChange={(e) => onUpdate(depot.id, { equipment: e.target.value })}
              className="border w-full px-1"
            />
          </label>
        </div>

        <button
          onClick={() => onDelete(depot.id, depot.name ?? "Ukjent depot")}
          className="bg-red-600 text-white px-3 py-1 rounded mt-2"
        >
          Slett depot
        </button>
      </div>
    </InfoWindowF>
  );
}

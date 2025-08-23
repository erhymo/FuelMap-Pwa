import React from "react";
import { Pin } from "@/lib/types";

interface DepotListProps {
  pins: Pin[];
  dropdownOpen: boolean;
  setDropdownOpen: (v: boolean) => void;
  flyTo: (pin: Pin) => void;
  onAddDepot: () => void;
}

export default function DepotList({ pins, dropdownOpen, setDropdownOpen, flyTo, onAddDepot }: DepotListProps) {
  return (
    <div className="absolute z-20 left-4 top-24 md:top-28">
      <button
        className="bg-white rounded-full shadow p-3 mb-2 text-3xl font-extrabold text-black"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-label="Åpne depotliste"
      >
        ☰
      </button>
      {dropdownOpen && (
        <div className="bg-white shadow-lg rounded-lg p-4 max-h-96 w-72 overflow-y-auto mt-2">
          <div className="mb-2 text-2xl font-extrabold text-black">Alle depoter:</div>
          {pins
            .filter(pin => pin.name?.toLowerCase() !== "admin")
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .map((pin) => (
              <div
                key={pin.id}
                className="flex items-center gap-2 px-2 py-2 rounded hover:bg-green-100 cursor-pointer"
                onClick={() => flyTo(pin)}
              >
                <span className="font-bold text-lg text-black truncate">{pin.name}</span>
                <span className="ml-auto flex flex-row items-center gap-2">
                  <span className="text-green-600 font-extrabold text-base tabular-nums">{pin.fullBarrels ?? 0}</span>
                  <span className="text-red-600 font-extrabold text-base tabular-nums">{pin.emptyBarrels ?? 0}</span>
                </span>
              </div>
            ))}
        </div>
      )}
      <button
        className="bg-green-500 text-white rounded-full shadow p-4 text-4xl mt-3 font-extrabold"
        onClick={onAddDepot}
        title="Legg til nytt depot"
        aria-label="Legg til nytt depot"
      >
        +
      </button>
    </div>
  );
}

export interface Depot {
  id: string;
  type: "base" | "fueldepot";
  name?: string;
  lat: number;
  lng: number;

  full?: number;
  empty?: number;
  fuelTrailer?: number;
  fuelTank?: number;
  equipment?: string;
}

export function withDepotDefaults(depot: Partial<Depot>): Depot {
  return {
    id: depot.id || "",
    type: depot.type || "fueldepot",
    name: depot.name || "",
    lat: depot.lat || 0,
    lng: depot.lng || 0,
    full: depot.full ?? 0,
    empty: depot.empty ?? 0,
    fuelTrailer: depot.fuelTrailer ?? 0,
    fuelTank: depot.fuelTank ?? 0,
    equipment: depot.equipment || "",
  };
}

// DepotType: brukes for å skille mellom base og fueldepot
export type DepotType = "base" | "fueldepot";

"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function DashboardPage() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <h1>FuelMap Dashboard</h1>
      <MapView />
    </div>
  );
}

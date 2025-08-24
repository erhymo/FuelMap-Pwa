"use client";

import React from "react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function DashboardPage() {
  // Sjekk fuelmap-session ved mount
  React.useEffect(() => {
    const session = localStorage.getItem("fuelmap_session");
    if (!session) {
      window.location.href = "/login";
      return;
    }
    try {
      const { expires } = JSON.parse(session);
      if (!expires || Date.now() > expires) {
        localStorage.removeItem("fuelmap_session");
        window.location.href = "/login";
      }
    } catch {
      localStorage.removeItem("fuelmap_session");
      window.location.href = "/login";
    }
  }, []);
  return <MapView />;
}

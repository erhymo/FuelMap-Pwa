"use client";
import { useEffect } from "react";

export default function DashboardContent() {
  useEffect(() => {
    console.log("✅ DashboardContent mounted");
  }, []);

  return (
    <div>
      <p>📊 DashboardContent loaded</p>
    </div>
  );
}

 

// app/dashboard/page.tsx
"use client";

import { useState } from "react";
import Login from "../../components/Login";
import DashboardContent from "../../components/DashboardContent";

export default function DashboardPage() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  if (!employeeId) {
    return <Login onLogin={(id) => setEmployeeId(id)} />;
  }

  return <DashboardContent employeeId={employeeId} />;
}

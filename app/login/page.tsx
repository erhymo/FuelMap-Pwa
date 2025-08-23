"use client";
import Login from "@/components/Login";
import { useRouter } from "next/navigation";
// import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (id: string) => {
    localStorage.setItem("fuelmap_session", JSON.stringify({ employeeId: id, expires: Date.now() + 24 * 60 * 60 * 1000 }));
    router.push("/dashboard");
  };

  return <Login onLogin={handleLogin} />;
}

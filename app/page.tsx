 

"use client";

import React from "react";
import Link from "next/link";

export default function HomePage() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
    return null;
  }
  return null;
}

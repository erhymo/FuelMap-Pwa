'use client';

import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-100 to-blue-200">
      <div>
        <Image
          src="/Airlift-logo.png" // NB: eksakt navn!
          alt="Airlift logo"
          width={320}
          height={90}
          priority
        />
      </div>
    </div>
  );
}

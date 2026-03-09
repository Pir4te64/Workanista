"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getRandomPhrase } from "@/lib/loader-phrases";

interface Props {
  size?: number;
  text?: string;
  className?: string;
  fullscreen?: boolean;
}

export default function Loader({ size = 48, text, className = "", fullscreen = true }: Props) {
  const [phrase, setPhrase] = useState(getRandomPhrase);

  useEffect(() => {
    if (!fullscreen) return;
    const interval = setInterval(() => {
      setPhrase(getRandomPhrase());
    }, 3000);
    return () => clearInterval(interval);
  }, [fullscreen]);

  if (fullscreen) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[50vh] gap-4 ${className}`}>
        <Image
          src="/loader.png"
          alt="Cargando"
          width={120}
          height={120}
          className="animate-spin"
        />
        <p className="text-sm text-text-muted text-center max-w-xs animate-pulse">
          {phrase}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/loader.png"
        alt="Cargando"
        width={size}
        height={size}
        className="animate-spin"
      />
      {text && <p className="text-sm text-text-muted">{text}</p>}
    </div>
  );
}

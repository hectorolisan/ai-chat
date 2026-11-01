"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Pixel-art logo (logo-tinta framing), generated from public/goliat.svg (Reels/tools/mascota_logo.py).
const PIXELS: [string, string][] = [
  ["#ffffff", "M20 12h3v1h-3zM19 13h2v1h-2zM22 13h2v1h-2zM19 14h1v1h-1zM21 14h1v1h-1zM23 14h1v1h-1zM19 15h2v1h-2zM22 15h2v1h-2zM17 16h4v1h-4zM22 16h4v1h-4zM16 17h2v1h-2zM25 17h2v1h-2zM16 18h1v1h-1zM26 18h2v1h-2zM15 19h2v1h-2zM27 19h3v1h-3zM15 20h1v1h-1zM21 20h2v1h-2zM29 20h3v1h-3zM14 21h2v1h-2zM21 21h2v1h-2zM31 21h1v1h-1zM13 22h2v1h-2zM31 22h1v1h-1zM12 23h2v1h-2zM31 23h1v1h-1zM11 24h2v1h-2zM29 24h3v1h-3zM10 25h2v1h-2zM25 25h5v1h-5zM9 26h2v1h-2zM24 26h2v1h-2zM8 27h2v1h-2zM23 27h2v1h-2zM7 28h2v1h-2zM23 28h1v1h-1zM6 29h2v1h-2zM17 29h1v1h-1zM23 29h1v1h-1zM5 30h2v1h-2zM16 30h1v1h-1zM23 30h1v1h-1zM4 31h2v1h-2zM22 31h2v1h-2zM3 32h2v1h-2zM21 32h2v1h-2zM2 33h2v1h-2zM22 33h1v1h-1zM2 34h1v1h-1zM22 34h1v1h-1zM1 35h2v1h-2zM22 35h1v1h-1z"],
  ["#4a556b", "M21 13h1v1h-1zM20 14h1v1h-1zM22 14h1v1h-1zM21 15h1v1h-1zM18 18h7v1h-7zM17 19h1v1h-1zM11 29h1v1h-1zM13 31h1v1h-1zM5 32h1v1h-1z"],
  ["#bcc0c7", "M21 16h1v1h-1zM18 17h7v1h-7zM17 18h1v1h-1zM20 19h4v1h-4zM20 20h1v1h-1zM23 20h1v1h-1zM20 21h1v1h-1zM23 21h1v1h-1zM20 22h4v1h-4zM16 23h2v1h-2zM25 23h1v1h-1zM27 23h1v1h-1zM29 23h1v1h-1zM13 24h1v1h-1zM16 24h2v1h-2zM12 25h1v1h-1zM18 25h7v1h-7zM11 26h1v1h-1zM20 26h4v1h-4zM10 27h1v1h-1zM21 27h2v1h-2zM9 28h1v1h-1zM8 29h1v1h-1zM10 29h1v1h-1zM15 29h2v1h-2zM18 29h1v1h-1zM7 30h1v1h-1zM15 30h1v1h-1zM17 30h2v1h-2zM6 31h1v1h-1zM15 34h1v1h-1zM20 35h1v1h-1z"],
  ["#252b37", "M25 18h1v1h-1zM25 19h1v1h-1zM25 20h1v1h-1zM25 21h1v1h-1zM25 22h1v1h-1zM22 23h2v1h-2zM25 24h1v1h-1zM15 28h5v1h-5zM14 29h1v1h-1zM19 29h1v1h-1zM14 30h1v1h-1zM19 30h1v1h-1zM14 31h5v1h-5zM16 33h3v1h-3zM9 34h1v1h-1zM11 34h1v1h-1zM16 34h3v1h-3zM11 35h1v1h-1zM16 35h3v1h-3z"],
  ["#333b4b", "M18 19h2v1h-2zM24 19h1v1h-1zM26 19h1v1h-1zM16 20h4v1h-4zM24 20h1v1h-1zM26 20h3v1h-3zM16 21h4v1h-4zM24 21h1v1h-1zM26 21h3v1h-3zM30 21h1v1h-1zM15 22h5v1h-5zM24 22h1v1h-1zM26 22h5v1h-5zM14 23h2v1h-2zM18 23h4v1h-4zM14 24h2v1h-2zM18 24h7v1h-7zM26 24h3v1h-3zM13 25h5v1h-5zM12 26h8v1h-8zM11 27h10v1h-10zM10 28h5v1h-5zM20 28h3v1h-3zM9 29h1v1h-1zM12 29h2v1h-2zM20 29h3v1h-3zM8 30h6v1h-6zM20 30h3v1h-3zM7 31h6v1h-6zM19 31h3v1h-3zM6 32h15v1h-15zM4 33h12v1h-12zM19 33h3v1h-3zM3 34h6v1h-6zM10 34h1v1h-1zM12 34h3v1h-3zM19 34h3v1h-3zM3 35h8v1h-8zM12 35h4v1h-4zM19 35h1v1h-1zM21 35h1v1h-1z"],
  ["#111111", "M29 21h1v1h-1zM24 23h1v1h-1zM26 23h1v1h-1zM28 23h1v1h-1zM30 23h1v1h-1z"],
];

// "pensando" frames: cells that differ from PIXELS (bubble dots, antenna + eye blink).
const THINKING: [string, string][][] = [
  [
    ["#ffffff", "M22 1h12v1h-12zM21 2h14v1h-14zM21 3h2v1h-2zM25 3h2v1h-2zM29 3h2v1h-2zM33 3h2v1h-2zM21 4h2v1h-2zM25 4h2v1h-2zM29 4h2v1h-2zM33 4h2v1h-2zM21 5h14v1h-14zM22 6h12v1h-12zM23 7h2v1h-2zM23 8h2v1h-2zM22 10h1v1h-1z"],
    ["#bcc0c7", "M23 3h2v1h-2zM27 3h2v1h-2zM31 3h2v1h-2zM23 4h2v1h-2zM27 4h2v1h-2zM31 4h2v1h-2z"],
  ],
  [
    ["#ffffff", "M22 1h12v1h-12zM21 2h14v1h-14zM21 3h2v1h-2zM25 3h2v1h-2zM29 3h2v1h-2zM33 3h2v1h-2zM21 4h2v1h-2zM25 4h2v1h-2zM29 4h2v1h-2zM33 4h2v1h-2zM21 5h14v1h-14zM22 6h12v1h-12zM23 7h2v1h-2zM23 8h2v1h-2zM22 10h1v1h-1z"],
    ["#333b4b", "M23 3h2v1h-2zM23 4h2v1h-2z"],
    ["#bcc0c7", "M27 3h2v1h-2zM31 3h2v1h-2zM27 4h2v1h-2zM31 4h2v1h-2z"],
    ["#4a556b", "M21 14h1v1h-1zM21 20h2v1h-2zM21 21h2v1h-2z"],
  ],
  [
    ["#ffffff", "M22 1h12v1h-12zM21 2h14v1h-14zM21 3h2v1h-2zM25 3h2v1h-2zM29 3h2v1h-2zM33 3h2v1h-2zM21 4h2v1h-2zM25 4h2v1h-2zM29 4h2v1h-2zM33 4h2v1h-2zM21 5h14v1h-14zM22 6h12v1h-12zM23 7h2v1h-2zM23 8h2v1h-2zM22 10h1v1h-1z"],
    ["#333b4b", "M23 3h2v1h-2zM27 3h2v1h-2zM23 4h2v1h-2zM27 4h2v1h-2z"],
    ["#bcc0c7", "M31 3h2v1h-2zM31 4h2v1h-2z"],
  ],
  [
    ["#ffffff", "M22 1h12v1h-12zM21 2h14v1h-14zM21 3h2v1h-2zM25 3h2v1h-2zM29 3h2v1h-2zM33 3h2v1h-2zM21 4h2v1h-2zM25 4h2v1h-2zM29 4h2v1h-2zM33 4h2v1h-2zM21 5h14v1h-14zM22 6h12v1h-12zM23 7h2v1h-2zM23 8h2v1h-2zM22 10h1v1h-1z"],
    ["#333b4b", "M23 3h2v1h-2zM27 3h2v1h-2zM31 3h2v1h-2zM23 4h2v1h-2zM27 4h2v1h-2zM31 4h2v1h-2z"],
    ["#4a556b", "M21 14h1v1h-1zM21 20h2v1h-2zM21 21h2v1h-2z"],
  ],
];
const THINKING_MS = [350, 350, 350, 600];

export function Goliat({ className, thinking = false }: { className?: string; thinking?: boolean }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!thinking) return;
    const id = setTimeout(() => setFrame((f) => (f + 1) % THINKING.length), THINKING_MS[frame]);
    return () => clearTimeout(id);
  }, [thinking, frame]);

  return (
    <span className={cn("block overflow-hidden rounded-md bg-[#111111]", className)}>
      <svg viewBox="0 0 36 36" shapeRendering="crispEdges" role="img" aria-label={thinking ? "Goliat pensando" : "Goliat"} className="block size-full">
        {[...PIXELS, ...(thinking ? THINKING[frame] : [])].map(([fill, d], i) => (
          <path key={i} fill={fill} d={d} />
        ))}
      </svg>
    </span>
  );
}

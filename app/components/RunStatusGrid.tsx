"use client";

import { useEffect, useState } from "react";

const TRAIL_OPACITIES = [1, 0.55, 0.25, 0.1];

function getTrailOpacity(cellIndex: number, head: number) {
  for (let t = 0; t < TRAIL_OPACITIES.length; t++) {
    if ((head - t + 9) % 9 === cellIndex) return TRAIL_OPACITIES[t];
  }
  return 0;
}

export default function RunStatusGrid({ status }: { status: string }) {
  const [head, setHead] = useState(0);
  const isAnimating = status === "running" || status === "provisioning";

  useEffect(() => {
    if (!isAnimating) return;
    const interval = setInterval(() => {
      setHead((prev) => (prev + 1) % 9);
    }, 150);
    return () => clearInterval(interval);
  }, [isAnimating]);

  if (!isAnimating) {
    const color =
      status === "idle"
        ? "bg-accent-9"
        : status === "completed"
          ? "bg-green-9"
          : status === "failed"
            ? "bg-red-9"
            : "bg-grayscale-8";

    return (
      <div className="grid grid-cols-3 gap-px shrink-0">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={`w-[2px] h-[2px] ${color}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-px shrink-0">
      {Array.from({ length: 9 }).map((_, i) => {
        const trailOpacity = getTrailOpacity(i, head);
        return (
          <div key={i} className="w-[2px] h-[2px] relative">
            <div className="absolute inset-0 bg-blue-5" />
            <div
              className="absolute inset-0 bg-blue-9 transition-opacity duration-150 ease-linear"
              style={{ opacity: trailOpacity }}
            />
          </div>
        );
      })}
    </div>
  );
}

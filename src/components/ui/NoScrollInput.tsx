"use client";
import { useEffect } from "react";

export default function NoScrollInput() {
  useEffect(() => {
    const handler = (_e: WheelEvent) => {
      const el = document.activeElement as HTMLInputElement | null;
      if (el && el.tagName === "INPUT" && el.type === "number") {
        el.blur();
      }
    };
    document.addEventListener("wheel", handler, { passive: true });
    return () => document.removeEventListener("wheel", handler);
  }, []);
  return null;
}

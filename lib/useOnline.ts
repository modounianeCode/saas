"use client";

import { useEffect, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const goUp = () => setOnline(true);
    const goDown = () => setOnline(false);
    window.addEventListener("online", goUp);
    window.addEventListener("offline", goDown);
    return () => {
      window.removeEventListener("online", goUp);
      window.removeEventListener("offline", goDown);
    };
  }, []);

  return online;
}
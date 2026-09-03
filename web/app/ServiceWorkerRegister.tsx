"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a nice-to-have -- if registration fails, the
        // dashboard still works fine as a normal website.
      });
    }
  }, []);

  return null;
}

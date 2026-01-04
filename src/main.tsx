// Application entry point - Kaizen App v2
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA with update handling (production only)
const isLovablePreviewHost =
  typeof window !== "undefined" &&
  window.location.hostname.includes("lovableproject.com");

if (import.meta.env.PROD && !isLovablePreviewHost && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed, app still works
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const notification = document.createElement("div");
    notification.className =
      "fixed bottom-20 left-4 right-4 z-50 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-4";
    notification.innerHTML = `
      <span class="text-sm font-medium">✨ App updated to latest version</span>
      <button onclick="this.parentElement.remove()" class="ml-2 text-primary-foreground/70 hover:text-primary-foreground">✕</button>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  });
}


createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <App />
  </ThemeProvider>
);

// Injeta inject.js no DOM da página
const script = document.createElement("script");
script.src = browser.runtime.getURL("inject.js");
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Ouve mensagens de inject.js e repassa para background.js
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data.type) return;

  if (event.data.type === "PG_CANVAS_FINGERPRINT") {
    browser.runtime.sendMessage({ action: "reportCanvasFingerprint" });
  } else if (event.data.type === "PG_STORAGE_REPORT") {
    browser.runtime.sendMessage({ action: "reportClientStorage", data: event.data.data });
  } else if (event.data.type === "PG_HIJACK_THREAT") {
    browser.runtime.sendMessage({ action: "reportHijackIndicator", threat: event.data.threat });
  }
});
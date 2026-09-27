(function() {
  // 1. Detecção de Canvas Fingerprint
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;

  HTMLCanvasElement.prototype.toDataURL = function(...args) {
    window.postMessage({ type: "PG_CANVAS_FINGERPRINT", method: "toDataURL" }, "*");
    return origToDataURL.apply(this, args);
  };

  CanvasRenderingContext2D.prototype.getImageData = function(...args) {
    // Alerta se leitura for feita em canvas com largura/altura pequena ou após renderização de texto
    window.postMessage({ type: "PG_CANVAS_FINGERPRINT", method: "getImageData" }, "*");
    return origGetImageData.apply(this, args);
  };

  // 2. Detecção de Hook / Prototype Pollution / Hijack
  const sensitiveGlobals = ["fetch", "XMLHttpRequest", "WebSocket"];
  sensitiveGlobals.forEach(api => {
    let original = window[api];
    Object.defineProperty(window, api, {
      configurable: true,
      enumerable: true,
      get: () => original,
      set: (val) => {
        window.postMessage({
          type: "PG_HIJACK_THREAT",
          threat: `Sobrescrita de API crítica global: window.${api}`
        }, "*");
        original = val;
      }
    });
  });

  // 3. Monitoramento de Leaks Globais (js-leaks)
  window.addEventListener("load", () => {
    let storageData = {
      localStorage: window.localStorage ? window.localStorage.length : 0,
      sessionStorage: window.sessionStorage ? window.sessionStorage.length : 0,
      indexedDB: !!window.indexedDB
    };
    window.postMessage({ type: "PG_STORAGE_REPORT", data: storageData }, "*");
  });
})();
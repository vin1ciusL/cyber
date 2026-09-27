// Armazena dados por tabId
const tabData = {};
let customBlocklist = ["doubleclick.net", "google-analytics.com", "criteo.com", "facebook.net"];

// Inicializa dados da aba
function initTab(tabId) {
  tabData[tabId] = {
    url: "",
    domain: "",
    firstPartyRequests: 0,
    thirdPartyRequests: [],
    cookies: { firstParty: 0, thirdParty: 0, session: 0, persistent: 0 },
    storage: { localStorage: 0, sessionStorage: 0, indexedDB: false },
    canvasFingerprintDetected: false,
    hijackThreats: [],
    bounceTrackingDetected: false,
    score: 100
  };
}

// Extrai eTLD+1 simples
function getBaseDomain(urlStr) {
  try {
    const hostname = new URL(urlStr).hostname;
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts.slice(-2).join('.');
    }
    return hostname;
  } catch (e) {
    return "";
  }
}

// 1. Interceptação de Requisições e Bloqueio
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const { tabId, url, type } = details;
    if (tabId < 0) return;

    if (!tabData[tabId]) initTab(tabId);
    const tabInfo = tabData[tabId];

    if (type === "main_frame") {
      initTab(tabId);
      tabData[tabId].url = url;
      tabData[tabId].domain = getBaseDomain(url);
      return;
    }

    const reqDomain = getBaseDomain(url);
    if (!reqDomain || !tabInfo.domain) return;

    // Verificar bloqueio personalizado
    if (customBlocklist.some(blocked => reqDomain.includes(blocked))) {
      return { cancel: true };
    }

    // Terceira Parte
    if (reqDomain !== tabInfo.domain) {
      if (!tabInfo.thirdPartyRequests.includes(reqDomain)) {
        tabInfo.thirdPartyRequests.push(reqDomain);
      }

      // Detecção de Cookie Sync / Bounce Tracking por Query Params (ex: ?uid=, ?id=, ?sync_id=)
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      const syncKeys = ["uid", "user_id", "sync", "guid", "visitor_id", "id"];
      for (let key of syncKeys) {
        if (params.has(key) && params.get(key).length > 8) {
          tabInfo.bounceTrackingDetected = true;
          break;
        }
      }

      // Detecção de Hijacking/Hook: WebSockets ou Polling contínuo para 3rd party
      if (type === "websocket") {
        tabInfo.hijackThreats.push(`Conexão WebSocket externa para ${reqDomain}`);
      }
    } else {
      tabInfo.firstPartyRequests++;
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// 2. Análise de Cookies ao carregar a página
browser.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const tabId = details.tabId;
  const tabInfo = tabData[tabId];
  if (!tabInfo) return;

  try {
    const cookies = await browser.cookies.getAll({ url: details.url });
    tabInfo.cookies = { firstParty: 0, thirdParty: 0, session: 0, persistent: 0 };

    cookies.forEach(c => {
      const cDomain = getBaseDomain("http://" + c.domain.replace(/^\./, ''));
      if (cDomain === tabInfo.domain) {
        tabInfo.cookies.firstParty++;
      } else {
        tabInfo.cookies.thirdParty++;
      }

      if (c.session) {
        tabInfo.cookies.session++;
      } else {
        tabInfo.cookies.persistent++;
      }
    });

    // Calcular score inicial
    tabInfo.score = calculatePrivacyScore(tabInfo);
  } catch (err) {
    console.error("Erro ao ler cookies:", err);
  }
});

// 3. Comunicação com Content Script e Popup
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : msg.tabId;

  if (msg.action === "reportClientStorage") {
    if (tabData[tabId]) {
      tabData[tabId].storage = msg.data;
      tabData[tabId].score = calculatePrivacyScore(tabData[tabId]);
    }
  } else if (msg.action === "reportCanvasFingerprint") {
    if (tabData[tabId]) {
      tabData[tabId].canvasFingerprintDetected = true;
      tabData[tabId].score = calculatePrivacyScore(tabData[tabId]);
    }
  } else if (msg.action === "reportHijackIndicator") {
    if (tabData[tabId]) {
      tabData[tabId].hijackThreats.push(msg.threat);
      tabData[tabId].score = calculatePrivacyScore(tabData[tabId]);
    }
  } else if (msg.action === "getTabData") {
    sendResponse({
      data: tabData[msg.tabId] || null,
      blocklist: customBlocklist
    });
  } else if (msg.action === "updateBlocklist") {
    customBlocklist = msg.blocklist;
    sendResponse({ success: true });
  }
  return true;
});

// Fórmula Explícita de Pontuação de Privacidade (0 a 100)
function calculatePrivacyScore(info) {
  let score = 100;
  score -= Math.min(info.thirdPartyRequests.length * 3, 30);
  score -= Math.min(info.cookies.thirdParty * 4, 20);
  score -= Math.min(info.cookies.persistent * 1, 10);
  if (info.canvasFingerprintDetected) score -= 15;
  if (info.bounceTrackingDetected) score -= 10;
  if (info.storage.localStorage > 5) score -= 5;
  if (info.hijackThreats.length > 0) score -= Math.min(info.hijackThreats.length * 10, 20);

  return Math.max(0, Math.round(score));
}
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab) return;

    // Comunicação Promise nativa do Firefox
    const res = await browser.runtime.sendMessage({ action: "getTabData", tabId: activeTab.id });
    if (!res || !res.data) return;
    const data = res.data;

    // Atualiza Score e Contadores na tela
    document.getElementById("scoreBadge").innerText = `${data.score}/100`;
    document.getElementById("thirdPartyCount").innerText = data.thirdPartyRequests.length;
    
    const list = document.getElementById("thirdPartyList");
    list.innerHTML = "";
    data.thirdPartyRequests.forEach(d => {
      const li = document.createElement("li");
      li.innerText = d;
      list.appendChild(li);
    });

    document.getElementById("c1p").innerText = data.cookies.firstParty;
    document.getElementById("c3p").innerText = data.cookies.thirdParty;
    document.getElementById("cSess").innerText = data.cookies.session;
    document.getElementById("cPers").innerText = data.cookies.persistent;

    document.getElementById("ls").innerText = data.storage.localStorage;
    document.getElementById("ss").innerText = data.storage.sessionStorage;

    if (data.canvasFingerprintDetected) {
      document.getElementById("canvasStatus").innerText = "Canvas Fingerprint: DETECTADO";
      document.getElementById("canvasStatus").style.color = "red";
    }

    if (data.bounceTrackingDetected) {
      document.getElementById("bounceStatus").innerText = "Bounce Tracking / Sync: DETECTADO";
      document.getElementById("bounceStatus").style.color = "red";
    }

    const hList = document.getElementById("hijackList");
    hList.innerHTML = "";
    data.hijackThreats.forEach(t => {
      const li = document.createElement("li");
      li.innerText = t;
      li.style.color = "red";
      hList.appendChild(li);
    });

    renderBlocklist(res.blocklist || []);
  } catch (err) {
    console.error("Erro ao carregar dados no popup:", err);
  }

  function renderBlocklist(list) {
    const ul = document.getElementById("blockList");
    ul.innerHTML = "";
    list.forEach(item => {
      const li = document.createElement("li");
      li.innerText = item;
      ul.appendChild(li);
    });
  }

  document.getElementById("addBlockBtn").addEventListener("click", async () => {
    const val = document.getElementById("newBlockDomain").value.trim();
    if (!val) return;

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    const res = await browser.runtime.sendMessage({ action: "getTabData", tabId: activeTab.id });

    const newList = res.blocklist || [];
    if (!newList.includes(val)) {
      newList.push(val);
      await browser.runtime.sendMessage({ action: "updateBlocklist", blocklist: newList });
      renderBlocklist(newList);
      document.getElementById("newBlockDomain").value = "";
    }
  });
});
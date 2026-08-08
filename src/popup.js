(function initPopup() {
  const DEFAULT_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/12JfxDejTWTMsOUlnVANQsnjsIg27UE82_9KuFbeZq-k/edit";
  const { messages } = globalThis.AZScraper;
  const marketplace = document.querySelector("#marketplace");
  const token = document.querySelector("#token");
  const phase = document.querySelector("#phase");
  const count = document.querySelector("#count");
  const progress = document.querySelector("#progress");
  const statusCard = document.querySelector("#status-card");
  const message = document.querySelector("#message");
  const error = document.querySelector("#error");
  const summary = document.querySelector("#summary");
  const start = document.querySelector("#start");
  const openSheet = document.querySelector("#open-sheet");
  const cancel = document.querySelector("#cancel");
  const retry = document.querySelector("#retry");

  function render(state) {
    const isBusy = ["running", "uploading"].includes(state.status);
    statusCard.dataset.status = state.status || "idle";
    phase.textContent = String(state.phase || state.status || "ready")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
    const current = Number(state.current) || 0;
    const total = Number(state.total) || 50;
    count.textContent = `${current} / ${total}`;
    progress.max = Math.max(total, 1);
    progress.value = Math.min(current, total);
    message.textContent = state.message || "";
    error.textContent = state.error || "";
    error.hidden = !state.error;
    const stats = state.summary;
    summary.textContent = stats
      ? `Processed ${stats.processed || 0} | New ${stats.added || 0} | Updated ${stats.updated || 0} | Failed ${stats.failed || 0} | Missing price ${stats.missingPrice || 0} | Missing bought ${stats.missingBought || 0}`
      : "";
    summary.hidden = !stats || state.status !== "complete";
    start.disabled = isBusy;
    marketplace.disabled = isBusy;
    token.disabled = isBusy;
    cancel.hidden = state.status !== "running";
    retry.hidden = state.status !== "upload_failed";
    openSheet.hidden = false;
  }

  async function saveSettings() {
    const settings = {
      marketplace: marketplace.value,
      token: token.value
    };
    await chrome.storage.local.set({ settings });
    return settings;
  }

  async function request(type) {
    const response = await chrome.runtime.sendMessage({ type });
    if (!response?.ok) {
      render({
        status: "failed",
        phase: "failed",
        current: 0,
        total: 50,
        message: "Request complete na thai.",
        error: response?.error || "Unknown extension error"
      });
      return;
    }
    render(response.state);
  }

  start.addEventListener("click", async () => {
    await saveSettings();
    await request(messages.START_RUN);
  });
  cancel.addEventListener("click", () => request(messages.CANCEL_RUN));
  retry.addEventListener("click", async () => {
    await saveSettings();
    await request(messages.RETRY_UPLOAD);
  });
  openSheet.addEventListener("click", async () => {
    const response = await chrome.runtime.sendMessage({ type: messages.GET_STATE });
    await chrome.tabs.create({
      url: response?.state?.sheetUrl || DEFAULT_SHEET_URL
    });
  });

  chrome.runtime.onMessage.addListener((event) => {
    if (event.type === "STATE_UPDATED") {
      render(event.state);
    }
  });

  Promise.all([
    chrome.storage.local.get("settings"),
    chrome.runtime.sendMessage({ type: messages.GET_STATE })
  ]).then(([stored, response]) => {
    token.value = stored.settings?.token || "";
    marketplace.value = stored.settings?.marketplace || "amazon.in";
    render(response?.state || {});
  });
})();

(function initPopup() {
  const DEFAULT_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/12JfxDejTWTMsOUlnVANQsnjsIg27UE82_9KuFbeZq-k/edit";
  const { errors, messages } = globalThis.AZScraper;
  const marketplace = document.querySelector("#marketplace");
  const token = document.querySelector("#token");
  const phase = document.querySelector("#phase");
  const count = document.querySelector("#count");
  const progress = document.querySelector("#progress");
  const statusCard = document.querySelector("#status-card");
  const message = document.querySelector("#message");
  const errorPanel = document.querySelector("#error-panel");
  const error = document.querySelector("#error");
  const errorCode = document.querySelector("#error-code");
  const errorStage = document.querySelector("#error-stage");
  const errorHttp = document.querySelector("#error-http");
  const errorTime = document.querySelector("#error-time");
  const errorHint = document.querySelector("#error-hint");
  const copyError = document.querySelector("#copy-error");
  const issuePanel = document.querySelector("#issue-panel");
  const issueList = document.querySelector("#issue-list");
  const summary = document.querySelector("#summary");
  const start = document.querySelector("#start");
  const openSheet = document.querySelector("#open-sheet");
  const cancel = document.querySelector("#cancel");
  const retry = document.querySelector("#retry");
  let diagnosticsText = "";

  function formatStage(value) {
    return String(value || "unknown")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || "-") : date.toLocaleString();
  }

  function buildDiagnostics(details, state) {
    const lines = [
      "Amazon Product Analysis diagnostics",
      `Version: ${chrome.runtime.getManifest().version}`,
      `Status: ${state.status || "unknown"}`,
      `Code: ${details.code}`,
      `Stage: ${details.stage}`,
      `Message: ${errors.redactDiagnostics(details.message)}`,
      `Time: ${details.timestamp}`,
      `Marketplace: ${state.marketplace || marketplace.value || "unknown"}`,
      `Progress: ${Number(state.current) || 0}/${Number(state.total) || 50}`,
      `Run ID: ${state.runId || "not-started"}`
    ];
    if (details.httpStatus !== undefined) {
      lines.push(`HTTP status: ${details.httpStatus}`);
    }
    if (details.responseHost) {
      lines.push(`Response host: ${details.responseHost}`);
    }
    if (details.responseType) {
      lines.push(`Response type: ${details.responseType}`);
    }
    if (details.attempt !== undefined) {
      lines.push(`Attempt: ${details.attempt}`);
    }
    if (details.hint) {
      lines.push(`Suggested fix: ${details.hint}`);
    }
    if (details.stack) {
      lines.push("", "Stack:", errors.redactDiagnostics(details.stack));
    }
    return lines.join("\n");
  }

  function failureState(source, fallback = {}) {
    const errorDetails = errors.serialize(source, fallback);
    return {
      status: "failed",
      phase: errorDetails.stage,
      current: 0,
      total: 50,
      message: fallback.message || "Request complete na thai.",
      error: errorDetails.message,
      errorDetails
    };
  }

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
    const details = state.error
      ? errors.serialize(state.errorDetails || { message: state.error }, {
          code: "UNEXPECTED_ERROR",
          stage: state.phase || "unknown"
        })
      : null;
    errorPanel.hidden = !details;
    if (details) {
      error.textContent = details.message;
      errorCode.textContent = details.code;
      errorStage.textContent = formatStage(details.stage);
      errorHttp.textContent = details.httpStatus ?? "-";
      errorTime.textContent = formatTime(details.timestamp);
      errorHint.textContent = details.hint || "";
      errorHint.hidden = !details.hint;
      diagnosticsText = buildDiagnostics(details, state);
      copyError.textContent = "Copy diagnostics";
    } else {
      diagnosticsText = "";
    }
    const stats = state.summary;
    summary.textContent = stats
      ? `Processed ${stats.processed || 0} | New ${stats.added || 0} | Updated ${stats.updated || 0} | Failed ${stats.failed || 0} | Missing price ${stats.missingPrice || 0} | Missing bought ${stats.missingBought || 0}`
      : "";
    summary.hidden = !stats || state.status !== "complete";
    const issues = Array.isArray(stats?.issues) ? stats.issues : [];
    issueList.replaceChildren();
    issues.forEach((issue) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      const detail = document.createElement("span");
      title.textContent = `${issue.asin} - ${formatStage(issue.status)}`;
      detail.textContent = issue.error;
      item.append(title, detail);
      issueList.append(item);
    });
    issuePanel.hidden = issues.length === 0;
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
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type });
    } catch (error) {
      render(
        failureState(error, {
          code: "RUNTIME_MESSAGE_FAILED",
          stage: "extension_messaging",
          message: "Extension background response na malyo."
        })
      );
      return;
    }
    if (!response?.ok) {
      if (response?.state?.status === "upload_failed") {
        render(response.state);
        return;
      }
      render(
        failureState(response?.errorDetails || response?.error, {
          code: "REQUEST_FAILED",
          stage: "extension_request",
          message: "Request complete na thai."
        })
      );
      return;
    }
    render(response.state);
  }

  start.addEventListener("click", async () => {
    try {
      await saveSettings();
      await request(messages.START_RUN);
    } catch (error) {
      render(
        failureState(error, {
          code: "SETTINGS_SAVE_FAILED",
          stage: "setup",
          message: "Settings save na thaya."
        })
      );
    }
  });
  cancel.addEventListener("click", () => request(messages.CANCEL_RUN));
  retry.addEventListener("click", async () => {
    try {
      await saveSettings();
      await request(messages.RETRY_UPLOAD);
    } catch (error) {
      render(
        failureState(error, {
          code: "SETTINGS_SAVE_FAILED",
          stage: "upload",
          message: "Retry pela settings save na thaya."
        })
      );
    }
  });
  openSheet.addEventListener("click", async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: messages.GET_STATE });
      if (!response?.ok) {
        throw errors.fromDetails(response?.errorDetails || {
          message: response?.error || "Sheet URL na malyu."
        });
      }
      await chrome.tabs.create({
        url: response.state?.sheetUrl || DEFAULT_SHEET_URL
      });
    } catch (error) {
      render(
        failureState(error, {
          code: "OPEN_SHEET_FAILED",
          stage: "open_sheet",
          message: "Google Sheet open na thai."
        })
      );
    }
  });

  copyError.addEventListener("click", async () => {
    if (!diagnosticsText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(diagnosticsText);
      copyError.textContent = "Copied";
    } catch {
      copyError.textContent = "Copy failed";
    }
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
  }).catch((error) => {
    render(
      failureState(error, {
        code: "POPUP_INITIALIZATION_FAILED",
        stage: "popup",
        message: "Extension popup initialize na thayu."
      })
    );
  });
})();

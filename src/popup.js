(function initPopup() {
  const { errors, messages, utils } = globalThis.AZScraper;
  const sourceModes = Array.from(
    document.querySelectorAll("input[name='source-mode']")
  );
  const marketplace = document.querySelector("#marketplace");
  const analysisName = document.querySelector("#analysis-name");
  const analysisNameField = document.querySelector(".analysis-name-field");
  const analysisNameStatus = document.querySelector("#analysis-name-status");
  const tabNamePreview = document.querySelector("#tab-name-preview");
  const searchWorkflow = document.querySelector("#search-workflow");
  const searchLabel = document.querySelector("#search-label");
  const searchQuery = document.querySelector("#search-query");
  const openSearch = document.querySelector("#open-search");
  const modeInstruction = document.querySelector("#mode-instruction");
  const endpoint = document.querySelector("#endpoint");
  const endpointField = document.querySelector(".endpoint-field");
  const endpointStatus = document.querySelector("#endpoint-status");
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
  const startStep = document.querySelector("#start-step");
  const openSheet = document.querySelector("#open-sheet");
  const cancel = document.querySelector("#cancel");
  const retry = document.querySelector("#retry");
  let diagnosticsText = "";
  let lastState = {};
  analysisName.maxLength = utils.ANALYSIS_NAME_MAX_LENGTH;

  function selectedSourceMode() {
    return sourceModes.find((input) => input.checked)?.value || "category";
  }

  function updateEndpointStatus() {
    const value = endpoint.value.trim();
    const valid = utils.isAppsScriptEndpoint(value);
    endpointField.dataset.valid = String(valid);
    endpointStatus.textContent = valid ? "Ready" : value ? "Invalid" : "Required";
    return valid;
  }

  function updateAnalysisNameStatus() {
    const validation = utils.validateAnalysisName(analysisName.value);
    analysisNameField.dataset.valid = String(validation.valid);
    analysisNameStatus.textContent = validation.valid
      ? "Ready"
      : validation.code === "ANALYSIS_NAME_MISSING"
        ? "Required"
        : "Invalid";
    analysisName.title = validation.valid ? "" : validation.message;
    tabNamePreview.textContent = validation.valid
      ? utils.buildAnalysisTabName(validation.name, marketplace.value)
      : `Analysis name - ${marketplace.value === "amazon.com" ? "USA" : "IN"}`;
    tabNamePreview.title = tabNamePreview.textContent;
    return validation.valid;
  }

  function updateStartAvailability(state = lastState) {
    const isBusy = ["running", "uploading"].includes(state.status);
    start.disabled =
      isBusy || !updateEndpointStatus() || !updateAnalysisNameStatus();
  }

  function renderSourceMode() {
    const sourceMode = selectedSourceMode();
    const isSearch = sourceMode !== "category";
    searchWorkflow.hidden = !isSearch;
    startStep.hidden = !isSearch;
    searchLabel.textContent =
      sourceMode === "brand" ? "Brand name" : "Product search term";
    searchQuery.placeholder =
      sourceMode === "brand" ? "e.g. Sellbotic" : "e.g. oil sprayer";
    modeInstruction.textContent =
      sourceMode === "category"
        ? "Open an Amazon category page, then start a focused product scan."
        : `Enter a ${sourceMode === "brand" ? "brand name" : "product term"}, open Amazon results, then run the analysis.`;
  }

  function updateOpenSheetAvailability(state = lastState) {
    const currentTabName = utils.buildAnalysisTabName(
      analysisName.value,
      marketplace.value
    );
    const endpointMatches =
      state.sheetUrl &&
      state.sheetEndpoint &&
      state.sheetEndpoint === endpoint.value.trim() &&
      state.analysisTabName === currentTabName;
    openSheet.disabled =
      !endpointMatches || ["running", "uploading"].includes(state.status);
    openSheet.title = endpointMatches
      ? "Open the Sheet used by this deployment"
      : "Sheet link will be available after a successful upload";
  }

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
      `Analysis tab: ${state.analysisTabName || "not-started"}`,
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
    lastState = state;
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
    marketplace.disabled = isBusy;
    sourceModes.forEach((input) => {
      input.disabled = isBusy;
    });
    searchQuery.disabled = isBusy;
    openSearch.disabled = isBusy;
    analysisName.disabled = isBusy;
    endpoint.disabled = isBusy;
    token.disabled = isBusy;
    cancel.hidden = state.status !== "running";
    retry.hidden = state.status !== "upload_failed";
    openSheet.hidden = false;
    updateStartAvailability(state);
    updateOpenSheetAvailability(state);
  }

  async function saveSettings() {
    const settings = {
      marketplace: marketplace.value,
      analysisName: analysisName.value.trim(),
      sourceMode: selectedSourceMode(),
      searchQuery: searchQuery.value.trim(),
      endpoint: endpoint.value.trim(),
      token: token.value
    };
    await chrome.storage.local.set({ settings });
    return settings;
  }

  async function persistSettings() {
    try {
      await saveSettings();
    } catch (error) {
      render(
        failureState(error, {
          code: "SETTINGS_SAVE_FAILED",
          stage: "setup",
          message: "Settings save na thaya."
        })
      );
    }
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

  openSearch.addEventListener("click", async () => {
    try {
      const sourceMode = selectedSourceMode();
      const query = searchQuery.value.trim();
      const searchUrl = utils.buildAmazonSearchUrl(marketplace.value, query);
      if (sourceMode === "category" || !searchUrl) {
        throw errors.create("Search keyword required chhe.", {
          code: "SEARCH_QUERY_MISSING",
          stage: "search_setup",
          hint: "Brand name athva product search term enter karo."
        });
      }
      await saveSettings();
      await chrome.tabs.create({ url: searchUrl, active: true });
    } catch (error) {
      render(
        failureState(error, {
          code: "OPEN_SEARCH_FAILED",
          stage: "search_setup",
          message: "Amazon search open na thayu."
        })
      );
    }
  });

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
      if (
        !response.state?.sheetUrl ||
        response.state.sheetEndpoint !== endpoint.value.trim() ||
        response.state.analysisTabName !==
          utils.buildAnalysisTabName(analysisName.value, marketplace.value)
      ) {
        throw errors.create("Aa deployment mate Sheet link haju available nathi.", {
          code: "SHEET_NOT_AVAILABLE",
          stage: "open_sheet",
          hint: "Pehla ek successful analysis upload complete karo."
        });
      }
      await chrome.tabs.create({
        url: response.state.sheetUrl
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

  sourceModes.forEach((input) => {
    input.addEventListener("change", () => {
      renderSourceMode();
      persistSettings();
    });
  });
  marketplace.addEventListener("change", () => {
    updateAnalysisNameStatus();
    updateStartAvailability();
    updateOpenSheetAvailability();
    persistSettings();
  });
  analysisName.addEventListener("input", () => {
    updateAnalysisNameStatus();
    updateStartAvailability();
    updateOpenSheetAvailability();
  });
  analysisName.addEventListener("change", persistSettings);
  searchQuery.addEventListener("change", persistSettings);
  endpoint.addEventListener("input", () => {
    updateStartAvailability();
    updateOpenSheetAvailability();
  });
  endpoint.addEventListener("change", persistSettings);

  chrome.runtime.onMessage.addListener((event) => {
    if (event.type === "STATE_UPDATED") {
      render(event.state);
    }
  });

  Promise.all([
    chrome.storage.local.get("settings"),
    chrome.runtime.sendMessage({ type: messages.GET_STATE })
  ]).then(([stored, response]) => {
    const settings = stored.settings || {};
    token.value = settings.token || "";
    endpoint.value = settings.endpoint || "";
    analysisName.value = settings.analysisName || "";
    marketplace.value = settings.marketplace || "amazon.in";
    searchQuery.value = settings.searchQuery || "";
    const sourceMode = ["category", "brand", "product"].includes(settings.sourceMode)
      ? settings.sourceMode
      : "category";
    const sourceInput = sourceModes.find((input) => input.value === sourceMode);
    if (sourceInput) {
      sourceInput.checked = true;
    }
    renderSourceMode();
    updateEndpointStatus();
    updateAnalysisNameStatus();
    if (!response?.ok) {
      throw errors.fromDetails(response?.errorDetails || {
        message: response?.error || "Extension state na malyu."
      });
    }
    render(response.state || {});
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

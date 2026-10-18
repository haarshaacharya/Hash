/**
 * HASH STUDIO — FRONTEND ENGINE
 * Handles theme toggling, clipboard operations, stream inspection,
 * quality selection, download execution, and download history.
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const form = document.querySelector("#url-form");
  const urlInput = document.querySelector("#url");
  const fetchBtn = document.querySelector("#fetch-btn");
  const clearBtn = document.querySelector("#clear-btn");
  const pasteBtn = document.querySelector("#paste-btn");
  const themeToggle = document.querySelector("#theme-toggle");
  
  const statusBox = document.querySelector("#status");
  const statusMsg = document.querySelector(".status-message");
  const statusIcon = document.querySelector(".status-icon");
  
  const resultBox = document.querySelector("#result");
  const thumbnailImg = document.querySelector("#thumbnail");
  const durationBadge = document.querySelector("#duration");
  const platformChip = document.querySelector("#platform-chip");
  const videoTitle = document.querySelector("#title");
  const videoSource = document.querySelector("#source");
  const qualityButtons = document.querySelectorAll(".quality");
  const downloadBtn = document.querySelector("#download-btn");
  const copyLinkBtn = document.querySelector("#copy-link-btn");
  
  const historySection = document.querySelector("#history-section");
  const historyList = document.querySelector("#history-list");
  const clearHistoryBtn = document.querySelector("#clear-history-btn");
  const platformBadges = document.querySelectorAll(".platform-badge");
  const toastBox = document.querySelector("#toast");

  // --- State Variables ---
  let selectedQuality = "best";
  let currentUrl = "";
  let currentVideoData = null;

  // ==========================================================================
  // THEME MANAGEMENT
  // ==========================================================================
  const savedTheme = localStorage.getItem("hash_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  themeToggle?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("hash_theme", next);
    showToast(`Switched to ${next} theme`);
  });

  // ==========================================================================
  // TOAST NOTIFICATIONS
  // ==========================================================================
  let toastTimer = null;
  function showToast(message, duration = 2800) {
    if (!toastBox) return;
    toastBox.textContent = message;
    toastBox.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastBox.classList.remove("show");
    }, duration);
  }

  // ==========================================================================
  // STATUS / ALERTS
  // ==========================================================================
  function setStatus(message, type = "info") {
    if (!statusBox) return;
    if (statusMsg) statusMsg.textContent = message;
    else statusBox.textContent = message;

    statusBox.className = `status show ${type}`;

    if (statusIcon) {
      if (type === "loading") {
        statusIcon.innerHTML = `<span class="spinner" style="width:14px;height:14px;display:inline-block;border-width:2px;"></span>`;
      } else if (type === "error") {
        statusIcon.innerHTML = `⚠️`;
      } else if (type === "success") {
        statusIcon.innerHTML = `✓`;
      } else {
        statusIcon.innerHTML = `ℹ️`;
      }
    }
  }

  function clearStatus() {
    if (!statusBox) return;
    statusBox.className = "status";
    if (statusMsg) statusMsg.textContent = "";
  }

  // ==========================================================================
  // INPUT INTERACTIONS (CLEAR & PASTE)
  // ==========================================================================
  function detectPlatform(url) {
    const lower = url.toLowerCase();
    platformBadges.forEach(badge => {
      const p = badge.dataset.platform;
      let matched = false;
      if (p === "instagram" && (lower.includes("instagram.com") || lower.includes("instagr.am"))) matched = true;
      if (p === "youtube" && (lower.includes("youtube.com") || lower.includes("youtu.be"))) matched = true;
      if (p === "facebook" && (lower.includes("facebook.com") || lower.includes("fb.watch"))) matched = true;
      if (p === "pinterest" && (lower.includes("pinterest.com") || lower.includes("pin.it"))) matched = true;
      badge.classList.toggle("active-platform", matched);
    });
  }

  urlInput.addEventListener("input", () => {
    const val = urlInput.value.trim();
    if (clearBtn) clearBtn.classList.toggle("hidden", val.length === 0);
    detectPlatform(val);
  });

  clearBtn?.addEventListener("click", () => {
    urlInput.value = "";
    clearBtn.classList.add("hidden");
    detectPlatform("");
    clearStatus();
    resultBox.classList.add("hidden");
    urlInput.focus();
  });

  pasteBtn?.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        if (clearBtn) clearBtn.classList.remove("hidden");
        detectPlatform(text);
        showToast("Link pasted from clipboard!");
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    } catch {
      showToast("Please allow clipboard access or paste manually with Ctrl+V");
      urlInput.focus();
    }
  });

  copyLinkBtn?.addEventListener("click", async () => {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      showToast("Video URL copied to clipboard!");
    } catch {
      showToast("Could not copy URL.");
    }
  });

  // Clicking platform badge populates placeholder guidance
  platformBadges.forEach(badge => {
    badge.addEventListener("click", () => {
      const p = badge.dataset.platform;
      showToast(`Ready for ${p.toUpperCase()} links. Paste your link above!`);
      urlInput.focus();
    });
  });

  // ==========================================================================
  // FETCH VIDEO INFO
  // ==========================================================================
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    currentUrl = urlInput.value.trim();
    if (!currentUrl) return;

    resultBox.classList.add("hidden");
    fetchBtn.disabled = true;
    const btnText = fetchBtn.querySelector(".btn-text");
    const btnArrow = fetchBtn.querySelector(".btn-arrow");
    const spinner = fetchBtn.querySelector(".spinner");

    if (btnText) btnText.textContent = "Analyzing…";
    if (btnArrow) btnArrow.classList.add("hidden");
    if (spinner) spinner.classList.remove("hidden");

    setStatus("Inspecting video streams & metadata…", "loading");

    try {
      const response = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not fetch details for this video.");
      }

      currentVideoData = data;

      // Populate Title & Source
      if (videoTitle) videoTitle.textContent = data.title || "Untitled Video";
      if (videoSource) videoSource.textContent = `${data.platform || "Direct Stream"} • Verified Stream Available`;
      if (platformChip) platformChip.textContent = data.platform || "Video";

      // Populate Thumbnail
      if (thumbnailImg) {
        if (data.thumbnail) {
          thumbnailImg.src = data.thumbnail;
          thumbnailImg.style.display = "block";
        } else {
          thumbnailImg.removeAttribute("src");
          thumbnailImg.style.display = "none";
        }
      }

      // Populate Duration
      if (durationBadge) {
        if (data.duration) {
          const mins = Math.floor(data.duration / 60);
          const secs = String(data.duration % 60).padStart(2, "0");
          durationBadge.textContent = `${mins}:${secs}`;
          durationBadge.style.display = "inline-block";
        } else {
          durationBadge.textContent = "";
          durationBadge.style.display = "none";
        }
      }

      // Evaluate Quality Formats
      const heights = (data.formats || []).map(f => f.height).filter(Boolean);
      qualityButtons.forEach(btn => {
        const limit = btn.dataset.quality;
        let available = true;

        if (limit === "best") {
          available = heights.length > 0;
        } else if (limit === "720") {
          available = heights.some(h => h <= 720);
        } else if (limit === "1080") {
          available = heights.some(h => h <= 1080);
        } else if (limit === "1440") {
          // 2K mode upscales source
          available = heights.length > 0;
        }

        btn.disabled = !available;
        btn.title = available ? "" : "Resolution not available for this source";
      });

      // Default to "best"
      selectedQuality = "best";
      qualityButtons.forEach(b => {
        b.classList.toggle("selected", b.dataset.quality === selectedQuality);
      });

      clearStatus();
      resultBox.classList.remove("hidden");
      resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      showToast("Video streams analyzed successfully!");

    } catch (err) {
      setStatus(err.message || "Failed to process URL. Check the link and try again.", "error");
    } finally {
      fetchBtn.disabled = false;
      if (btnText) btnText.textContent = "Fetch video";
      if (btnArrow) btnArrow.classList.remove("hidden");
      if (spinner) spinner.classList.add("hidden");
    }
  });

  // ==========================================================================
  // QUALITY SELECTION
  // ==========================================================================
  qualityButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      selectedQuality = btn.dataset.quality;
      qualityButtons.forEach(b => b.classList.toggle("selected", b === btn));
      clearStatus();
      showToast(`Selected format: ${btn.querySelector(".quality-main")?.textContent || selectedQuality}`);
    });
  });

  // ==========================================================================
  // DOWNLOAD EXECUTION
  // ==========================================================================
  downloadBtn.addEventListener("click", async () => {
    if (!currentUrl) return;

    downloadBtn.disabled = true;
    const dlText = downloadBtn.querySelector(".dl-text");
    const dlIcon = downloadBtn.querySelector(".dl-icon");
    const dlSpinner = downloadBtn.querySelector(".dl-spinner");

    if (dlText) dlText.textContent = "Processing & Merging…";
    if (dlIcon) dlIcon.classList.add("hidden");
    if (dlSpinner) dlSpinner.classList.remove("hidden");

    setStatus("Downloading and packaging video file. Please keep this tab open…", "loading");

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl, quality: selectedQuality })
      });

      if (!response.ok) {
        let msg = "Download process failed.";
        try {
          const errData = await response.json();
          msg = errData.error || msg;
        } catch { }
        throw new Error(msg);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match ? match[1] : `video_${selectedQuality}.mp4`;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      setStatus(`Download complete! Saved as "${filename}". Check your browser downloads.`, "success");
      showToast("Download completed successfully!");

      // Save to Session History
      if (currentVideoData) {
        saveToHistory({
          title: currentVideoData.title || "Video",
          url: currentUrl,
          thumbnail: currentVideoData.thumbnail || "",
          quality: selectedQuality,
          platform: currentVideoData.platform || "Video",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }

    } catch (err) {
      setStatus(err.message || "Failed to download video file.", "error");
    } finally {
      downloadBtn.disabled = false;
      if (dlText) dlText.textContent = "Download Video";
      if (dlIcon) dlIcon.classList.remove("hidden");
      if (dlSpinner) dlSpinner.classList.add("hidden");
    }
  });

  // ==========================================================================
  // DOWNLOAD HISTORY (LOCAL STORAGE)
  // ==========================================================================
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem("hash_history") || "[]");
    } catch {
      return [];
    }
  }

  function saveToHistory(item) {
    const list = getHistory();
    // Prepend and keep max 8 items
    const updated = [item, ...list.filter(x => x.url !== item.url)].slice(0, 8);
    localStorage.setItem("hash_history", JSON.stringify(updated));
    renderHistory();
  }

  function renderHistory() {
    const list = getHistory();
    if (!historySection || !historyList) return;

    if (list.length === 0) {
      historySection.classList.add("hidden");
      return;
    }

    historySection.classList.remove("hidden");
    historyList.innerHTML = list.map(item => `
      <div class="history-item">
        <div class="history-item-left">
          ${item.thumbnail ? `<img src="${item.thumbnail}" class="history-thumb" alt="Thumb" loading="lazy">` : `<div class="history-thumb"></div>`}
          <div class="history-info">
            <div class="history-title" title="${item.title}">${item.title}</div>
            <div class="history-meta">
              <span class="history-tag">${item.platform}</span>
              <span>• Quality: ${item.quality.toUpperCase()}</span>
              <span>• ${item.timestamp}</span>
            </div>
          </div>
        </div>
        <button class="history-action-btn" data-url="${item.url}" type="button">Load</button>
      </div>
    `).join("");

    historyList.querySelectorAll(".history-action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetUrl = btn.dataset.url;
        if (targetUrl) {
          urlInput.value = targetUrl;
          if (clearBtn) clearBtn.classList.remove("hidden");
          detectPlatform(targetUrl);
          urlInput.focus();
          form.dispatchEvent(new Event("submit", { cancelable: true }));
        }
      });
    });
  }

  clearHistoryBtn?.addEventListener("click", () => {
    localStorage.removeItem("hash_history");
    renderHistory();
    showToast("Download history cleared");
  });

  // Initial render of history
  renderHistory();
});

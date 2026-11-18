/**
 * HASH STUDIO — FRONTEND ENGINE
 * Handles theme toggling, clipboard operations, stream inspection,
 * media format switching (MP4 Video / MP3 Audio / Reel Studio Edit),
 * mouse/cursor-driven watermark & text positioning/resizing,
 * download execution, and session history.
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
  
  // Format & Options Elements
  const formatButtons = document.querySelectorAll(".format-opt");
  const videoOptionsWrapper = document.querySelector("#video-options-wrapper");
  const audioOptionsWrapper = document.querySelector("#audio-options-wrapper");
  const editOptionsWrapper = document.querySelector("#edit-options-wrapper");
  
  const qualityButtons = document.querySelectorAll(".quality");
  const audioButtons = document.querySelectorAll(".audio-opt");
  const mp3QualityButtons = document.querySelectorAll(".mp3-quality");
  
  // Editor Interactive Elements
  const editorCanvas = document.querySelector("#editor-canvas");
  const editorPreviewImg = document.querySelector("#editor-preview-img");
  const overlayLogoZone = document.querySelector("#overlay-logo-zone");
  const overlayTextZone = document.querySelector("#overlay-text-zone");
  const zoneLiveTextPreview = document.querySelector("#zone-live-text-preview");

  const selectBoxLogo = document.querySelector("#select-box-logo");
  const selectBoxText = document.querySelector("#select-box-text");

  const logoEnableToggle = document.querySelector("#logo-enable-toggle");
  const logoControlsBody = document.querySelector("#logo-controls-body");
  const logoPresetButtons = document.querySelectorAll("[data-logo-preset]");
  const logoMethodButtons = document.querySelectorAll("[data-logo-method]");
  const logoXSlider = document.querySelector("#logo-x-slider");
  const logoYSlider = document.querySelector("#logo-y-slider");
  const logoWSlider = document.querySelector("#logo-w-slider");
  const logoHSlider = document.querySelector("#logo-h-slider");
  const logoXVal = document.querySelector("#logo-x-val");
  const logoYVal = document.querySelector("#logo-y-val");
  const logoWVal = document.querySelector("#logo-w-val");
  const logoHVal = document.querySelector("#logo-h-val");

  const textEnableToggle = document.querySelector("#text-enable-toggle");
  const textControlsBody = document.querySelector("#text-controls-body");
  const textPresetButtons = document.querySelectorAll("[data-text-preset]");
  const textMethodButtons = document.querySelectorAll("[data-text-method]");
  const textActionButtons = document.querySelectorAll("[data-text-action]");
  const customTextFieldWrap = document.querySelector("#custom-text-field-wrap");
  const customTextInput = document.querySelector("#custom-text-input");
  const colorButtons = document.querySelectorAll(".color-btn");
  const textSizeButtons = document.querySelectorAll("[data-size]");
  const textXSlider = document.querySelector("#text-x-slider");
  const textYSlider = document.querySelector("#text-y-slider");
  const textWSlider = document.querySelector("#text-w-slider");
  const textHSlider = document.querySelector("#text-h-slider");
  const textXVal = document.querySelector("#text-x-val");
  const textYVal = document.querySelector("#text-y-val");
  const textWVal = document.querySelector("#text-w-val");
  const textHVal = document.querySelector("#text-h-val");

  // CTA Elements
  const downloadBtn = document.querySelector("#download-btn");
  const dlVideoIcon = document.querySelector(".dl-video-icon");
  const dlAudioIcon = document.querySelector(".dl-audio-icon");
  const dlEditIcon = document.querySelector(".dl-edit-icon");
  const qualityHelpText = document.querySelector(".quality-help-text");
  const copyLinkBtn = document.querySelector("#copy-link-btn");
  
  // History Elements
  const historySection = document.querySelector("#history-section");
  const historyList = document.querySelector("#history-list");
  const clearHistoryBtn = document.querySelector("#clear-history-btn");
  const platformBadges = document.querySelectorAll(".platform-badge");
  const toastBox = document.querySelector("#toast");

  // --- State Variables ---
  let selectedFormat = "mp4"; // "mp4", "mp3", or "edit"
  let selectedQuality = "best";
  let selectedAudio = "with";
  let selectedBitrate = "320"; // "320", "256", "192", "128"
  let currentUrl = "";
  let currentVideoData = null;

  // Reel Studio State Variables (TIGHT BOUNDS BY DEFAULT TO PREVENT SMEARING)
  let activeBox = "text"; // "logo" or "text"
  let logoEnabled = true;
  let logoX = 76, logoY = 5, logoW = 20, logoH = 10; // Top-Right preset (matches user Image 2 logo)
  let logoMethod = "delogo"; // "delogo", "blur", "mask"

  let textEnabled = true;
  let textX = 36, textY = 48, textW = 28, textH = 6; // Compact preset (tightly fits "my vibe.")
  let textMethod = "delogo"; // "delogo", "blur", "mask"
  let textAction = "erase"; // "erase" or "replace"
  let customText = "";
  let textColor = "white";
  let textSize = 34;

  // Drag & Resize State
  let isDragging = false;
  let isResizing = false;
  let resizeHandle = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialBoxState = null;
  let wasDragging = false;

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
  // UI UPDATE HELPER (DOWNLOAD BUTTON & HELP TEXT)
  // ==========================================================================
  function updateActionUI() {
    const dlText = downloadBtn?.querySelector(".dl-text");
    if (!dlText) return;

    downloadBtn.classList.remove("mp3-mode", "edit-mode");
    if (dlVideoIcon) dlVideoIcon.classList.add("hidden");
    if (dlAudioIcon) dlAudioIcon.classList.add("hidden");
    if (dlEditIcon) dlEditIcon.classList.add("hidden");

    if (selectedFormat === "edit") {
      downloadBtn.classList.add("edit-mode");
      if (dlEditIcon) dlEditIcon.classList.remove("hidden");
      dlText.textContent = "Clean Watermark & Download Reel";
      if (qualityHelpText) {
        qualityHelpText.textContent = "Tight bounding inpaint & soft blur removes logos without horizontal smearing.";
      }
    } else if (selectedFormat === "mp3") {
      downloadBtn.classList.add("mp3-mode");
      if (dlAudioIcon) dlAudioIcon.classList.remove("hidden");
      dlText.textContent = `Download Audio (MP3 · ${selectedBitrate} kbps)`;
      if (qualityHelpText) {
        qualityHelpText.textContent = `High-fidelity MP3 extraction (${selectedBitrate} kbps). Compatible with iPhone, Android, and car stereos.`;
      }
    } else {
      if (dlVideoIcon) dlVideoIcon.classList.remove("hidden");
      if (selectedAudio === "without") {
        dlText.textContent = "Download Video (No Sound)";
      } else {
        const qLabel = selectedQuality === "1440" ? "2K Upscaled" : (selectedQuality === "best" ? "Original" : `${selectedQuality}p`);
        dlText.textContent = `Download Video (${qLabel})`;
      }
      if (qualityHelpText) {
        qualityHelpText.textContent = "Merged in MP4 format. Choose with or without sound. 2K mode applies high-grade lanczos upscaling.";
      }
    }
  }

  // ==========================================================================
  // REEL STUDIO INTERACTIVE PREVIEW & ACTIVE TARGET UPDATER
  // ==========================================================================
  function setActiveBox(box) {
    activeBox = box;
    selectBoxLogo?.classList.toggle("active", activeBox === "logo");
    selectBoxText?.classList.toggle("active", activeBox === "text");
    overlayLogoZone?.classList.toggle("active-target", activeBox === "logo");
    overlayTextZone?.classList.toggle("active-target", activeBox === "text");
  }

  selectBoxLogo?.addEventListener("click", () => {
    setActiveBox("logo");
    showToast("Active: Watermark Box. Drag on video to position!");
  });

  selectBoxText?.addEventListener("click", () => {
    setActiveBox("text");
    showToast("Active: Text Box. Drag on video or click on text!");
  });

  function updateEditorPreview() {
    if (overlayLogoZone) {
      overlayLogoZone.classList.toggle("hidden", !logoEnabled);
      overlayLogoZone.style.left = `${logoX}%`;
      overlayLogoZone.style.top = `${logoY}%`;
      overlayLogoZone.style.width = `${logoW}%`;
      overlayLogoZone.style.height = `${logoH}%`;
      overlayLogoZone.classList.toggle("active-target", activeBox === "logo");
    }

    if (overlayTextZone) {
      overlayTextZone.classList.toggle("hidden", !textEnabled);
      overlayTextZone.style.left = `${textX}%`;
      overlayTextZone.style.top = `${textY}%`;
      overlayTextZone.style.width = `${textW}%`;
      overlayTextZone.style.height = `${textH}%`;
      overlayTextZone.classList.toggle("active-target", activeBox === "text");

      if (zoneLiveTextPreview) {
        if (textAction === "replace" && customText.trim()) {
          zoneLiveTextPreview.textContent = customText;
          zoneLiveTextPreview.style.color = textColor;
          zoneLiveTextPreview.style.fontSize = `${Math.max(10, Math.round(textSize * 0.35))}px`;
        } else {
          zoneLiveTextPreview.textContent = textAction === "replace" ? "Your New Text Here" : "Original Text Erased";
          zoneLiveTextPreview.style.color = "#fff";
          zoneLiveTextPreview.style.fontSize = "10px";
        }
      }
    }

    if (logoXVal) logoXVal.textContent = `${logoX}%`;
    if (logoYVal) logoYVal.textContent = `${logoY}%`;
    if (logoWVal) logoWVal.textContent = `${logoW}%`;
    if (logoHVal) logoHVal.textContent = `${logoH}%`;

    if (textXVal) textXVal.textContent = `${textX}%`;
    if (textYVal) textYVal.textContent = `${textY}%`;
    if (textWVal) textWVal.textContent = `${textW}%`;
    if (textHVal) textHVal.textContent = `${textH}%`;
  }

  // ==========================================================================
  // CURSOR MOUSE DRAG & RESIZE ENGINE FOR PREVIEW CANVAS
  // ==========================================================================
  function initPointerEvents(zoneElement, boxType) {
    if (!zoneElement) return;

    zoneElement.addEventListener("mousedown", (e) => {
      // Don't drag if clicked on a corner resize handle
      if (e.target.classList.contains("zone-corner")) return;
      e.preventDefault();
      e.stopPropagation();

      setActiveBox(boxType);
      isDragging = true;
      wasDragging = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      initialBoxState = boxType === "logo"
        ? { x: logoX, y: logoY, w: logoW, h: logoH }
        : { x: textX, y: textY, w: textW, h: textH };
    });

    zoneElement.addEventListener("touchstart", (e) => {
      if (e.target.classList.contains("zone-corner")) return;
      if (e.touches.length !== 1) return;

      setActiveBox(boxType);
      isDragging = true;
      wasDragging = false;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;

      initialBoxState = boxType === "logo"
        ? { x: logoX, y: logoY, w: logoW, h: logoH }
        : { x: textX, y: textY, w: textW, h: textH };
    }, { passive: true });

    // Handle corner resizing
    const corners = zoneElement.querySelectorAll(".zone-corner");
    corners.forEach(corner => {
      corner.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        setActiveBox(boxType);
        isResizing = true;
        wasDragging = false;
        resizeHandle = corner.dataset.handle;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        initialBoxState = boxType === "logo"
          ? { x: logoX, y: logoY, w: logoW, h: logoH }
          : { x: textX, y: textY, w: textW, h: textH };
      });

      corner.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1) return;
        e.stopPropagation();

        setActiveBox(boxType);
        isResizing = true;
        wasDragging = false;
        resizeHandle = corner.dataset.handle;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;

        initialBoxState = boxType === "logo"
          ? { x: logoX, y: logoY, w: logoW, h: logoH }
          : { x: textX, y: textY, w: textW, h: textH };
      }, { passive: true });
    });
  }

  initPointerEvents(overlayLogoZone, "logo");
  initPointerEvents(overlayTextZone, "text");

  // Global window pointer move for buttery smooth dragging
  function handlePointerMove(e) {
    if (!isDragging && !isResizing) return;
    if (!editorCanvas) return;

    const rect = editorCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
    if (clientX === undefined || clientY === undefined) return;

    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      wasDragging = true;
    }

    const dxPct = (dx / rect.width) * 100;
    const dyPct = (dy / rect.height) * 100;

    if (isDragging) {
      if (activeBox === "logo") {
        logoX = Math.max(0, Math.min(100 - logoW, Math.round(initialBoxState.x + dxPct)));
        logoY = Math.max(0, Math.min(100 - logoH, Math.round(initialBoxState.y + dyPct)));
        if (logoXSlider) logoXSlider.value = logoX;
        if (logoYSlider) logoYSlider.value = logoY;
      } else {
        textX = Math.max(0, Math.min(100 - textW, Math.round(initialBoxState.x + dxPct)));
        textY = Math.max(0, Math.min(100 - textH, Math.round(initialBoxState.y + dyPct)));
        if (textXSlider) textXSlider.value = textX;
        if (textYSlider) textYSlider.value = textY;
      }
      updateEditorPreview();
    } else if (isResizing) {
      let newX = initialBoxState.x;
      let newY = initialBoxState.y;
      let newW = initialBoxState.w;
      let newH = initialBoxState.h;

      if (resizeHandle === "br") {
        newW = Math.max(4, Math.min(100 - newX, Math.round(initialBoxState.w + dxPct)));
        newH = Math.max(2, Math.min(100 - newY, Math.round(initialBoxState.h + dyPct)));
      } else if (resizeHandle === "bl") {
        const maxLeft = initialBoxState.x + initialBoxState.w - 4;
        newX = Math.max(0, Math.min(maxLeft, Math.round(initialBoxState.x + dxPct)));
        newW = Math.round(initialBoxState.w - (newX - initialBoxState.x));
        newH = Math.max(2, Math.min(100 - newY, Math.round(initialBoxState.h + dyPct)));
      } else if (resizeHandle === "tr") {
        const maxTop = initialBoxState.y + initialBoxState.h - 2;
        newY = Math.max(0, Math.min(maxTop, Math.round(initialBoxState.y + dyPct)));
        newH = Math.round(initialBoxState.h - (newY - initialBoxState.y));
        newW = Math.max(4, Math.min(100 - newX, Math.round(initialBoxState.w + dxPct)));
      } else if (resizeHandle === "tl") {
        const maxLeft = initialBoxState.x + initialBoxState.w - 4;
        const maxTop = initialBoxState.y + initialBoxState.h - 2;
        newX = Math.max(0, Math.min(maxLeft, Math.round(initialBoxState.x + dxPct)));
        newY = Math.max(0, Math.min(maxTop, Math.round(initialBoxState.y + dyPct)));
        newW = Math.round(initialBoxState.w - (newX - initialBoxState.x));
        newH = Math.round(initialBoxState.h - (newY - initialBoxState.y));
      }

      if (activeBox === "logo") {
        logoX = newX; logoY = newY; logoW = newW; logoH = newH;
        if (logoXSlider) logoXSlider.value = logoX;
        if (logoYSlider) logoYSlider.value = logoY;
        if (logoWSlider) logoWSlider.value = logoW;
        if (logoHSlider) logoHSlider.value = logoH;
      } else {
        textX = newX; textY = newY; textW = newW; textH = newH;
        if (textXSlider) textXSlider.value = textX;
        if (textYSlider) textYSlider.value = textY;
        if (textWSlider) textWSlider.value = textW;
        if (textHSlider) textHSlider.value = textH;
      }
      updateEditorPreview();
    }
  }

  function handlePointerUp() {
    if (isDragging || isResizing) {
      isDragging = false;
      isResizing = false;
      resizeHandle = null;
    }
  }

  window.addEventListener("mousemove", handlePointerMove, { passive: false });
  window.addEventListener("mouseup", handlePointerUp);
  window.addEventListener("touchmove", handlePointerMove, { passive: false });
  window.addEventListener("touchend", handlePointerUp);

  // Click-to-Position on Canvas (click anywhere on video to snap box right there!)
  editorCanvas?.addEventListener("click", (e) => {
    if (wasDragging) {
      wasDragging = false;
      return;
    }
    if (e.target.classList.contains("zone-corner") || e.target.closest(".overlay-zone")) {
      return;
    }

    const rect = editorCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    if (activeBox === "logo") {
      logoX = Math.max(0, Math.min(100 - logoW, Math.round(clickX - logoW / 2)));
      logoY = Math.max(0, Math.min(100 - logoH, Math.round(clickY - logoH / 2)));
      if (logoXSlider) logoXSlider.value = logoX;
      if (logoYSlider) logoYSlider.value = logoY;
      showToast("Watermark box moved to cursor position!");
    } else {
      textX = Math.max(0, Math.min(100 - textW, Math.round(clickX - textW / 2)));
      textY = Math.max(0, Math.min(100 - textH, Math.round(clickY - textH / 2)));
      if (textXSlider) textXSlider.value = textX;
      if (textYSlider) textYSlider.value = textY;
      showToast("Text box moved to cursor position!");
    }
    updateEditorPreview();
  });

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

    setStatus("Inspecting streams & audio metadata…", "loading");

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

      // Populate Thumbnails
      if (data.thumbnail) {
        if (thumbnailImg) {
          thumbnailImg.src = data.thumbnail;
          thumbnailImg.style.display = "block";
        }
        if (editorPreviewImg) {
          editorPreviewImg.src = data.thumbnail;
        }
      } else {
        if (thumbnailImg) {
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
          available = heights.length > 0;
        }

        btn.disabled = !available;
        btn.title = available ? "" : "Resolution not available for this source";
      });

      // Reset to defaults
      selectedFormat = "mp4";
      formatButtons.forEach(b => b.classList.toggle("selected", b.dataset.format === "mp4"));
      videoOptionsWrapper?.classList.remove("hidden");
      audioOptionsWrapper?.classList.add("hidden");
      editOptionsWrapper?.classList.add("hidden");

      selectedQuality = "best";
      qualityButtons.forEach(b => {
        b.classList.toggle("selected", b.dataset.quality === selectedQuality);
      });

      selectedAudio = "with";
      audioButtons.forEach(b => {
        b.classList.toggle("selected", b.dataset.audio === "with");
      });

      selectedBitrate = "320";
      mp3QualityButtons.forEach(b => {
        b.classList.toggle("selected", b.dataset.bitrate === "320");
      });

      // Default tight text bounds
      textX = 36; textY = 48; textW = 28; textH = 6;
      logoX = 76; logoY = 5; logoW = 20; logoH = 10;
      setActiveBox("text");

      updateActionUI();
      updateEditorPreview();

      clearStatus();
      resultBox.classList.remove("hidden");
      resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      showToast("Media loaded! Choose MP4, MP3, or Clean & Edit Reel.");

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
  // FORMAT SELECTION (MP4 VIDEO vs MP3 AUDIO vs REEL STUDIO)
  // ==========================================================================
  formatButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      selectedFormat = btn.dataset.format || "mp4";
      formatButtons.forEach(b => b.classList.toggle("selected", b === btn));

      videoOptionsWrapper?.classList.toggle("hidden", selectedFormat !== "mp4");
      audioOptionsWrapper?.classList.toggle("hidden", selectedFormat !== "mp3");
      editOptionsWrapper?.classList.toggle("hidden", selectedFormat !== "edit");

      if (selectedFormat === "edit") {
        showToast("Reel Studio Active: Use cursor on video to drag & resize boxes!");
        setActiveBox("text");
        updateEditorPreview();
      } else if (selectedFormat === "mp3") {
        showToast(`Switched to MP3 Audio Mode (${selectedBitrate} kbps)`);
      } else {
        showToast("Switched to MP4 Video Mode");
      }

      clearStatus();
      updateActionUI();
    });
  });

  // ==========================================================================
  // REEL STUDIO CONTROLS WIRING
  // ==========================================================================
  // 1. Logo Removal Toggle
  logoEnableToggle?.addEventListener("change", (e) => {
    logoEnabled = e.target.checked;
    logoControlsBody?.classList.toggle("disabled-body", !logoEnabled);
    updateEditorPreview();
    showToast(logoEnabled ? "Watermark removal enabled" : "Watermark removal disabled");
  });

  // Logo Presets
  logoPresetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      logoPresetButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const preset = btn.dataset.logoPreset;

      if (preset === "top-right") {
        logoX = 76; logoY = 5; logoW = 20; logoH = 10;
      } else if (preset === "top-left") {
        logoX = 4; logoY = 5; logoW = 20; logoH = 10;
      } else if (preset === "bottom-right") {
        logoX = 74; logoY = 86; logoW = 22; logoH = 9;
      } else if (preset === "bottom-left") {
        logoX = 4; logoY = 86; logoW = 22; logoH = 9;
      }

      if (logoXSlider) logoXSlider.value = logoX;
      if (logoYSlider) logoYSlider.value = logoY;
      if (logoWSlider) logoWSlider.value = logoW;
      if (logoHSlider) logoHSlider.value = logoH;

      setActiveBox("logo");
      updateEditorPreview();
      showToast(`Watermark preset set to ${preset.replace("-", " ").toUpperCase()}`);
    });
  });

  // Logo Method
  logoMethodButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      logoMethodButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      logoMethod = btn.dataset.logoMethod || "delogo";
      showToast(`Logo removal style: ${btn.textContent.trim()}`);
    });
  });

  // Logo Sliders
  logoXSlider?.addEventListener("input", (e) => { logoX = parseInt(e.target.value); updateEditorPreview(); });
  logoYSlider?.addEventListener("input", (e) => { logoY = parseInt(e.target.value); updateEditorPreview(); });
  logoWSlider?.addEventListener("input", (e) => { logoW = parseInt(e.target.value); updateEditorPreview(); });
  logoHSlider?.addEventListener("input", (e) => { logoH = parseInt(e.target.value); updateEditorPreview(); });

  // 2. Text Editing Toggle
  textEnableToggle?.addEventListener("change", (e) => {
    textEnabled = e.target.checked;
    textControlsBody?.classList.toggle("disabled-body", !textEnabled);
    if (textEnabled) setActiveBox("text");
    updateEditorPreview();
    showToast(textEnabled ? "Text editing enabled" : "Text editing disabled");
  });

  // Text Presets (with compact "my vibe." tight box to prevent horizontal smears)
  textPresetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      textPresetButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const preset = btn.dataset.textPreset;

      if (preset === "compact") {
        textX = 36; textY = 48; textW = 28; textH = 6;
      } else if (preset === "quote") {
        textX = 20; textY = 47; textW = 60; textH = 8;
      } else if (preset === "bottom") {
        textX = 20; textY = 80; textW = 60; textH = 8;
      } else if (preset === "top") {
        textX = 20; textY = 14; textW = 60; textH = 8;
      }

      if (textXSlider) textXSlider.value = textX;
      if (textYSlider) textYSlider.value = textY;
      if (textWSlider) textWSlider.value = textW;
      if (textHSlider) textHSlider.value = textH;

      setActiveBox("text");
      updateEditorPreview();
      showToast(`Text preset: ${btn.textContent.trim()}`);
    });
  });

  // Text Method (Smart Inpaint vs Frosted Blur vs Dark Mask)
  textMethodButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      textMethodButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      textMethod = btn.dataset.textMethod || "delogo";
      showToast(`Text removal technique: ${btn.textContent.trim()}`);
    });
  });

  // Text Action (Erase vs Replace)
  textActionButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      textActionButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      textAction = btn.dataset.textAction || "erase";
      customTextFieldWrap?.classList.toggle("hidden", textAction !== "replace");
      updateEditorPreview();
      showToast(textAction === "replace" ? "Mode: Replace with your text" : "Mode: Erase original text only");
    });
  });

  // Custom Text Input
  customTextInput?.addEventListener("input", (e) => {
    customText = e.target.value;
    updateEditorPreview();
  });

  // Color Pickers
  colorButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      colorButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      textColor = btn.dataset.color || "white";
      updateEditorPreview();
    });
  });

  // Font Size
  textSizeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      textSizeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      textSize = parseInt(btn.dataset.size || "34");
      updateEditorPreview();
    });
  });

  // Text Sliders
  textXSlider?.addEventListener("input", (e) => { textX = parseInt(e.target.value); updateEditorPreview(); });
  textYSlider?.addEventListener("input", (e) => { textY = parseInt(e.target.value); updateEditorPreview(); });
  textWSlider?.addEventListener("input", (e) => { textW = parseInt(e.target.value); updateEditorPreview(); });
  textHSlider?.addEventListener("input", (e) => { textH = parseInt(e.target.value); updateEditorPreview(); });

  // ==========================================================
  // QUALITY SELECTION (MP4)
  // ==========================================================
  qualityButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      selectedQuality = btn.dataset.quality;
      qualityButtons.forEach(b => b.classList.toggle("selected", b === btn));
      clearStatus();
      updateActionUI();
      showToast(`Selected format: ${btn.querySelector(".quality-main")?.textContent || selectedQuality}`);
    });
  });

  // ==========================================================
  // AUDIO SELECTION (WITH SOUND / WITHOUT SOUND)
  // ==========================================================
  audioButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      selectedAudio = btn.dataset.audio || "with";
      audioButtons.forEach(b => b.classList.toggle("selected", b === btn));
      clearStatus();
      updateActionUI();
      if (selectedAudio === "without") {
        showToast("Audio set to: Without Sound (Muted)");
      } else {
        showToast("Audio set to: With Sound (Original Audio)");
      }
    });
  });

  // ==========================================================
  // MP3 BITRATE SELECTION
  // ==========================================================
  mp3QualityButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      selectedBitrate = btn.dataset.bitrate || "320";
      mp3QualityButtons.forEach(b => b.classList.toggle("selected", b === btn));
      clearStatus();
      updateActionUI();
      showToast(`Selected MP3 bitrate: ${selectedBitrate} kbps`);
    });
  });

  // ==========================================================================
  // DOWNLOAD EXECUTION
  // ==========================================================================
  downloadBtn.addEventListener("click", async () => {
    if (!currentUrl) return;

    downloadBtn.disabled = true;
    const dlText = downloadBtn.querySelector(".dl-text");
    const dlSpinner = downloadBtn.querySelector(".dl-spinner");

    if (dlVideoIcon) dlVideoIcon.classList.add("hidden");
    if (dlAudioIcon) dlAudioIcon.classList.add("hidden");
    if (dlEditIcon) dlEditIcon.classList.add("hidden");
    if (dlSpinner) dlSpinner.classList.remove("hidden");

    if (selectedFormat === "edit") {
      if (dlText) dlText.textContent = "Inpainting & Cleaning Reel…";
      setStatus("Applying precision inpaint watermark removal & text editing with FFmpeg. Please keep this tab open…", "loading");
    } else if (selectedFormat === "mp3") {
      if (dlText) dlText.textContent = "Extracting & Converting MP3…";
      setStatus(`Downloading and converting audio stream to ${selectedBitrate} kbps MP3. Please keep this tab open…`, "loading");
    } else if (selectedAudio === "without") {
      if (dlText) dlText.textContent = "Processing Video (Muted)…";
      setStatus("Downloading and generating silent video (no sound). Please keep this tab open…", "loading");
    } else {
      if (dlText) dlText.textContent = "Processing & Merging Video…";
      setStatus("Downloading and packaging video file with audio. Please keep this tab open…", "loading");
    }

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentUrl,
          format: selectedFormat,
          quality: selectedQuality,
          audio: selectedAudio,
          audio_quality: selectedBitrate,
          title: currentVideoData?.title || "",
          // Reel Studio parameters
          logo_enabled: logoEnabled,
          logo_x_pct: logoX,
          logo_y_pct: logoY,
          logo_w_pct: logoW,
          logo_h_pct: logoH,
          logo_method: logoMethod,
          text_enabled: textEnabled,
          text_x_pct: textX,
          text_y_pct: textY,
          text_w_pct: textW,
          text_h_pct: textH,
          text_method: textMethod,
          text_action: textAction,
          new_text: customText,
          text_color: textColor,
          text_size: textSize
        })
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
      
      const safeTitle = (currentVideoData?.title || "download").replace(/[\\/*?:"<>|]/g, "").trim().substring(0, 60);
      let defaultFilename;
      if (selectedFormat === "edit") {
        defaultFilename = `${safeTitle || 'reel'}_clean.mp4`;
      } else if (selectedFormat === "mp3") {
        defaultFilename = `${safeTitle || 'audio'}.mp3`;
      } else {
        defaultFilename = selectedAudio === "without" ? `${safeTitle || 'video'}_no_sound.mp4` : `${safeTitle || 'video'}.mp4`;
      }
      const filename = match ? match[1] : defaultFilename;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      if (selectedFormat === "edit") {
        setStatus(`Cleaned reel saved successfully as "${filename}"! Check your downloads.`, "success");
        showToast("Watermark removed & clean reel downloaded!");
      } else if (selectedFormat === "mp3") {
        setStatus(`Download complete! Saved as MP3 audio "${filename}". Check your browser downloads.`, "success");
        showToast("MP3 Download completed successfully!");
      } else {
        const successLabel = selectedAudio === "without" ? "Saved without sound" : "Saved with sound";
        setStatus(`Download complete! ${successLabel} as "${filename}". Check your browser downloads.`, "success");
        showToast(selectedAudio === "without" ? "Downloaded without sound!" : "Download completed successfully!");
      }

      // Save to Session History
      if (currentVideoData) {
        saveToHistory({
          title: currentVideoData.title || "Media",
          url: currentUrl,
          thumbnail: currentVideoData.thumbnail || "",
          format: selectedFormat,
          quality: selectedQuality,
          audio: selectedAudio,
          audioQuality: selectedBitrate,
          platform: currentVideoData.platform || "Media",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }

    } catch (err) {
      setStatus(err.message || "Failed to download media file.", "error");
    } finally {
      downloadBtn.disabled = false;
      if (dlSpinner) dlSpinner.classList.add("hidden");
      updateActionUI();
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
    historyList.innerHTML = list.map(item => {
      let formatBadge = "";
      if (item.format === "edit") {
        formatBadge = `<span class="history-format-tag edit-tag">✂️ CLEAN REEL</span>`;
      } else if (item.format === "mp3") {
        formatBadge = `<span class="history-format-tag mp3-tag">🎵 MP3 (${item.audioQuality || "320"}k)</span>`;
      } else {
        formatBadge = `<span class="history-format-tag mp4-tag">🎬 ${(item.quality || "Original").toUpperCase()}</span>`;
      }

      const audioBadge = item.format === "mp4" && item.audio === "without" ? `<span>• 🔇 Muted</span>` : "";

      return `
        <div class="history-item">
          <div class="history-item-left">
            ${item.thumbnail ? `<img src="${item.thumbnail}" class="history-thumb" alt="Thumb" loading="lazy">` : `<div class="history-thumb"></div>`}
            <div class="history-info">
              <div class="history-title" title="${item.title}">${item.title}</div>
              <div class="history-meta">
                <span class="history-tag">${item.platform}</span>
                ${formatBadge}
                ${audioBadge}
                <span>• ${item.timestamp}</span>
              </div>
            </div>
          </div>
          <button class="history-action-btn" data-url="${item.url}" type="button">Load</button>
        </div>
      `;
    }).join("");

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

  // Initial render of history & preview
  renderHistory();
  updateEditorPreview();
});

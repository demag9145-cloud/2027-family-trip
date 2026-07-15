(function () {
  const trip = window.TRIP_ITINERARY;
  const stops = trip.stops;
  const key = trip.storageKey;
  const progressKey = "familyTripProgressV2";
  const PARENT_TOOL_PASSWORD = "2027";
  const parentUnlockKey = "parentToolsUnlocked";

  const elements = {
    progress: document.getElementById("progressText"),
    progressBar: document.getElementById("progressBar"),
    current: document.getElementById("currentStop"),
    todayDetails: document.getElementById("todayDetails"),
    todayList: document.getElementById("todayList"),
    allList: document.getElementById("allList"),
    parentTools: document.getElementById("parentToolsContent"),
    modal: document.getElementById("modal"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody")
  };

  const viewer = document.createElement("div");
  viewer.id = "imageViewer";
  viewer.className = "image-viewer hidden";
  viewer.innerHTML = `
    <div class="viewer-backdrop" data-close-viewer></div>
    <button class="viewer-close" type="button" aria-label="關閉" data-close-viewer>×</button>
    <button class="viewer-nav viewer-prev" type="button" aria-label="上一張">‹</button>
    <div class="viewer-stage" data-close-viewer>
      <img id="viewerImage" alt="">
    </div>
    <button class="viewer-nav viewer-next" type="button" aria-label="下一張">›</button>
  `;
  document.body.appendChild(viewer);

  const viewerImage = viewer.querySelector("#viewerImage");
  const viewerPrev = viewer.querySelector(".viewer-prev");
  const viewerNext = viewer.querySelector(".viewer-next");
  let viewerImages = [];
  let viewerIndex = 0;
  let viewerScale = 1;
  let viewerX = 0;
  let viewerY = 0;
  let dragging = false;
  let dragStart = { x: 0, y: 0, imageX: 0, imageY: 0 };
  let pinchStart = null;

  function parentToolsUnlocked() {
    return sessionStorage.getItem(parentUnlockKey) === "true";
  }

  function setParentToolsUnlocked(value) {
    if (value) sessionStorage.setItem(parentUnlockKey, "true");
    else sessionStorage.removeItem(parentUnlockKey);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function mapsUrl(query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function telUrl(phone) {
    return `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
  }

  function hasList(value) {
    return Array.isArray(value) && value.length > 0;
  }

  function isUsefulText(value) {
    const text = String(value ?? "").trim();
    if (!text) return false;
    const invalid = ["TODO", "待補", "地址待補", "電話待補", "菜單待補", "備註待補", "地址與電話待補 TODO", "undefined", "null"];
    return !invalid.some((item) => text === item || text.includes(item));
  }

  function cleanText(value) {
    return isUsefulText(value) ? String(value).trim() : "";
  }

  function cleanList(items) {
    if (!hasList(items)) return [];
    return items.map(cleanText).filter(Boolean);
  }

  function dayStops(day) {
    return stops.filter((stop) => stop.day === day);
  }

  function daySegments(day) {
    const list = dayStops(day);
    if (day === 1) return list.slice(1);
    return list;
  }

  function defaultProgress() {
    return {
      currentDay: 1,
      selectedSegmentIndex: 0,
      completedDays: { "1": false, "2": false, "3": false, "4": false }
    };
  }

  function normalizeProgress(progress) {
    const fallback = defaultProgress();
    const currentDay = Math.max(1, Math.min(4, Number.parseInt(progress?.currentDay || fallback.currentDay, 10) || 1));
    const segments = daySegments(currentDay);
    const maxIndex = Math.max(0, segments.length - 1);
    const selectedSegmentIndex = Math.max(0, Math.min(maxIndex, Number.parseInt(progress?.selectedSegmentIndex || 0, 10) || 0));
    return {
      currentDay,
      selectedSegmentIndex,
      completedDays: {
        ...fallback.completedDays,
        ...(progress?.completedDays || {})
      }
    };
  }

  function progressFromLegacyIndex() {
    const legacyIndex = Number.parseInt(localStorage.getItem(key) || "", 10);
    if (Number.isNaN(legacyIndex)) return null;
    const targetStop = stops[legacyIndex + 1] || stops[legacyIndex] || stops[0];
    if (!targetStop) return null;
    const currentDay = targetStop.day || 1;
    const selectedSegmentIndex = Math.max(0, daySegments(currentDay).findIndex((stop) => stop.id === targetStop.id));
    return normalizeProgress({
      currentDay,
      selectedSegmentIndex,
      completedDays: defaultProgress().completedDays
    });
  }

  function getProgress() {
    try {
      const stored = JSON.parse(localStorage.getItem(progressKey) || "null");
      if (stored && typeof stored === "object") return normalizeProgress(stored);
    } catch (error) {
      console.warn("Progress data could not be parsed; using default progress.");
    }

    const migrated = progressFromLegacyIndex();
    const progress = migrated || defaultProgress();
    saveProgress(progress);
    return progress;
  }

  function saveProgress(progress) {
    localStorage.setItem(progressKey, JSON.stringify(normalizeProgress(progress)));
  }

  function segmentState(progress = getProgress()) {
    const normalized = normalizeProgress(progress);
    const segments = daySegments(normalized.currentDay);
    const nextStop = segments[normalized.selectedSegmentIndex] || segments[0] || stops[0];
    const globalIndex = stops.findIndex((stop) => stop.id === nextStop?.id);
    const currentStop = stops[Math.max(0, globalIndex - 1)] || nextStop;
    return {
      progress: normalized,
      segments,
      currentStop,
      nextStop,
      targetGlobalIndex: globalIndex
    };
  }

  function selectSegment(day, selectedSegmentIndex) {
    const current = getProgress();
    saveProgress({
      ...current,
      currentDay: day,
      selectedSegmentIndex,
      completedDays: { ...current.completedDays, [String(day)]: false }
    });
    renderCurrent();
    elements.todayDetails?.removeAttribute("open");
    elements.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function completeDay(day) {
    const current = getProgress();
    saveProgress({
      ...current,
      currentDay: day,
      completedDays: { ...current.completedDays, [String(day)]: true }
    });
    renderCurrent();
    elements.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setDayTheme(day) {
    document.body.classList.remove("day-1", "day-2", "day-3", "day-4");
    document.body.classList.add(`day-${Math.max(1, Math.min(day || 1, 4))}`);
  }

  function updateProgress(progress, completed = false) {
    const segments = daySegments(progress.currentDay);
    const total = Math.max(1, segments.length);
    const current = Math.max(1, Math.min(total, progress.selectedSegmentIndex + 1));
    setDayTheme(progress.currentDay);
    elements.progress.textContent = completed
      ? `Day ${progress.currentDay}｜今日行程已完成`
      : `Day ${progress.currentDay}｜今日第 ${current} / ${total} 站`;
    elements.progressBar.style.width = completed ? "100%" : `${Math.round((current / total) * 100)}%`;
  }

  function openModal(title, bodyHtml) {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = bodyHtml;
    elements.modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    elements.modal.classList.add("hidden");
    if (viewer.classList.contains("hidden")) {
      document.body.classList.remove("modal-open");
    }
  }

  function openResetConfirmModal() {
    openModal("重新開始整趟行程？", `
      <p class="description">這會清除所有天數的目前行程與完成狀態。</p>
      <div class="modal-actions action-grid actions-2">
        <button class="mini-button" type="button" data-close-modal>取消</button>
        <button class="mini-button primary danger-action" type="button" data-action="confirm-reset">確認重新開始</button>
      </div>
    `);
  }

  function encodedAssetPath(path) {
    return encodeURI(String(path || ""));
  }

  function listHtml(items) {
    const cleanItems = cleanList(items);
    if (!hasList(cleanItems)) return "<p>目前沒有補充內容。</p>";
    return `<ul>${cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function linksHtml(links) {
    if (!hasList(links)) return "";
    return links
      .map((link) => `<a class="modal-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a>`)
      .join("");
  }

  function imageHtml(paths) {
    if (!hasList(paths)) {
      return '<p class="image-empty">目前沒有可顯示的菜單圖片</p>';
    }

    return paths.map((path, index) => `
      <div class="image-frame">
        <img src="${escapeHtml(encodedAssetPath(path))}" alt="" loading="lazy" data-image-index="${index}" onerror="console.warn('Image failed to load'); this.closest('.image-frame').remove(); if (!document.querySelector('#modalBody .image-frame')) document.querySelector('#modalBody').innerHTML = '<p class=&quot;image-empty&quot;>目前沒有可顯示的菜單圖片</p>';">
      </div>
    `).join("");
  }

  function updateViewerTransform() {
    viewerImage.style.transform = `translate(${viewerX}px, ${viewerY}px) scale(${viewerScale})`;
  }

  function showViewerImage(index) {
    if (!hasList(viewerImages)) return;
    viewerIndex = (index + viewerImages.length) % viewerImages.length;
    viewerScale = 1;
    viewerX = 0;
    viewerY = 0;
    viewerImage.src = encodedAssetPath(viewerImages[viewerIndex]);
    updateViewerTransform();
    const multi = viewerImages.length > 1;
    viewerPrev.hidden = !multi;
    viewerNext.hidden = !multi;
  }

  function openViewer(paths, index) {
    viewerImages = paths || [];
    if (!hasList(viewerImages)) return;
    showViewerImage(index || 0);
    viewer.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeViewer() {
    viewer.classList.add("hidden");
    viewerImage.removeAttribute("src");
    viewerImages = [];
    if (elements.modal.classList.contains("hidden")) {
      document.body.classList.remove("modal-open");
    }
  }

  function zoomViewer(delta, originX, originY) {
    const previous = viewerScale;
    viewerScale = Math.max(1, Math.min(4, viewerScale + delta));
    if (viewerScale === 1) {
      viewerX = 0;
      viewerY = 0;
    } else if (originX !== undefined && originY !== undefined) {
      const rect = viewerImage.getBoundingClientRect();
      const offsetX = originX - (rect.left + rect.width / 2);
      const offsetY = originY - (rect.top + rect.height / 2);
      const ratio = viewerScale / previous - 1;
      viewerX -= offsetX * ratio;
      viewerY -= offsetY * ratio;
    }
    updateViewerTransform();
  }

  function touchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function shortLabel(label) {
    return String(label || "").replace("手工披薩", "").trim();
  }

  function navTargetsFor(stop) {
    if (!stop) return [];
    if (hasList(stop.navigationTargets)) return stop.navigationTargets;
    if (stop.mapQuery) return [{ label: stop.title, query: stop.mapQuery, phone: stop.phone || "", menuImages: stop.menuImages || [] }];
    return [];
  }

  function buttonOrDisabled(query, label) {
    if (!query) return "";
    return `<a class="mini-button primary" href="${mapsUrl(query)}" target="_blank" rel="noopener">${escapeHtml(label || "導航")}</a>`;
  }

  function phoneButton(phone) {
    if (!phone) return "";
    return `<a class="mini-button" href="${telUrl(phone)}">電話</a>`;
  }

  function menuButton(images, action, index) {
    if (!hasList(images)) return "";
    const attr = index === undefined ? "" : ` data-alt-index="${index}"`;
    return `<button class="mini-button" type="button" data-action="${action}"${attr}>菜單</button>`;
  }

  function actionGrid(actions, className = "") {
    const cleanActions = actions.filter(Boolean);
    if (!cleanActions.length) return "";
    const visibleCount = Math.min(cleanActions.length, 3);
    const classes = ["action-grid", `actions-${visibleCount}`, className].filter(Boolean).join(" ");
    return `<div class="${classes}">${cleanActions.join("")}</div>`;
  }

  function canShowMenu(target) {
    return ["restaurant", "cafe", "breakfast", "bakery"].includes(target?.type);
  }

  function canShowHours(target) {
    return ["restaurant", "cafe", "breakfast", "bakery"].includes(target?.type);
  }

  function storeMetaHtml(target) {
    if (!target) return "";
    const rows = [];
    if (canShowHours(target) && cleanText(target.businessHours)) rows.push(`<div><span class="store-hours-label">營業</span><span>${escapeHtml(cleanText(target.businessHours))}</span></div>`);
    if (canShowHours(target) && cleanText(target.lastCheckHint)) rows.push(`<div><span class="store-hours-label">提醒</span><span>${escapeHtml(cleanText(target.lastCheckHint))}</span></div>`);
    if (!rows.length) return "";
    return `<div class="store-hours">${rows.join("")}</div>`;
  }

  function renderTargetActions(target, index, source = "info") {
    const actions = [
      target.query ? `<a class="mini-button primary" href="${mapsUrl(target.query)}" target="_blank" rel="noopener">導航</a>` : "",
      target.phone ? `<a class="mini-button" href="${telUrl(target.phone)}">電話</a>` : "",
      canShowMenu(target) && hasList(target.menuImages) ? `<button class="mini-button" type="button" data-action="target-menu" data-target-source="${source}" data-target-index="${index}">菜單</button>` : ""
    ].filter(Boolean);
    return actionGrid(actions, "target-actions");
  }

  function renderNavButtons(nextStop, hideSingleTargetActions = false) {
    const targets = navTargetsFor(nextStop);

    if (!hasList(targets)) {
      return "";
    }

    return targets.map((target, index) => `
      <div class="target-row">
        <strong>${escapeHtml(target.label || nextStop.title)}</strong>
        ${cleanText(target.description) ? `<p>${escapeHtml(cleanText(target.description))}</p>` : ""}
        ${storeMetaHtml(target)}
        ${hideSingleTargetActions && targets.length === 1 ? "" : renderTargetActions(target, index)}
      </div>
    `).join("");
  }

  function renderSideTargets(stop) {
    if (!hasList(stop?.sideTargets)) return "";
    return stop.sideTargets.map((target) => `
      <div class="side-target-card">
        <span class="side-target-label">${escapeHtml(target.groupLabel || "順路")}</span>
        <strong>${escapeHtml(target.label)}</strong>
        ${cleanText(target.businessHours) ? `<div class="store-hours"><div><span class="store-hours-label">營業</span><span>${escapeHtml(cleanText(target.businessHours))}</span></div></div>` : ""}
        ${actionGrid([
          target.query ? `<a class="mini-button primary" href="${mapsUrl(target.query)}" target="_blank" rel="noopener">導航</a>` : "",
          target.phone ? `<a class="mini-button" href="${telUrl(target.phone)}">電話</a>` : ""
        ], "target-actions")}
      </div>
    `).join("");
  }

  function renderWalkTargets(stop) {
    if (!hasList(stop?.walkTargets)) return "";
    return `
      <div class="walk-panel">
        <strong>吃完附近走走</strong>
        <div class="walk-actions">
          ${stop.walkTargets.map((target) => target.query ? `<a class="mini-button primary" href="${mapsUrl(target.query)}" target="_blank" rel="noopener">導航</a>` : "").join("")}
        </div>
      </div>
    `;
  }

  function normalizeAlternatives(items) {
    if (!hasList(items)) return [];
    return items.map((item) => {
      if (typeof item === "string") {
        return { title: item, description: "", mapQuery: "", phone: "", menuImages: [] };
      }
      return {
        title: item.title || "備案",
        description: cleanText(item.description),
        address: item.address || "",
        mapQuery: item.mapQuery || "",
        phone: item.phone || "",
        menuImages: item.menuImages || [],
        type: item.type || "",
        businessHours: cleanText(item.businessHours),
        lastCheckHint: cleanText(item.lastCheckHint),
        hoursNote: cleanText(item.hoursNote)
      };
    });
  }

  function alternativesHtml(items) {
    const alternatives = normalizeAlternatives(items);
    if (!hasList(alternatives)) return "<p>目前沒有備案。</p>";

    return alternatives.map((item, index) => `
      <article class="alt-card">
        <h3>${escapeHtml(item.title)}</h3>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
        ${storeMetaHtml({
          type: item.type || "restaurant",
          address: item.address,
          businessHours: item.businessHours,
          lastCheckHint: item.lastCheckHint,
          hoursNote: item.hoursNote
        })}
        ${actionGrid([
          buttonOrDisabled(item.mapQuery, "導航"),
          phoneButton(item.phone),
          menuButton(item.menuImages, "alt-menu", index)
        ], "alt-actions")}
      </article>
    `).join("");
  }

  function renderCurrent() {
    const { progress, currentStop, nextStop } = segmentState();
    const dayCompleted = progress.completedDays[String(progress.currentDay)] === true;
    updateProgress(progress, dayCompleted);

    if (dayCompleted) {
      elements.current.innerHTML = progress.currentDay === 4 ? `
        <div class="completion-card">
          <h2>旅程完成，平安回家</h2>
          <p class="description">留下開心的回憶。</p>
        </div>
      ` : `
        <div class="completion-card">
          <h2>今日行程已完成</h2>
          <p class="description">明天再從完整行程選擇第一站。</p>
          <button class="secondary-button compact" type="button" data-action="show-next-day">查看明日行程</button>
        </div>
      `;
      renderLists(progress);
      renderParentTools();
      return;
    }

    const detailStop = nextStop || currentStop;
    const targets = navTargetsFor(detailStop);
    const targetHasMenu = targets.some((target) => canShowMenu(target) && hasList(target.menuImages));
    const showGenericMenu = hasList(detailStop.menuImages) && !targetHasMenu;
    const detailNotes = [
      ...cleanList(detailStop.notes),
      ...navTargetsFor(detailStop).map((target) => cleanText(target.hoursNote)).filter(Boolean)
    ];
    const singleTargetActions = targets.length === 1 ? [
      targets[0].query ? `<a class="mini-button primary" href="${mapsUrl(targets[0].query)}" target="_blank" rel="noopener">導航</a>` : "",
      targets[0].phone ? `<a class="mini-button" href="${telUrl(targets[0].phone)}">電話</a>` : "",
      canShowMenu(targets[0]) && hasList(targets[0].menuImages) ? '<button class="mini-button" type="button" data-action="target-menu" data-target-source="info" data-target-index="0">菜單</button>' : ""
    ] : [];
    const secondaryButtons = [
      showGenericMenu ? '<button class="secondary-button" type="button" data-action="menus">菜單</button>' : "",
      hasList(detailNotes) ? '<button class="secondary-button" type="button" data-action="notes">注意事項</button>' : "",
      hasList(detailStop.alternatives) ? '<button class="secondary-button" type="button" data-action="alternatives">備案</button>' : "",
      hasList(detailStop.mapImages) ? '<button class="secondary-button" type="button" data-action="maps">停車圖</button>' : "",
      hasList(detailStop.externalLinks) ? '<button class="secondary-button" type="button" data-action="links">官方連結</button>' : ""
    ].filter(Boolean);
    const mainActions = actionGrid([...singleTargetActions, ...secondaryButtons], "main-actions");

    elements.current.innerHTML = `
      <div class="stop-meta">
        <span class="pill">Day ${detailStop.day}</span>
        <span class="pill">${escapeHtml(detailStop.date)}</span>
        <span class="pill">${escapeHtml(detailStop.time)}</span>
        ${detailStop.latestDeparture ? `<span class="pill warning">最晚離開 ${escapeHtml(detailStop.latestDeparture)}</span>` : ""}
      </div>

      <div class="route-sign">
        <div class="route-arrow-wrap" aria-hidden="true"><div class="route-arrow">→</div></div>
        <div class="route-main">
          <div class="station-block current-location">
            <span>目前位置</span>
            <strong>${escapeHtml(currentStop.title)}</strong>
          </div>
          <div class="station-block next-location">
            <span>下一站</span>
            <strong>${escapeHtml(nextStop.title)}</strong>
          </div>
        </div>
          <p class="route-line">本段路線：${escapeHtml(currentStop.title)} → ${escapeHtml(nextStop.title)}</p>
          <p class="description next-description">下一站簡介：${escapeHtml(nextStop.description)}</p>
      </div>

      <div class="action-area">
        ${renderNavButtons(nextStop, targets.length === 1)}
        ${mainActions}
        ${renderSideTargets(nextStop)}
      </div>
    `;

    renderLists(progress);
    renderParentTools();
  }

  function renderParentTools(message = "") {
    if (!elements.parentTools) return;
    if (parentToolsUnlocked()) {
      elements.parentTools.innerHTML = `
        <div class="parent-action-grid">
          <button id="resetBtn" class="ghost-button danger" type="button" data-parent-action="reset">重新開始行程</button>
          <button class="ghost-button" type="button" data-parent-action="lock">鎖定</button>
        </div>
      `;
      return;
    }

    elements.parentTools.innerHTML = `
      <form class="parent-login" data-parent-login>
        <label for="parentPassword">家長密碼</label>
        <div class="parent-login-row">
          <input id="parentPassword" name="parentPassword" type="password" inputmode="numeric" autocomplete="off">
          <button class="ghost-button" type="submit">解鎖</button>
        </div>
        ${message ? `<p class="parent-error">${escapeHtml(message)}</p>` : ""}
      </form>
    `;
  }

  function renderLists(progress = getProgress()) {
    elements.todayList.innerHTML = renderDaySegmentList(progress.currentDay, progress);
    elements.allList.innerHTML = [1, 2, 3, 4].map((day) => `
      <details class="day-picker" ${day === progress.currentDay ? "open" : ""}>
        <summary>Day ${day}</summary>
        <div class="segment-list">
          ${renderDaySegmentList(day, progress)}
        </div>
      </details>
    `).join("");
  }

  function renderDaySegmentList(day, progress) {
    const segments = daySegments(day);
    if (!hasList(segments)) return "<p class=\"description compact-text\">目前沒有行程段落。</p>";
    const completed = progress.completedDays[String(day)] === true;
    return segments.map((stop, segmentIndex) => {
      const isCurrent = day === progress.currentDay && segmentIndex === progress.selectedSegmentIndex && !completed;
      const isLast = segmentIndex === segments.length - 1;
      const action = isLast
        ? `<button class="segment-button primary" type="button" data-complete-day="${day}">${day === 4 ? "完成旅程" : "完成今日行程"}</button>`
        : isCurrent
          ? '<span class="segment-current">目前</span>'
          : `<button class="segment-button" type="button" data-select-day="${day}" data-segment-index="${segmentIndex}">切換到這裡</button>`;
      return `
        <article class="segment-item ${isCurrent ? "current" : ""} ${completed ? "day-completed" : ""}" data-select-day="${day}" data-segment-index="${segmentIndex}">
          <span class="segment-time">${escapeHtml(stop.time)}</span>
          <strong>${escapeHtml(stop.title)}</strong>
          <div class="segment-action">${action}</div>
        </article>
      `;
    }).join("");
  }

  function resetTrip() {
    localStorage.removeItem(progressKey);
    localStorage.removeItem(key);
    saveProgress(defaultProgress());
    closeModal();
    renderCurrent();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  elements.current.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    const action = actionTarget?.dataset.action;
    if (!action) return;

    const { currentStop, nextStop } = segmentState();
    const detailStop = nextStop || currentStop;
    const detailNotes = [
      ...cleanList(detailStop.notes),
      ...navTargetsFor(detailStop).map((target) => cleanText(target.hoursNote)).filter(Boolean)
    ];
    if (!detailStop) return;

    if (action === "menus") openModal("菜單", imageHtml(detailStop.menuImages));
    if (action === "maps") openModal("地圖圖片", imageHtml(detailStop.mapImages));
    if (action === "notes") openModal("注意事項", listHtml(detailNotes));
    if (action === "alternatives") openModal("備案", alternativesHtml(detailStop.alternatives));
    if (action === "links") openModal("官方連結", linksHtml(detailStop.externalLinks));
    if (action === "show-next-day") {
      const nextDay = Math.min(4, getProgress().currentDay + 1);
      saveProgress({ ...getProgress(), currentDay: nextDay, selectedSegmentIndex: 0 });
      renderCurrent();
      document.querySelector(".quick-panels details:nth-of-type(2)")?.setAttribute("open", "");
      elements.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action === "target-menu") {
      const targets = navTargetsFor(detailStop);
      const target = targets[Number.parseInt(actionTarget.dataset.targetIndex || "0", 10)];
      openModal(`${target?.label || "菜單"}菜單`, imageHtml(target?.menuImages || []));
    }
  });

  elements.modal.addEventListener("click", (event) => {
    const image = event.target.closest(".image-frame img");
    if (image) {
      const index = Number.parseInt(image.dataset.imageIndex || "0", 10);
      const paths = Array.from(elements.modalBody.querySelectorAll(".image-frame img")).map((img) => decodeURI(img.getAttribute("src") || ""));
      openViewer(paths, index);
      return;
    }
  });

  elements.modal.addEventListener("click", (event) => {
    const altMenuTarget = event.target.closest("[data-action='alt-menu']");
    if (altMenuTarget) {
      const { currentStop, nextStop } = segmentState();
      const detailStop = nextStop || currentStop;
      const alternatives = normalizeAlternatives(detailStop?.alternatives || []);
      const alt = alternatives[Number.parseInt(altMenuTarget.dataset.altIndex || "0", 10)];
      openModal(alt?.title || "菜單", imageHtml(alt?.menuImages || []));
      return;
    }

    if (event.target.closest("[data-action='confirm-reset']")) {
      resetTrip();
      return;
    }

    if (event.target.matches("[data-close-modal]")) closeModal();
  });

  elements.parentTools?.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-parent-login]");
    if (!form) return;
    event.preventDefault();
    const password = new FormData(form).get("parentPassword");
    if (String(password).trim() === String(PARENT_TOOL_PASSWORD)) {
      setParentToolsUnlocked(true);
      renderParentTools();
      return;
    }
    renderParentTools("密碼錯誤");
    elements.parentTools.querySelector("#parentPassword")?.focus();
  });

  elements.parentTools?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-parent-action]")?.dataset.parentAction;
    if (!action || !parentToolsUnlocked()) return;
    if (action === "reset") openResetConfirmModal();
    if (action === "lock") {
      setParentToolsUnlocked(false);
      renderParentTools();
    }
  });

  function handleSegmentSelection(event) {
    const completeTarget = event.target.closest("[data-complete-day]");
    if (completeTarget) {
      event.stopPropagation();
      completeDay(Number.parseInt(completeTarget.dataset.completeDay || "1", 10));
      return;
    }

    const target = event.target.closest("[data-select-day][data-segment-index]");
    if (!target) return;
    const day = Number.parseInt(target.dataset.selectDay || "1", 10);
    const segmentIndex = Number.parseInt(target.dataset.segmentIndex || "0", 10);
    selectSegment(day, segmentIndex);
  }

  elements.todayList.addEventListener("click", handleSegmentSelection);
  elements.allList.addEventListener("click", handleSegmentSelection);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!viewer.classList.contains("hidden")) closeViewer();
      else closeModal();
    }
  });

  viewer.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-viewer]")) closeViewer();
  });

  viewerPrev.addEventListener("click", () => showViewerImage(viewerIndex - 1));
  viewerNext.addEventListener("click", () => showViewerImage(viewerIndex + 1));

  viewerImage.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomViewer(event.deltaY < 0 ? 0.25 : -0.25, event.clientX, event.clientY);
  }, { passive: false });

  viewerImage.addEventListener("dblclick", () => {
    viewerScale = viewerScale > 1 ? 1 : 2;
    viewerX = 0;
    viewerY = 0;
    updateViewerTransform();
  });

  viewerImage.addEventListener("pointerdown", (event) => {
    dragging = true;
    viewerImage.setPointerCapture(event.pointerId);
    dragStart = { x: event.clientX, y: event.clientY, imageX: viewerX, imageY: viewerY };
  });

  viewerImage.addEventListener("pointermove", (event) => {
    if (!dragging || viewerScale <= 1) return;
    viewerX = dragStart.imageX + event.clientX - dragStart.x;
    viewerY = dragStart.imageY + event.clientY - dragStart.y;
    updateViewerTransform();
  });

  viewerImage.addEventListener("pointerup", () => {
    dragging = false;
  });

  viewerImage.addEventListener("pointercancel", () => {
    dragging = false;
  });

  viewerImage.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      pinchStart = { distance: touchDistance(event.touches), scale: viewerScale };
    }
  }, { passive: true });

  viewerImage.addEventListener("touchmove", (event) => {
    if (event.touches.length === 2 && pinchStart) {
      event.preventDefault();
      const nextScale = pinchStart.scale * (touchDistance(event.touches) / pinchStart.distance);
      viewerScale = Math.max(1, Math.min(4, nextScale));
      if (viewerScale === 1) {
        viewerX = 0;
        viewerY = 0;
      }
      updateViewerTransform();
    }
  }, { passive: false });

  viewerImage.addEventListener("touchend", () => {
    pinchStart = null;
  });

  renderCurrent();
  renderParentTools();
})();

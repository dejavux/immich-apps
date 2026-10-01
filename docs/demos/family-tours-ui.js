(function () {
  const COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/";

  function commonsUrl(file, width) {
    if (!file) return "";
    const w = width > 0 ? width : 800;
    return `${COMMONS}${encodeURIComponent(file)}?width=${w}`;
  }

  function daysUntil(isoDate) {
    if (!isoDate) return null;
    const dep = new Date(isoDate + "T00:00:00");
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((dep - today) / 86400000);
    return diff;
  }

  function countdownLabel(depart, returnDate) {
    const d = daysUntil(depart);
    if (d == null) return "";
    if (d > 0) return `出發倒數 ${d} 天`;
    if (d === 0) return "今天出發";
    const ret = daysUntil(returnDate);
    if (returnDate && ret != null && ret >= 0) return "行程進行中";
    return "行程已結束";
  }

  function iconSvg(name) {
    const icons = {
      map: '<svg class="ft-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>',
      plane:
        '<svg class="ft-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>',
      calendar:
        '<svg class="ft-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8H5v10h14V10z"/></svg>',
      album:
        '<svg class="ft-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h16V6H4zm2 2h8l2 3 2-3h2l-3 4 3 5h-2l-2-3-2 3H6l3-4-3-5z"/></svg>',
      home:
        '<svg class="ft-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 2 12h3v8h6v-5h2v5h6v-8h3L12 3z"/></svg>',
    };
    return icons[name] || "";
  }

  window.FamilyToursUI = {
    commonsUrl,
    countdownLabel,
    iconSvg,
    renderFooter(site, options) {
      const imm = site.immich || {};
      const hosting =
        "https://github.com/dejavux/immich-apps/blob/main/docs/demos/HOSTING.md";
      const extra = options?.extraHtml || "";
      return `
      ${extra}
      <div class="ft-footer-inner">
        <div>
          <strong>${iconSvg("home")} 連結</strong>
          <div class="ft-footer-links" style="margin-top:0.35rem;">
            <a href="index.html">${iconSvg("map")} 所有行程</a>
            <a href="${imm.url || "#"}" target="_blank" rel="noopener">${iconSvg("album")} ${imm.label || "Immich"}</a>
            <a href="${hosting}" target="_blank" rel="noopener">部署說明</a>
          </div>
          ${imm.hint ? `<p class="ft-footer-note" style="margin:0.35rem 0 0;font-size:0.72rem;">${imm.hint}</p>` : ""}
        </div>
        <div>
          <strong>${iconSvg("calendar")} 提醒</strong>
          <p class="ft-footer-note" style="margin:0.35rem 0 0;">
            動線與時間以出團領隊為準。地圖車線為道路估算。圖片／影片為第三方授權內容。
          </p>
        </div>
      </div>`;
    },
    mountFooter(options) {
      const site = window.FAMILY_TOURS_SITE;
      const el = document.getElementById("ft-shared-footer");
      if (!site || !el) return;
      el.innerHTML = this.renderFooter(site, options);
    },
    initHome() {
      const site = window.FAMILY_TOURS_SITE;
      if (!site) return;
      const hero = document.getElementById("ft-home-hero");
      if (hero && site.homeHero) {
        const cover = commonsUrl(site.homeHero.coverFile, 1200);
        hero.style.backgroundImage = cover
          ? `linear-gradient(180deg, rgba(10,14,20,0.55) 0%, rgba(10,14,20,0.92) 70%), url("${cover}")`
          : "";
        const t = document.getElementById("ft-home-hero-title");
        const s = document.getElementById("ft-home-hero-sub");
        if (t) t.textContent = site.homeHero.title;
        if (s) s.textContent = site.homeHero.subtitle;
      }
      const grid = document.getElementById("ft-tour-grid");
      if (!grid) return;
      grid.innerHTML = site.tours
        .map((tour) => {
          const cover = commonsUrl(tour.coverFile, 640);
          const cd = countdownLabel(tour.depart, tour.return);
          const badgeClass = tour.status === "confirmed" ? "ft-badge--confirmed" : "ft-badge--draft";
          const cdHtml = cd
            ? `<span class="ft-countdown">${FamilyToursUI.iconSvg("calendar")} ${cd}</span>`
            : "";
          return `<a class="ft-tour-card" href="${tour.href}">
            <div class="ft-tour-card-cover" style="background-image:url('${cover}')">
              <span class="ft-tour-card-cover-badge ${badgeClass}">${tour.statusLabel}</span>
            </div>
            <div class="ft-tour-card-body">
              <div class="ft-tour-card-meta">
                ${cdHtml}
                <span class="ft-chip ft-chip--accent">${tour.chip}</span>
              </div>
              <h2>${tour.title}</h2>
              <p>${tour.summary}</p>
            </div>
            <div class="ft-tour-card-cta">${FamilyToursUI.iconSvg("map")} ${tour.cta} →</div>
          </a>`;
        })
        .join("");
      this.mountFooter();
    },
  };
})();

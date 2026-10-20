/* ==========================================================================
   AS Solutions – beheerpagina (foto's toevoegen, vervangen, verwijderen, sorteren)
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var projects = [];
  var GROOT = 1600, KLEIN = 700;

  /* ---------- Hulpfuncties ---------- */
  function api(method, url, body) {
    return fetch(url, {
      method: method, credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401 && url !== "/api/login") { showLogin(); throw new Error("Je bent uitgelogd. Log opnieuw in."); }
        if (!r.ok) throw new Error(data.fout || "Er ging iets mis (" + r.status + ")");
        return data;
      });
    });
  }
  var toastTimer;
  function toast(msg, isError) {
    var t = $("#toast"); t.textContent = msg; t.className = "admin-toast is-visible" + (isError ? " is-error" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = "admin-toast"; }, 3200);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  var ICONS = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>'
  };

  /* Foto verkleinen in de browser -> WebP (of JPEG als de browser geen WebP kan maken) */
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Kan deze foto niet openen. Is het een HEIC-foto? Sla hem dan eerst op als JPG."));
      };
      img.src = url;
    });
  }
  function resize(img, max, quality) {
    var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    var ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, 0, 0, c.width, c.height);
    var data = c.toDataURL("image/webp", quality);
    if (data.indexOf("data:image/webp") !== 0) data = c.toDataURL("image/jpeg", quality);
    return data;
  }
  function prepare(file) {
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return Promise.reject(new Error("Dit is geen foto"));
    return loadImage(file).then(function (img) { return { groot: resize(img, GROOT, 0.8), klein: resize(img, KLEIN, 0.74) }; });
  }
  function titleFromFile(name) {
    return name.replace(/\.[^.]+$/, "").replace(/^IMG[_-]?\d+$/i, "Project").replace(/[_-]+/g, " ").trim() || "Project";
  }

  /* ---------- Inloggen ---------- */
  function showLogin() { $("#app").hidden = true; $("#login").hidden = false; setTimeout(function () { $("#wachtwoord").focus(); }, 50); }
  function showApp() { $("#login").hidden = true; $("#app").hidden = false; load(); }

  $("#login-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#login-error").textContent = "";
    var btn = this.querySelector("button"); btn.disabled = true;
    api("POST", "/api/login", { wachtwoord: $("#wachtwoord").value })
      .then(function () { $("#wachtwoord").value = ""; showApp(); })
      .catch(function (err) { $("#login-error").textContent = err.message; })
      .then(function () { btn.disabled = false; });
  });
  $("#logout").addEventListener("click", function () { api("POST", "/api/logout").then(showLogin); });

  /* ---------- Overzicht tekenen ---------- */
  function load() {
    api("GET", "/api/projecten").then(function (list) { projects = list; render(); })
      .catch(function (err) { toast(err.message, true); });
  }

  function render() {
    var grid = $("#grid"); grid.innerHTML = "";
    $("#count").textContent = projects.length + " items";
    projects.forEach(function (p, i) {
      var li = el("li", "admin-card"); li.draggable = true; li.dataset.id = p.id;

      var imgWrap = el("div", "admin-card__img");
      var img = el("img"); img.src = p.klein; img.alt = p.titel; img.loading = "lazy";
      imgWrap.appendChild(img);
      imgWrap.appendChild(el("span", "admin-card__nr", "#" + (i + 1)));
      if (p.type === "video") imgWrap.appendChild(el("span", "admin-card__badge", "Video"));
      li.appendChild(imgWrap);

      var body = el("div", "admin-card__body");
      var title = el("input", "admin-card__title"); title.value = p.titel; title.setAttribute("aria-label", "Titel");
      title.addEventListener("change", function () {
        api("PATCH", "/api/projecten/" + p.id, { titel: title.value })
          .then(function (item) { p.titel = item.titel; toast("Titel opgeslagen"); })
          .catch(function (err) { toast(err.message, true); });
      });
      title.addEventListener("keydown", function (e) { if (e.key === "Enter") title.blur(); });
      body.appendChild(title);

      var actions = el("div", "admin-card__actions");
      var up = el("button", "icon-btn"); up.type = "button"; up.innerHTML = ICONS.up; up.title = "Omhoog"; up.disabled = i === 0;
      up.addEventListener("click", function () { move(i, i - 1); });
      var down = el("button", "icon-btn"); down.type = "button"; down.innerHTML = ICONS.down; down.title = "Omlaag"; down.disabled = i === projects.length - 1;
      down.addEventListener("click", function () { move(i, i + 1); });
      actions.appendChild(up); actions.appendChild(down);

      if (p.type === "foto") {
        var rep = el("button"); rep.type = "button"; rep.innerHTML = ICONS.swap + "Vervang"; rep.title = "Foto vervangen";
        rep.addEventListener("click", function () { replaceTarget = { p: p, li: li }; $("#replace-input").click(); });
        actions.appendChild(rep);
      }
      var del = el("button", "is-danger"); del.type = "button"; del.innerHTML = ICONS.trash + "Verwijder"; del.title = "Verwijderen";
      del.addEventListener("click", function () {
        if (!confirm('"' + p.titel + '" verwijderen van de website?')) return;
        li.classList.add("is-busy");
        api("DELETE", "/api/projecten/" + p.id)
          .then(function () { projects = projects.filter(function (x) { return x.id !== p.id; }); render(); toast("Verwijderd"); })
          .catch(function (err) { li.classList.remove("is-busy"); toast(err.message, true); });
      });
      actions.appendChild(del);
      body.appendChild(actions);
      li.appendChild(body);

      addDrag(li);
      grid.appendChild(li);
    });
  }

  /* ---------- Volgorde ---------- */
  function saveOrder() {
    return api("PUT", "/api/volgorde", { ids: projects.map(function (p) { return p.id; }) })
      .then(function () { toast("Volgorde opgeslagen"); })
      .catch(function (err) { toast(err.message, true); load(); });
  }
  function move(from, to) {
    if (to < 0 || to >= projects.length) return;
    var item = projects.splice(from, 1)[0]; projects.splice(to, 0, item); render(); saveOrder();
  }
  var dragId = null;
  function addDrag(li) {
    li.addEventListener("dragstart", function (e) { dragId = li.dataset.id; li.classList.add("is-dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); });
    li.addEventListener("dragend", function () { li.classList.remove("is-dragging"); dragId = null; });
    li.addEventListener("dragover", function (e) { if (!dragId) return; e.preventDefault(); li.classList.add("is-over"); });
    li.addEventListener("dragleave", function () { li.classList.remove("is-over"); });
    li.addEventListener("drop", function (e) {
      e.preventDefault(); li.classList.remove("is-over");
      if (!dragId || dragId === li.dataset.id) return;
      var from = projects.findIndex(function (p) { return p.id === dragId; });
      var to = projects.findIndex(function (p) { return p.id === li.dataset.id; });
      move(from, to);
    });
  }

  /* ---------- Uploaden ---------- */
  function uploadFiles(files) {
    files = Array.prototype.slice.call(files); if (!files.length) return;
    var prog = $("#progress"), base = $("#upload-titel").value.trim();
    // één voor één, zodat de volgorde klopt en de server niet overbelast raakt
    var chain = Promise.resolve(), added = 0;
    files.reverse().forEach(function (file, n) {
      var row = el("li"); var name = el("span", "", file.name); var status = el("span", "", "Wachten…");
      row.appendChild(name); row.appendChild(status); prog.prepend(row);
      chain = chain.then(function () {
        status.textContent = "Verkleinen…";
        return prepare(file).then(function (data) {
          status.textContent = "Uploaden…";
          var titel = base ? (files.length > 1 ? base + " (" + (files.length - n) + ")" : base) : titleFromFile(file.name);
          return api("POST", "/api/projecten", { titel: titel, groot: data.groot, klein: data.klein });
        }).then(function (item) {
          projects.unshift(item); added++; render();
          row.className = "is-ok"; status.textContent = "✓ Toegevoegd";
        }).catch(function (err) { row.className = "is-error"; status.textContent = err.message; });
      });
    });
    chain.then(function () {
      if (added) toast(added + (added === 1 ? " foto" : " foto's") + " toegevoegd");
      $("#upload").value = "";
      setTimeout(function () { Array.prototype.forEach.call(prog.querySelectorAll(".is-ok"), function (r) { r.remove(); }); }, 6000);
    });
  }
  $("#upload").addEventListener("change", function () { uploadFiles(this.files); });
  var dz = $("#dropzone");
  ["dragenter", "dragover"].forEach(function (ev) { dz.addEventListener(ev, function (e) { if (dragId) return; e.preventDefault(); dz.classList.add("is-drag"); }); });
  ["dragleave", "drop"].forEach(function (ev) { dz.addEventListener(ev, function (e) { if (dragId) return; e.preventDefault(); dz.classList.remove("is-drag"); }); });
  dz.addEventListener("drop", function (e) { if (!dragId) uploadFiles(e.dataTransfer.files); });

  /* ---------- Vervangen ---------- */
  var replaceTarget = null;
  $("#replace-input").addEventListener("change", function () {
    var file = this.files[0], t = replaceTarget; this.value = "";
    if (!file || !t) return;
    t.li.classList.add("is-busy");
    prepare(file)
      .then(function (data) { return api("PUT", "/api/projecten/" + t.p.id + "/foto", data); })
      .then(function (item) { Object.assign(t.p, item); render(); toast("Foto vervangen"); })
      .catch(function (err) { t.li.classList.remove("is-busy"); toast(err.message, true); });
  });

  /* ---------- Start ---------- */
  fetch("/api/sessie", { credentials: "same-origin" })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function (s) { s.ingelogd ? showApp() : showLogin(); })
    .catch(function () {
      showLogin();
      $("#login-error").textContent = "De beheerserver draait niet. Start de website met 'node server.js' (of start-server.bat).";
    });
})();

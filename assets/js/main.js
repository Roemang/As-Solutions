/* ==========================================================================
   AS Solutions – interactie
   ========================================================================== */
(function () {
  "use strict";
  var cfg = window.SITE_CONFIG || {};
  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };

  /* ---------- Contactgegevens uit config.js invullen ---------- */
  if (cfg.telefoon) $$(".js-phone-text").forEach(function (el) { el.textContent = cfg.telefoon; });
  // Internationaal nummer automatisch maken van het gewone nummer: "06 12345678" -> "31612345678"
  var intl = cfg.telefoonInternationaal || (cfg.telefoon || "").replace(/[^0-9+]/g, "").replace(/^\+/, "").replace(/^00/, "").replace(/^0/, "31");
  if (intl) {
    $$(".js-phone").forEach(function (el) { el.href = "tel:+" + intl; });
    $$(".js-whatsapp").forEach(function (el) { el.href = "https://wa.me/" + intl; });
  }
  if (cfg.email) {
    $$(".js-email").forEach(function (el) { el.href = "mailto:" + cfg.email; if (!el.hasAttribute("data-keep-text")) el.textContent = cfg.email; });
    $$(".js-email-text").forEach(function (el) { el.textContent = cfg.email; });
  }
  if (cfg.regio) $$(".js-region").forEach(function (el) { el.textContent = cfg.regio; });
  var year = $("#year"); if (year) year.textContent = new Date().getFullYear();

  /* ---------- Header + mobiel menu ---------- */
  var header = $(".header"), toggle = $(".nav-toggle"), nav = $("#nav"), toTop = $("#to-top");
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle("is-scrolled", y > 10);
    if (toTop) toTop.classList.toggle("is-visible", y > 600);
  }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open);
      toggle.setAttribute("aria-label", open ? "Menu sluiten" : "Menu openen");
    });
    $$("a", nav).forEach(function (a) {
      a.addEventListener("click", function () { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); });
    });
  }

  /* Actieve menu-link tijdens scrollen */
  var links = $$('.nav a[href^="#"]');
  if (links.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) links.forEach(function (l) { l.classList.toggle("is-active", l.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach(function (l) { var s = $(l.getAttribute("href")); if (s) spy.observe(s); });
  }

  /* ---------- Reviews ---------- */
  var rg = $("#reviews-grid");
  if (rg && cfg.reviews) {
    cfg.reviews.forEach(function (r) {
      var card = document.createElement("article");
      card.className = "review reveal" + (r.voorbeeld ? " review--placeholder" : "");
      card.innerHTML =
        '<div class="review__quote">&ldquo;</div>' +
        (r.voorbeeld ? "" : '<div class="review__stars" aria-label="5 sterren">★★★★★</div>') +
        "<p></p><div class=\"review__name\"></div>";
      card.querySelector("p").textContent = r.tekst;
      card.querySelector(".review__name").textContent = "— " + r.naam + (r.plaats ? ", " + r.plaats : "");
      rg.appendChild(card);
    });
  }

  /* ---------- Fade-in bij scrollen ---------- */
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add("is-visible"); });

  /* ---------- Voor & na schuifregelaar ---------- */
  $$(".ba__frame").forEach(function (frame) {
    var range = $(".ba__range", frame);
    var set = function () { frame.style.setProperty("--pos", range.value + "%"); };
    range.addEventListener("input", set); set();
  });

  /* ---------- Projectgalerij ----------
     De lijst met projecten komt uit data/projecten.json (die de eigenaar via /beheer aanpast).
     Lukt het laden niet, dan blijven de foto's staan die al in de HTML zitten. */
  var gallery = $("#gallery"), more = $("#gallery-more"), lb = $("#lightbox");
  var STEP = 12, shown = STEP, all = [], idx = 0, lastFocus;
  var PLAY = '<span class="gallery__play"><span><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span></span>';

  function buildGallery(list) {
    gallery.innerHTML = "";
    list.forEach(function (p) {
      var b = document.createElement("button");
      b.className = "gallery__item"; b.type = "button";
      b.setAttribute("data-full", p.groot); b.setAttribute("data-alt", p.titel || "");
      b.setAttribute("aria-label", (p.type === "video" ? "Video bekijken: " : "Foto bekijken: ") + (p.titel || "project"));
      if (p.type === "video") b.setAttribute("data-type", "video");
      var img = document.createElement("img"); img.src = p.klein; img.alt = p.titel || ""; img.loading = "lazy";
      b.appendChild(img);
      if (p.type === "video") b.insertAdjacentHTML("beforeend", PLAY);
      gallery.appendChild(b);
    });
  }
  function updateMore() {
    all.forEach(function (it, i) { it.classList.toggle("is-hidden", i >= shown); });
    if (more) more.parentNode.style.display = shown >= all.length ? "none" : "";
  }
  function initGallery() {
    all = $$(".gallery__item", gallery);
    all.forEach(function (it, i) { it.addEventListener("click", function () { openLb(i); }); });
    updateMore();
  }
  if (more) more.addEventListener("click", function () { shown += STEP; updateMore(); });

  if (gallery) {
    fetch("data/projecten.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (list) { if (Array.isArray(list)) buildGallery(list); })
      .catch(function () { /* statische foto's in de HTML blijven staan */ })
      .then(initGallery);
  }

  /* ---------- Lightbox ---------- */
  var media = lb && $(".lightbox__media", lb), count = lb && $(".lightbox__count", lb);
  function showLb(i) {
    idx = (i + all.length) % all.length;
    var it = all[idx], full = it.getAttribute("data-full"), alt = it.getAttribute("data-alt") || "";
    media.innerHTML = "";
    if (it.getAttribute("data-type") === "video") {
      var v = document.createElement("video");
      v.src = full; v.controls = true; v.autoplay = true; v.playsInline = true; v.muted = true; v.loop = true;
      media.appendChild(v);
    } else {
      var img = document.createElement("img"); img.src = full; img.alt = alt; media.appendChild(img);
    }
    count.textContent = (idx + 1) + " / " + all.length;
  }
  function openLb(i) { lastFocus = document.activeElement; showLb(i); lb.classList.add("is-open"); document.body.style.overflow = "hidden"; $(".lightbox__close", lb).focus(); }
  function closeLb() { lb.classList.remove("is-open"); media.innerHTML = ""; document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
  if (lb) {
    $(".lightbox__close", lb).addEventListener("click", closeLb);
    $(".lightbox__prev", lb).addEventListener("click", function () { showLb(idx - 1); });
    $(".lightbox__next", lb).addEventListener("click", function () { showLb(idx + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") showLb(idx - 1);
      if (e.key === "ArrowRight") showLb(idx + 1);
    });
    var sx = null;
    lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (sx === null) return; var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) showLb(idx + (dx < 0 ? 1 : -1)); sx = null;
    });
  }

  /* ---------- Offerte- en contactformulier ---------- */
  var form = $("#offerte-form");
  var soort = form ? (form.getAttribute("data-soort") || "Offerteaanvraag") : "";
  if (form) {
    var drop = $(".dropzone", form), fileInput = $("#fotos", form), list = $(".file-list", form), msg = $(".form-msg", form);
    var showFiles = function () {
      list.innerHTML = "";
      Array.prototype.forEach.call(fileInput.files, function (f) {
        var li = document.createElement("li"); li.textContent = "📎 " + f.name + " (" + Math.round(f.size / 1024) + " kB)"; list.appendChild(li);
      });
    };
    fileInput.addEventListener("change", showFiles);
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-drag"); }); });
    drop.addEventListener("drop", function (e) { fileInput.files = e.dataTransfer.files; showFiles(); });

    var setMsg = function (type, text) { msg.className = "form-msg is-" + type; msg.textContent = text; };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var diensten = $$('input[name="dienst"]:checked', form).map(function (c) { return c.value; });
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (!diensten.length) { setMsg("error", "Kies minimaal één onderwerp (dienst)."); return; }

      var fd = new FormData(form);
      if (cfg.formEndpoint) {
        var btn = $('button[type="submit"]', form), btnText = btn.textContent; btn.disabled = true; btn.textContent = "Bezig met versturen…";
        fetch(cfg.formEndpoint, { method: "POST", body: fd, headers: { Accept: "application/json" } })
          .then(function (r) { if (!r.ok) throw new Error(); form.reset(); list.innerHTML = ""; setMsg("ok", "Bedankt! Uw aanvraag is verstuurd. We nemen binnen 24 uur contact met u op."); })
          .catch(function () { setMsg("error", "Versturen is niet gelukt. Probeer het later opnieuw of bel ons even."); })
          .then(function () { btn.disabled = false; btn.textContent = btnText; });
        return;
      }
      // Zonder formulierdienst: e-mail openen met alle gegevens ingevuld.
      var g = function (n) { return (fd.get(n) || "").toString().trim(); };
      var body = [
        soort + " via de website", "",
        "Naam: " + g("aanhef") + " " + g("voorletters") + " " + g("achternaam"),
        "Adres: " + g("adres") + ", " + g("postcode") + " " + g("plaats"),
        "E-mail: " + g("email"),
        "Telefoon: " + g("telefoon"),
        "Dienst(en): " + diensten.join(", "), "",
        "Opmerkingen:", g("opmerkingen"), "",
        fileInput.files.length ? "(Ik voeg " + fileInput.files.length + " foto('s) toe als bijlage.)" : ""
      ].join("\n");
      window.location.href = "mailto:" + (cfg.email || "") + "?subject=" + encodeURIComponent(soort + " – " + diensten.join(", ")) + "&body=" + encodeURIComponent(body);
      setMsg("ok", "Uw mail-app wordt geopend met uw bericht. Vergeet niet uw foto's als bijlage toe te voegen en op verzenden te klikken.");
    });
  }
})();

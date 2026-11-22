/* DesignPraise site extras: the seasonal greeting card and the newsletter sign-up.
 * Needs /js/seasons.js first (a copy of baerista/lib/dp-seasons.js — edit it there, then copy).
 * Uses each page's own colour variables (--bg, --card, --ink, --mute, --line), so it follows day and night.
 *
 * Preview a greeting: add ?season=2026-12-25 to any page URL.
 * Newsletter: put <div data-dp-news></div> (or data-dp-news="compact" / data-dp-news-topics="tools") where the form should go.
 */
(function () {
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CSS = [
    /* greeting card */
    ".dps{position:fixed;left:clamp(12px,2.4vw,28px);bottom:clamp(12px,2.4vw,28px);z-index:80;width:min(360px,calc(100vw - 24px));",
    "background:var(--card,#fff);color:var(--ink,#1a0d3e);border-radius:16px;padding:18px 18px 16px 18px;",
    "box-shadow:0 0 0 1px var(--line,#e8e3f3),0 24px 60px -24px rgba(26,13,62,.45);font-family:var(--sans,system-ui);",
    "transform-origin:50% 100%;transform:perspective(900px) rotateX(-90deg);opacity:0;transition:transform .55s cubic-bezier(.7,0,.2,1),opacity .55s cubic-bezier(.7,0,.2,1)}",
    ".dps.on{transform:none;opacity:1}",
    ".dps:before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,var(--dps) 0%,transparent 55%);opacity:.12;pointer-events:none}",
    ".dps-top{display:flex;align-items:center;gap:10px;padding-right:28px}",
    ".dps-gem{width:11px;height:11px;border-radius:3px;background:var(--dps);transform:rotate(45deg);flex:none}",
    ".dps.on .dps-gem{animation:dpsTurn 1.1s .35s cubic-bezier(.7,0,.2,1) both}",
    ".dps h2{margin:0;font:700 18px/1.2 var(--sans,system-ui);letter-spacing:-.02em}",
    ".dps p{margin:8px 0 0;font-size:15px;line-height:1.5;color:var(--mute,#5a5278)}",
    ".dps blockquote{margin:12px 0 0;padding:10px 0 0;border-top:1px dashed var(--line,#e8e3f3);font-size:15px;line-height:1.5}",
    ".dps cite{display:block;margin-top:6px;font:500 12px var(--mono,monospace);font-style:normal;color:var(--mute,#5a5278)}",
    /* small screens: start folded to the title; tap to read the verse */
    "@media (max-width:640px){.dps{padding:12px 14px}.dps.fold{cursor:pointer}.dps.fold p,.dps.fold blockquote{display:none}.dps h2{font-size:16px}.dps-x{top:5px;right:6px}}",
    ".dps-more{display:none;margin-left:auto;font:500 12px var(--mono,monospace);color:var(--mute,#5a5278);white-space:nowrap}",
    "@media (max-width:640px){.dps.fold .dps-more{display:inline}}",
    ".dps-x{position:absolute;top:10px;right:10px;width:32px;height:32px;border:0;border-radius:9px;background:transparent;color:var(--mute,#5a5278);cursor:pointer;display:grid;place-items:center}",
    ".dps-x:hover{background:var(--tint,#f1ebff);color:var(--ink,#1a0d3e)}",
    ".dps-x svg{width:14px;height:14px}",
    "@keyframes dpsTurn{0%{transform:rotate(-45deg) scale(.3)}60%{transform:rotate(225deg) scale(1.15)}100%{transform:rotate(225deg)}}",
    /* newsletter */
    ".dpn{display:grid;gap:14px;max-width:560px;font-family:var(--sans,system-ui)}",
    ".dpn h3{margin:0;font:700 22px/1.2 var(--sans,system-ui);letter-spacing:-.02em;color:var(--ink)}",
    ".dpn .dpn-lead{margin:0;color:var(--mute);font-size:16px;line-height:1.55}",
    ".dpn-row{display:flex;gap:8px;flex-wrap:wrap}",
    ".dpn input[type=email]{flex:1 1 220px;min-height:46px;padding:0 14px;border-radius:12px;border:0;background:var(--card,#fff);color:var(--ink);font:16px var(--sans,system-ui);box-shadow:inset 0 0 0 1.5px var(--line);outline:0;transition:box-shadow .24s}",
    ".dpn input[type=email]:focus{box-shadow:inset 0 0 0 2px var(--violet,#6403ee)}",
    ":root[data-theme=dark] .dpn input[type=email]:focus{box-shadow:inset 0 0 0 2px #a57bff}",
    ".dpn button[type=submit]{min-height:46px;padding:0 20px;border-radius:12px;border:0;background:#6403ee;color:#fff;font:600 15px var(--sans,system-ui);cursor:pointer;transition:background .24s,translate .3s cubic-bezier(.16,1,.3,1)}",
    ".dpn button[type=submit]:hover{background:#5300c9}",
    ":root[data-theme=dark] .dpn button[type=submit]:hover{background:#7a2bff}",
    ".dpn button[disabled]{opacity:.6;cursor:default}",
    ".dpn fieldset{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}",
    ".dpn legend{font:500 13px var(--mono,monospace);color:var(--mute);margin-bottom:8px;padding:0}",
    ".dpn label.chip{position:relative;cursor:pointer;font:550 14px var(--sans,system-ui);padding:7px 13px 7px 30px;border-radius:999px;background:var(--card,#fff);box-shadow:inset 0 0 0 1px var(--line);color:var(--ink);user-select:none;transition:box-shadow .24s,background .24s}",
    ".dpn label.chip input{position:absolute;opacity:0;pointer-events:none}",
    ".dpn label.chip:before{content:'';position:absolute;left:11px;top:50%;width:11px;height:11px;margin-top:-5.5px;border-radius:3px;box-shadow:inset 0 0 0 1.5px var(--mute);transition:transform .375s cubic-bezier(.7,0,.2,1),background .24s,box-shadow .24s}",
    ".dpn label.chip:has(input:checked){box-shadow:inset 0 0 0 1.5px var(--ink)}",
    ".dpn label.chip:has(input:checked):before{background:#6403ee;box-shadow:none;transform:rotate(90deg)}",
    ":root[data-theme=dark] .dpn label.chip:has(input:checked):before{background:#a57bff}",
    ".dpn label.chip:has(input:focus-visible){outline:2px solid #a57bff;outline-offset:2px}",
    ".dpn-fine{margin:0;font-size:13px;color:var(--mute)}",
    ".dpn-msg{margin:0;font-size:15px;min-height:1.5em;color:var(--ink)}",
    ".dpn-msg.err{color:#c8235a}:root[data-theme=dark] .dpn-msg.err{color:#ff6a8a}",
    ".dpn .hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}",
    ".dpn.compact{gap:10px}",
    "@media (prefers-reduced-motion:reduce){.dps{transition:opacity .2s}.dps.on .dps-gem{animation:none;transform:rotate(45deg)}}"
  ].join("");

  function css() {
    if (document.getElementById("dp-extras-css")) return;
    var s = document.createElement("style"); s.id = "dp-extras-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ── seasonal greeting ─────────────────────────────────────────── */
  function greeting() {
    if (typeof DPSeasons === "undefined") return;
    var q = new URLSearchParams(location.search).get("season");
    var preview = q ? DPSeasons.parse(q) : null;
    var s = DPSeasons.get(preview || new Date());
    if (!s) return;
    if (!preview && store("dp-season-closed") === s.key) return;   // closed this season already

    css();
    var card = el("aside", "dps");
    card.setAttribute("role", "note");
    card.setAttribute("aria-label", s.title);
    card.style.setProperty("--dps", s.accent || "var(--mute,#5a5278)");
    var top = el("div", "dps-top");
    top.appendChild(el("span", "dps-gem"));
    top.appendChild(el("h2", null, s.title));
    top.appendChild(el("span", "dps-more", s.ref));
    card.appendChild(top);
    card.appendChild(el("p", null, s.line));
    var bq = el("blockquote", null, "“" + s.verse + "”");
    bq.appendChild(el("cite", null, s.ref + " (KJV)"));
    card.appendChild(bq);
    var x = el("button", "dps-x");
    x.type = "button";
    x.setAttribute("aria-label", "Close");
    x.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>';
    x.onclick = function () {
      store("dp-season-closed", s.key);
      card.classList.remove("on");
      setTimeout(function () { card.remove(); }, reduce ? 0 : 600);
    };
    card.appendChild(x);
    card.classList.add("fold");
    card.addEventListener("click", function (e) { if (e.target.closest(".dps-x")) return; card.classList.remove("fold"); });
    document.body.appendChild(card);
    // Let the page arrive first, then turn the card in like a cube face.
    setTimeout(function () { card.classList.add("on"); }, reduce ? 0 : 1600);
  }

  /* ── newsletter sign-up ────────────────────────────────────────── */
  var TOPICS = [
    ["work", "Films and design work"],
    ["tools", "Tools and products"],
    ["site", "Site news"]
  ];

  function newsletter(host) {
    css();
    var compact = host.getAttribute("data-dp-news") === "compact";
    var only = (host.getAttribute("data-dp-news-topics") || "").split(",").filter(Boolean);
    var shown = only.length ? TOPICS.filter(function (t) { return only.indexOf(t[0]) >= 0; }) : TOPICS;
    var born = Date.now();

    var f = el("form", "dpn" + (compact ? " compact" : ""));
    f.noValidate = true;
    if (!compact) {
      f.appendChild(el("h3", null, host.getAttribute("data-title") || "Get updates by email"));
      f.appendChild(el("p", "dpn-lead", host.getAttribute("data-lead") ||
        "New work, new tools and updates to the ones you use. Only when there’s something worth your time."));
    }
    var fs = null;
    if (shown.length > 1) {
      fs = el("fieldset");
      fs.appendChild(el("legend", null, "Send me"));
      shown.forEach(function (t) {
        var l = el("label", "chip");
        var c = document.createElement("input"); c.type = "checkbox"; c.name = "topic"; c.value = t[0]; c.checked = true;
        l.appendChild(c); l.appendChild(document.createTextNode(t[1]));
        fs.appendChild(l);
      });
      f.appendChild(fs);
    }
    var row = el("div", "dpn-row");
    var email = document.createElement("input");
    email.type = "email"; email.name = "email"; email.required = true; email.autocomplete = "email";
    email.placeholder = "you@example.com"; email.setAttribute("aria-label", "Email address");
    var btn = el("button", null, "Subscribe"); btn.type = "submit";
    row.appendChild(email); row.appendChild(btn);
    f.appendChild(row);
    var hp = el("label", "hp"); hp.setAttribute("aria-hidden", "true");
    var hpi = document.createElement("input"); hpi.type = "text"; hpi.name = "website"; hpi.tabIndex = -1; hpi.autocomplete = "off";
    hp.appendChild(hpi); f.appendChild(hp);
    var msg = el("p", "dpn-msg"); msg.setAttribute("role", "status"); msg.setAttribute("aria-live", "polite");
    f.appendChild(msg);
    f.appendChild(el("p", "dpn-fine", "You’ll get one email to confirm. Unsubscribe from any email in one click."));

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.className = "dpn-msg"; msg.textContent = "";
      var v = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { msg.className = "dpn-msg err"; msg.textContent = "Please enter a valid email address."; email.focus(); return; }
      var topics = shown.length > 1
        ? Array.prototype.slice.call(f.querySelectorAll("input[name=topic]:checked")).map(function (c) { return c.value; })
        : shown.map(function (t) { return t[0]; });
      if (!topics.length) { msg.className = "dpn-msg err"; msg.textContent = "Choose at least one thing to hear about."; return; }
      btn.disabled = true; btn.textContent = "Subscribing…";
      fetch("/api/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v, topics: topics, website: hpi.value, ms: Date.now() - born, source: location.pathname })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._ok = r.ok; return j; }); })
        .then(function (j) {
          if (!j._ok) throw new Error(j.error || "Something went wrong. Please try again.");
          msg.textContent = j.message || "Thank you. Check your inbox to confirm.";
          email.value = ""; btn.textContent = "Subscribed";
        })
        .catch(function (err) {
          msg.className = "dpn-msg err";
          msg.textContent = err && err.message && err.message !== "Failed to fetch" ? err.message : "Couldn’t reach the server. Please try again.";
          btn.disabled = false; btn.textContent = "Subscribe";
        });
    });
    host.innerHTML = ""; host.appendChild(f);
  }

  function start() {
    greeting();
    Array.prototype.forEach.call(document.querySelectorAll("[data-dp-news]"), newsletter);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

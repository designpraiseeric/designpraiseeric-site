/* DesignPraise site: "main site under construction" splash.
 *
 * While the home page isn't ready for the public:
 *  - any click on a link to the home page ("/", "/#work", the logo…) opens this splash instead;
 *  - a direct visit to the home page shows the same splash over it, with no way to close it.
 * Work (/work/), tools (/tools/), the rate card and Book a project stay open as normal.
 *
 * Owner preview: open any page with ?preview=on once (or sign in at /brand) and the home page
 * opens normally in that browser. ?preview=off turns it back on.
 * Launch day: set OPEN to true (or remove this script and the dp-gated line in index.html's <head>).
 */
(function () {
  var OPEN = true; /* main site opened 27 Nov 2026 */
  var KEY = "dp-preview";
  var d = document, root = d.documentElement;

  try {
    var q = new URLSearchParams(location.search).get("preview");
    if (q === "on") localStorage.setItem(KEY, "1");
    if (q === "off") localStorage.removeItem(KEY);
  } catch (e) {}
  function owner() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  if (OPEN || owner()) { root.classList.remove("dp-gated"); return; }

  function isHome(href) {
    try {
      var u = new URL(href, location.href);
      return u.origin === location.origin && (u.pathname === "/" || u.pathname === "/index.html");
    } catch (e) { return false; }
  }
  var onHome = isHome(location.href);

  var css = "" +
    ".dp-gate{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;visibility:visible!important;" +
    "font-family:'DesignPraise Sans','Segoe UI',system-ui,sans-serif;-webkit-font-smoothing:antialiased;" +
    "--g-bg:rgba(14,8,32,.78);--g-card:#150c30;--g-ink:#f4f0ff;--g-mute:#b4a9dc;--g-line:#2c1f5c;--g-tile:#1c1140;--g-mark:#a57bff;--g-tint:#2a1a66}" +
    ":root[data-theme=light] .dp-gate{--g-bg:rgba(247,245,252,.8);--g-card:#fff;--g-ink:#1a0d3e;--g-mute:#5a5278;--g-line:#e8e3f3;--g-tile:#ece4fe;--g-mark:#6403ee;--g-tint:#f1ebff}" +
    ".dp-gate.home{--g-bg:var(--g-solid,#0e0820)}:root[data-theme=light] .dp-gate.home{--g-bg:#f7f5fc}" +
    ".dp-gate .dpg-sc{position:absolute;inset:0;background:var(--g-bg);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);opacity:0;transition:opacity .5s cubic-bezier(.16,1,.3,1)}" +
    ".dp-gate.home .dpg-sc{background:radial-gradient(55% 70% at 85% 0%,rgba(3,238,216,.08),transparent 60%),radial-gradient(55% 70% at 5% 35%,rgba(217,3,238,.10),transparent 60%),var(--g-bg)}" +
    ".dp-gate .dpg-bx{position:relative;width:min(460px,100%);background:var(--g-card);color:var(--g-ink);border:1px solid var(--g-line);border-radius:24px;padding:34px 30px 26px;text-align:center;" +
    "box-shadow:0 40px 90px -40px rgba(20,8,60,.7);opacity:0;transform:translateY(18px) scale(.98);transition:opacity .6s cubic-bezier(.16,1,.3,1),transform .6s cubic-bezier(.16,1,.3,1)}" +
    ".dp-gate.on .dpg-sc,.dp-gate.on .dpg-bx{opacity:1;transform:none}" +
    ".dp-gate .dpg-cb{position:relative;float:none;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;width:76px;height:76px;margin:0 auto 22px;perspective:400px}" +
    ".dp-gate .dpg-cb i{display:block;width:auto;height:auto;margin:0;position:relative;font-style:normal;transform-style:preserve-3d;animation:dpgTurn 6s cubic-bezier(.7,0,.2,1) infinite;animation-delay:calc(var(--i)*.07s + .5s)}" +
    ".dp-gate .dpg-cb b{position:absolute;inset:0;border-radius:5px;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:var(--g-tile);border:1px solid var(--g-line)}" +
    ".dp-gate .dpg-cb b+b{transform:rotateY(180deg);background:#6403ee;border-color:transparent}" +
    ".dp-gate .dpg-cb i:nth-child(3) b+b{background:#ffa800}.dp-gate .dpg-cb i:nth-child(5) b+b{background:#d903ee}.dp-gate .dpg-cb i:nth-child(7) b+b{background:#03eed8}" +
    "@keyframes dpgTurn{0%,20%{transform:rotateY(0)}30%,60%{transform:rotateY(180deg)}70%,100%{transform:rotateY(360deg)}}" +
    ".dp-gate h2{position:static;transform:none;clip-path:none;opacity:1;text-align:center;margin:0;font-size:clamp(22px,4.4vw,27px);line-height:1.18;letter-spacing:-.02em;font-weight:650;color:var(--g-ink)}" +
    ".dp-gate p{margin:12px auto 0;max-width:36ch;color:var(--g-mute);font-size:15.5px;line-height:1.55}" +
    ".dp-gate .dpg-ac{display:grid;gap:10px;margin-top:24px}" +
    ".dp-gate a.dpg-b,.dp-gate button.dpg-b{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;padding:13px 18px;border-radius:13px;font:600 15px 'DesignPraise Sans','Segoe UI',system-ui,sans-serif;cursor:pointer;" +
    "transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s,background .3s}" +
    ".dp-gate .dpg-b.dpg-s{background:#6403ee;color:#fff}.dp-gate .dpg-b.dpg-s:hover{transform:translateY(-2px);box-shadow:0 12px 30px -10px rgba(140,80,255,.75)}" +
    ".dp-gate .dpg-b.dpg-l{color:var(--g-ink);box-shadow:inset 0 0 0 1.5px var(--g-line)}.dp-gate .dpg-b.dpg-l:hover{background:var(--g-tint);transform:translateY(-2px)}" +
    ".dp-gate .dpg-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".dp-gate .dpg-b:focus-visible{outline:2px solid #03eed8;outline-offset:3px}" +
    ".dp-gate .dpg-ft{display:flex;justify-content:center;gap:16px;margin-top:20px;font:12px 'Google Sans Code',ui-monospace,Menlo,monospace;color:var(--g-mute)}" +
    ".dp-gate .dpg-ft a,.dp-gate .dpg-ft button{all:unset;cursor:pointer;color:var(--g-mute);text-decoration:underline;text-underline-offset:3px}.dp-gate .dpg-ft a:hover,.dp-gate .dpg-ft button:hover{color:var(--g-ink)}" +
    ".dp-gate .dpg-x{all:unset;position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;cursor:pointer;color:var(--g-mute);font-size:22px;line-height:1}" +
    ".dp-gate .dpg-x:hover{background:var(--g-tint);color:var(--g-ink)}" +
    "html.dp-gate-lock{overflow:hidden}" +
    "@media (prefers-reduced-motion:reduce){.dp-gate .dpg-cb i{animation:none}.dp-gate .dpg-sc,.dp-gate .dpg-bx{transition:none}}";

  var el = null, lastFocus = null;

  function build(home) {
    if (!d.getElementById("dp-gate-css")) {
      var st = d.createElement("style"); st.id = "dp-gate-css"; st.textContent = css; d.head.appendChild(st);
    }
    var tiles = ""; for (var i = 0; i < 9; i++) tiles += '<i style="--i:' + i + '"><b></b><b></b></i>';
    var g = d.createElement("div");
    g.className = "dp-gate" + (home ? " home" : "");
    g.setAttribute("role", "dialog"); g.setAttribute("aria-modal", "true"); g.setAttribute("aria-labelledby", "dp-gate-h");
    g.innerHTML =
      '<div class="dpg-sc"></div>' +
      '<div class="dpg-bx">' +
        (home ? "" : '<button class="dpg-x" type="button" aria-label="Close">×</button>') +
        '<div class="dpg-cb" aria-hidden="true">' + tiles + "</div>" +
        '<h2 id="dp-gate-h">The main site is still under construction</h2>' +
        "<p>I’m still putting it together and it isn’t ready to open yet. My work and my After Effects tools are already here, and you can start a project any time.</p>" +
        '<div class="dpg-ac">' +
          '<a class="dpg-b dpg-s" href="/work/">See my work</a>' +
          '<div class="dpg-two"><a class="dpg-b dpg-l" href="/tools/">After Effects tools</a><a class="dpg-b dpg-l" href="/book/">Start a project</a></div>' +
        "</div>" +
        '<div class="dpg-ft">' +
          '<a href="https://instagram.com/designpraiseeric" target="_blank" rel="noopener">Instagram @designpraiseeric</a>' +
          (home ? "" : '<button type="button" data-close>Stay on this page</button>') +
        "</div>" +
      "</div>";
    d.body.appendChild(g);
    return g;
  }

  function open(home) {
    if (el) return;
    lastFocus = d.activeElement;
    el = build(home);
    root.classList.add("dp-gate-lock");
    if (home) for (var c = d.body.firstElementChild; c; c = c.nextElementSibling) if (c !== el && c.tagName !== "SCRIPT") { c.inert = true; c.setAttribute("aria-hidden", "true"); }
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("on"); }); });
    var first = el.querySelector(".dpg-s"); if (first && !home) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    if (!home) {
      el.addEventListener("click", function (e) {
        if (e.target.classList.contains("dpg-sc") || e.target.closest(".dpg-x,[data-close]")) close();
      });
    }
    el.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !home) { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var f = el.querySelectorAll("a,button"); if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); }
    });
  }

  function close() {
    if (!el) return;
    var g = el; el = null;
    g.classList.remove("on");
    root.classList.remove("dp-gate-lock");
    setTimeout(function () { g.remove(); }, 500);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // Links to the home page open the splash instead.
  d.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || (el && el.contains(a))) return;
    if (!isHome(a.href)) return;
    e.preventDefault();
    open(false);
  }, true);

  // A direct visit to the home page: cover it.
  if (onHome) {
    var go = function () { open(true); root.classList.remove("dp-gated"); };
    if (d.body) go(); else d.addEventListener("DOMContentLoaded", go);
  }

  window.DPGate = { open: function () { open(onHome); }, close: close };
})();

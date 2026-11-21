/* Animated demos for the tool pages. Each demo draws one frame of an SVG scene
 * (viewBox 640\u00d7360) for a time t in [0,1); the loop runs while the stage is on screen.
 * Colours come from CSS classes defined in tools.css, so day/night just works. */
(function () {
  "use strict";
  var W = 640, H = 360;

  // \u2500\u2500 helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }           // 0\u21921 between a and b
  function eio(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function eout(x) { return 1 - Math.pow(1 - x, 3); }
  function spring(x, z, w) { if (x <= 0) return 0; if (x >= 1) return 1; var wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + z * w / wd * Math.sin(wd * x)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function r(n) { return Math.round(n * 10) / 10; }
  function rect(x, y, w, h, cls, rx) { return '<rect x="' + r(x) + '" y="' + r(y) + '" width="' + r(Math.max(0, w)) + '" height="' + r(Math.max(0, h)) + '" rx="' + (rx == null ? 6 : rx) + '" class="' + cls + '"/>'; }
  function circ(x, y, rad, cls) { return '<circle cx="' + r(x) + '" cy="' + r(y) + '" r="' + r(rad) + '" class="' + cls + '"/>'; }
  function line(x1, y1, x2, y2, cls) { return '<line x1="' + r(x1) + '" y1="' + r(y1) + '" x2="' + r(x2) + '" y2="' + r(y2) + '" class="' + cls + '"/>'; }
  function text(x, y, s, cls, anchor) { return '<text x="' + r(x) + '" y="' + r(y) + '" class="' + cls + '"' + (anchor ? ' text-anchor="' + anchor + '"' : "") + '>' + s + '</text>'; }
  function path(d, cls, extra) { return '<path d="' + d + '" class="' + cls + '"' + (extra || "") + '/>'; }
  function cursor(x, y, down) { return '<g transform="translate(' + r(x) + ',' + r(y) + ')"><path d="M0 0 L0 17 L4.5 13 L8 20 L11 18.5 L7.5 12 L13 12 Z" class="cur' + (down ? " down" : "") + '"/></g>'; }
  function panel(x, y, w, h, title) { return rect(x, y, w, h, "pnl", 10) + rect(x, y, w, 24, "pnl-h", 10) + rect(x, y + 14, w, 10, "pnl-h", 0) + text(x + 12, y + 16, title, "t-cap"); }
  function diamond(x, y, s, cls) { return path("M" + r(x) + " " + r(y - s) + " L" + r(x + s) + " " + r(y) + " L" + r(x) + " " + r(y + s) + " L" + r(x - s) + " " + r(y) + "Z", cls || "key"); }

  var D = {};

  // \u2500\u2500 Aline: points slide onto a line, staggered, with a bounce \u2500\u2500\u2500\u2500
  D.aline = function (t) {
    var pts = [[110, 230], [180, 120], [255, 250], [330, 100], [405, 260], [480, 140], [545, 205]];
    var lineY = 205, o = "", out = [];
    for (var i = 0; i < pts.length; i++) {
      var k = seg(t, 0.12 + i * 0.05, 0.62 + i * 0.05);
      var f = spring(k, 0.32, 13);
      out.push([pts[i][0], lerp(pts[i][1], lineY, f)]);
    }
    var back = seg(t, 0.9, 1);
    if (back > 0) out = out.map(function (p, i) { return [p[0], lerp(p[1], pts[i][1], eio(back))]; });
    var d = "M" + out[0][0] + " " + r(out[0][1]);
    for (var j = 1; j < out.length; j++) { var mx = (out[j - 1][0] + out[j][0]) / 2; d += " C" + r(mx) + " " + r(out[j - 1][1]) + " " + r(mx) + " " + r(out[j][1]) + " " + out[j][0] + " " + r(out[j][1]); }
    o += line(80, lineY, 575, lineY, "guide");
    o += path(d, "stroke-ink thick");
    out.forEach(function (p, i) { o += circ(p[0], p[1], 7, i % 2 ? "dot" : "dot alt"); });
    o += text(80, 60, "Stagger 3f  \u00b7  Travel 10f  \u00b7  Elastic", "t-mono");
    return o;
  };

  // \u2500\u2500 Compensate: drag a precomp's out edge; everything inside follows \u2500\u2500
  D.compensate = function (t) {
    var o = panel(40, 40, 560, 280, "Timeline \u00b7 Main");
    var x0 = 140, base = 300, drag = eio(seg(t, 0.18, 0.55)) * 120, hold = seg(t, 0.9, 1);
    if (hold > 0) drag = drag * (1 - eio(hold));
    var frames = Math.round(drag / 5);
    o += text(60, 100, "Intro", "t-small") + rect(x0, 86, 300, 22, "bar soft");
    o += text(60, 140, "Logo", "t-small") + rect(x0, 126, base + drag, 22, "bar violet");
    o += rect(x0 + base + drag - 5, 126, 5, 22, "edge", 2);
    o += text(60, 180, "\u21b3 inside", "t-small faint");
    o += rect(x0 + 20, 166, base - 20 + drag, 14, "bar ghost");
    o += rect(x0 + 60, 188, 160, 14, "bar ghost") + rect(x0 + 120, 210, base - 120 + drag, 14, "bar ghost");
    o += line(x0 + base, 80, x0 + base, 236, "guide dash");
    o += rect(430, 258, 150, 40, "chip", 10) + text(505, 284, "\u0394 " + (frames > 0 ? "+" : "") + frames + "f", "t-big", "middle");
    var press = t > 0.14 && t < 0.6;
    o += cursor(x0 + base + drag - 2, 132, press);
    return o;
  };

  // \u2500\u2500 Notable: type a note, sketch, post to the comp \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.notable = function (t) {
    var o = panel(40, 40, 300, 280, "Notable");
    var msg = "Client wants the logo 10% bigger on shot 4";
    var n = Math.floor(seg(t, 0.05, 0.35) * msg.length);
    o += rect(56, 76, 268, 70, "field", 8);
    o += text(68, 100, msg.slice(0, Math.min(n, 26)), "t-small ink") + text(68, 120, msg.slice(26, Math.max(26, n)), "t-small ink");
    o += rect(56, 160, 268, 120, "canvas", 8);
    var k = seg(t, 0.38, 0.62), dd = "";
    for (var i = 0; i <= 40 * k; i++) { var a = i / 40 * Math.PI * 2; var px = 190 + Math.cos(a) * 60 + Math.cos(a * 3) * 8, py = 220 + Math.sin(a) * 30; dd += (i ? "L" : "M") + r(px) + " " + r(py); }
    if (dd) o += path(dd, "stroke-amber thick");
    var post = eout(seg(t, 0.68, 0.82));
    o += rect(56, 290, 70, 22, post > 0 ? "btn on" : "btn", 7) + text(91, 305, "Post", "t-small", "middle");
    o += panel(370, 40, 230, 280, "Timeline");
    o += rect(386, 80, 200, 20, "bar soft");
    if (post > 0) o += '<g opacity="' + post + '">' + rect(386, 80 + 28 * post, 200, 20, "bar violet") + text(396, 94 + 28 * post, "Note \u00b7 Client wants\u2026", "t-small t-on") + "</g>";
    o += rect(386, 140, 200, 20, "bar soft");
    return o;
  };

  // \u2500\u2500 Bouncer: overshoot curve with keyframes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.bouncer = function (t) {
    var o = "", x0 = 70, x1 = 330, y0 = 290, y1 = 110;
    o += line(x0, y0, 600, y0, "guide") + diamond(x0, y0, 7) + diamond(x1, y1, 7);
    var d = "M" + x0 + " " + y0;
    for (var i = 1; i <= 120; i++) { var u = i / 120, x = lerp(x0, 600, u); var tt = u * 2.1; var f = tt < 1 ? eio(tt) : 1 + Math.sin((tt - 1) * 10) * 0.35 * Math.exp(-(tt - 1) * 4.5); d += " L" + r(x) + " " + r(lerp(y0, y1, f)); }
    o += path(d, "stroke-ink");
    var u2 = seg(t, 0.1, 0.85), tt2 = u2 * 2.1, f2 = tt2 < 1 ? eio(tt2) : 1 + Math.sin((tt2 - 1) * 10) * 0.35 * Math.exp(-(tt2 - 1) * 4.5);
    var bx = lerp(x0, 600, u2), by = lerp(y0, y1, f2);
    o += line(bx, y0, bx, by, "guide dash") + circ(bx, by, 10, "dot");
    o += circ(560, lerp(300, 120, f2), 26, "ball") + text(560, 335, "Position Y", "t-small faint", "middle");
    o += text(70, 60, "Live: Amplitude 5  \u00b7  Frequency 4  \u00b7  Decay 8", "t-mono");
    return o;
  };

  // \u2500\u2500 Precomp Kit: deep duplicate copies the whole chain \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.precompkit = function (t) {
    var o = "", k = eio(seg(t, 0.2, 0.6)), names = ["Shot 04", "Logo", "Glow"];
    for (var i = 0; i < 3; i++) {
      var y = 90 + i * 80, x = 110 + i * 40;
      o += rect(x, y, 150, 44, "node", 10) + text(x + 14, y + 27, names[i], "t-small ink");
      if (i) o += path("M" + (x - 20) + " " + (y - 36) + " V" + (y + 22) + " H" + x, "stroke-mute");
      var cx = lerp(x, x + 250, k);
      if (k > 0) o += '<g opacity="' + seg(t, 0.2, 0.3) + '">' + rect(cx, y, 150, 44, "node violet", 10) + text(cx + 14, y + 27, names[i] + "_cp1", "t-small t-on") + (i ? path("M" + (cx - 20) + " " + (y - 36) + " V" + (y + 22) + " H" + cx, "stroke-violet") : "") + "</g>";
    }
    o += text(110, 60, "Original", "t-mono") + text(360, 60, k > 0.5 ? "Independent copy" : "", "t-mono");
    o += text(360, 335, k > 0.95 ? "effects \u00b7 masks \u00b7 parenting \u00b7 mattes kept" : "", "t-small faint");
    return o;
  };

  // \u2500\u2500 Auff: audio off everywhere except exempt layers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.auff = function (t) {
    var o = panel(70, 40, 500, 280, "Auff \u00b7 Whole project"), rows = ["VO_final", "Music bed", "SFX whoosh", "Room tone", "Interview A", "Click track"];
    var ex = { 0: 1, 4: 1 };
    rows.forEach(function (n, i) {
      var y = 80 + i * 38, off = !ex[i] && t > 0.3 + i * 0.05 && t < 0.9;
      o += rect(90, y, 460, 30, "row", 7) + text(140, y + 20, n, "t-small ink");
      o += '<g transform="translate(104,' + (y + 7) + ')" class="' + (off ? "spk off" : "spk") + '"><path d="M0 5h4l5-5v16l-5-5H0z"/>' + (off ? '<path d="M12 3l6 10M18 3l-6 10" class="x"/>' : '<path d="M12 4c2 2 2 6 0 8M15 1c4 4 4 10 0 14" class="w"/>') + "</g>";
      if (ex[i]) o += rect(470, y + 7, 66, 16, "chip small", 8) + text(503, y + 19, "exempt", "t-tiny", "middle");
    });
    return o;
  };

  // \u2500\u2500 Compyle: comps leave as their own projects \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.compyle = function (t) {
    var o = panel(50, 40, 250, 280, "Project"), comps = ["Intro", "Lower third", "Endslate", "Shot 04", "Shot 05"];
    var pick = { 1: 1, 2: 1, 4: 1 }, k = 0;
    comps.forEach(function (n, i) {
      var y = 80 + i * 42;
      o += rect(66, y, 218, 32, pick[i] && t > 0.15 ? "row sel" : "row", 7) + rect(78, y + 10, 14, 12, "ico", 3) + text(102, y + 21, n, "t-small ink");
    });
    var idx = 0;
    [1, 2, 4].forEach(function (i, j) {
      var p = eio(seg(t, 0.32 + j * 0.12, 0.6 + j * 0.12)), sx = 250, sy = 96 + i * 42, ex = 420 + (j % 3) * 0, ey = 80 + j * 82;
      if (p > 0) { var x = lerp(sx, ex, p), y = lerp(sy, ey, p); o += '<g opacity="' + Math.min(1, p * 3) + '">' + rect(x, y, 150, 64, "file", 10) + text(x + 14, y + 26, comps[i], "t-small ink") + text(x + 14, y + 46, comps[i].replace(/ /g, "_") + ".aep", "t-tiny faint") + "</g>"; }
    });
    return o;
  };

  // \u2500\u2500 Let's Be Guided: export guides, import into a bigger comp \u2500\u2500\u2500
  D.guided = function (t) {
    var o = "", k = eio(seg(t, 0.35, 0.75));
    var a = { x: 60, y: 80, w: 220, h: 124 }, b = { x: 330, y: 60, w: 260, h: 260 };
    o += rect(a.x, a.y, a.w, a.h, "frame", 6) + text(a.x, a.y - 12, "1920\u00d71080", "t-tiny faint");
    o += rect(b.x, b.y, b.w, b.h, "frame", 6) + text(b.x, b.y - 12, "1080\u00d71080", "t-tiny faint");
    [0.1, 0.5, 0.9].forEach(function (f) { o += line(a.x + a.w * f, a.y, a.x + a.w * f, a.y + a.h, "gline"); });
    [0.2, 0.8].forEach(function (f) { o += line(a.x, a.y + a.h * f, a.x + a.w, a.y + a.h * f, "gline"); });
    if (k > 0) {
      var op = ' opacity="' + k + '"';
      o += "<g" + op + ">";
      [0.1, 0.5, 0.9].forEach(function (f) { o += line(b.x + b.w * f, b.y, b.x + b.w * f, b.y + b.h, "gline"); });
      [0.2, 0.8].forEach(function (f) { o += line(b.x, b.y + b.h * f, b.x + b.w, b.y + b.h * f, "gline"); });
      o += "</g>";
    }
    var fx = lerp(170, 460, eio(seg(t, 0.15, 0.4))), fop = seg(t, 0.1, 0.18) * (1 - seg(t, 0.4, 0.45));
    o += '<g opacity="' + fop + '">' + rect(fx - 40, 240, 80, 40, "chip", 8) + text(fx, 265, "guide1", "t-tiny", "middle") + "</g>";
    o += text(60, 300, k > 0.9 ? "Scaled to the new comp" : "", "t-small faint");
    return o;
  };

  // \u2500\u2500 FootLogWork: sample, then match colour \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.footlogwork = function (t) {
    var o = "", k = eio(seg(t, 0.55, 0.85));
    var src = [lerp(40, 222, k), lerp(110, 120, k), lerp(160, 70, k)];
    function col(c) { return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")"; }
    o += '<rect x="60" y="70" width="240" height="160" rx="10" fill="' + col(src) + '"/>' + text(60, 255, "Source", "t-small ink");
    o += '<rect x="340" y="70" width="240" height="160" rx="10" fill="rgb(222,120,70)"/>' + text(340, 255, "Reference", "t-small ink");
    var s = seg(t, 0.1, 0.5);
    for (var i = 0; i < 64; i++) { var gx = i % 8, gy = Math.floor(i / 8); if (i / 64 < s) o += circ(75 + gx * 30, 85 + gy * 19, 2.6, "samp"); }
    o += text(60, 300, s < 1 ? "Sampling 16\u00d716\u2026" : (k < 1 ? "Matching levels\u2026" : "Matched"), "t-mono");
    return o;
  };

  // \u2500\u2500 Prop Up: property chips reveal in the timeline \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.propup = function (t) {
    var o = panel(40, 40, 270, 280, "Prop Up"), props = ["Path", "Fill Color", "Stroke Width", "Trim End", "Position", "Scale", "Rotation", "Opacity"];
    var on = {};
    [[0.2, 1], [0.35, 3], [0.5, 6]].forEach(function (p) { if (t > p[0] && t < 0.92) on[p[1]] = 1; });
    props.forEach(function (n, i) { var x = 56 + (i % 2) * 124, y = 80 + Math.floor(i / 2) * 44; o += rect(x, y, 114, 32, on[i] ? "chip on" : "chip", 8) + text(x + 57, y + 21, n, on[i] ? "t-small t-on" : "t-small ink", "middle"); });
    o += panel(330, 40, 270, 280, "Timeline");
    var y = 80;
    o += text(346, y + 14, "\u25be Shape Layer 1", "t-small ink"); y += 30;
    [1, 3, 6].forEach(function (i) { if (on[i]) { o += rect(346, y, 238, 26, "row sel", 6) + text(360, y + 17, props[i], "t-small ink"); y += 32; } });
    return o;
  };

  // \u2500\u2500 TextJam: letters burst, collide, settle \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.textjam = function (t) {
    var word = "DESIGN", o = "", cx = 320, cy = 200;
    var settle = eout(seg(t, 0.45, 0.85)), out = seg(t, 0.92, 1);
    for (var i = 0; i < word.length; i++) {
      var hx = 205 + i * 46, hy = 200;
      var ang = (i * 2.399) % (Math.PI * 2), burst = eout(seg(t, 0.05 + i * 0.02, 0.4));
      var fx = cx + Math.cos(ang) * 190 * burst, fy = cy + Math.sin(ang) * 120 * burst + 60 * burst * burst;
      var x = lerp(fx, hx, settle), y = lerp(fy, hy, settle);
      var a = (1 - settle) * (ang * 40);
      o += '<text x="' + r(x) + '" y="' + r(y) + '" class="t-jam" text-anchor="middle" opacity="' + (1 - out) + '" transform="rotate(' + r(a) + ' ' + r(x) + ' ' + r(y - 16) + ')">' + word[i] + "</text>";
    }
    o += text(70, 60, "Burst 550  \u00b7  Gravity 350  \u00b7  Bounciness 0.55", "t-mono");
    return o;
  };

  // \u2500\u2500 Slicer: find crossings, split into shadowed segments \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.slicer = function (t) {
    var o = "", k = seg(t, 0.15, 0.4), split = eout(seg(t, 0.45, 0.7));
    function pt(u) { var a = u * Math.PI * 2; return [320 + Math.sin(a) * 190, 190 + Math.sin(2 * a) * 90]; }
    var cols = ["s1", "s2", "s3", "s4"], segs = [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]];
    segs.forEach(function (s, j) {
      var d = "";
      for (var i = 0; i <= 40; i++) { var p = pt(lerp(s[0], s[1], i / 40)); d += (i ? "L" : "M") + r(p[0]) + " " + r(p[1] + split * (j % 2 ? 8 : -8)); }
      if (split > 0) o += path(d, "shadow thick", ' transform="translate(6,8)" opacity="' + split * 0.5 + '"');
      o += path(d, split > 0 ? "stroke-" + cols[j] + " thick" : "stroke-ink thick");
    });
    if (k > 0) o += '<g opacity="' + k * (1 - split) + '">' + circ(320, 190, 14, "ring") + "</g>";
    o += text(70, 60, split > 0.9 ? "4 segment layers \u00b7 Trim Paths keyed" : (k > 0 ? "Crossing found" : "Scanning path\u2026"), "t-mono");
    return o;
  };

  // \u2500\u2500 DockView: drop a link, it opens docked \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.dockview = function (t) {
    var o = panel(60, 40, 520, 290, "DockView"), k = eio(seg(t, 0.1, 0.35)), load = seg(t, 0.4, 0.6), star = t > 0.7;
    o += rect(76, 72, 380, 24, "field", 7) + text(88, 89, load > 0 ? "frame.io/review/7Qk\u2026" : "Drop a link\u2026", "t-tiny faint");
    o += rect(464, 72, 24, 24, star ? "btn on" : "btn", 6) + text(476, 89, star ? "\u2605" : "\u2606", star ? "t-small t-on" : "t-small ink", "middle");
    if (load > 0) o += rect(76, 104, 120, 22, "tab on", 6) + text(88, 119, "Review \u00b7 v3", "t-tiny t-on");
    o += rect(76, 132, 488, 184, "page", 8);
    if (load > 0) { o += '<g opacity="' + load + '">' + rect(96, 150, 300, 150, "shot", 6) + rect(412, 150, 136, 14, "ln", 4) + rect(412, 172, 110, 10, "ln", 4) + rect(412, 190, 124, 10, "ln", 4) + "</g>"; }
    var lx = lerp(640, 300, k), ly = lerp(380, 210, k);
    if (t < 0.4) o += '<g opacity="' + (1 - seg(t, 0.33, 0.4)) + '">' + rect(lx - 70, ly - 14, 140, 28, "chip", 14) + text(lx, ly + 5, "\ud83d\udd17 review link", "t-tiny", "middle") + "</g>" + cursor(lx + 50, ly + 4, t > 0.08);
    return o;
  };

  // \u2500\u2500 DockDocs: a brief and a script, docked beside the comp \u2500\u2500\u2500\u2500\u2500
  D.dockdocs = function (t) {
    var o = panel(60, 40, 520, 290, "DockDocs"), tab = t < 0.5 ? 0 : 1, sc = eio(seg(t, 0.15, 0.45)) * 60;
    o += rect(76, 72, 110, 22, tab === 0 ? "tab on" : "tab", 6) + text(88, 87, "Brief.pdf", tab === 0 ? "t-tiny t-on" : "t-tiny ink");
    o += rect(192, 72, 110, 22, tab === 1 ? "tab on" : "tab", 6) + text(204, 87, "Script.md", tab === 1 ? "t-tiny t-on" : "t-tiny ink");
    o += '<clipPath id="dd"><rect x="76" y="102" width="488" height="214" rx="8"/></clipPath><g clip-path="url(#dd)">' + rect(76, 102, 488, 214, "canvas", 8);
    if (tab === 0) { for (var p = 0; p < 3; p++) { var y = 116 + p * 150 - sc; o += rect(190, y, 260, 136, "page", 4) + rect(210, y + 18, 150, 10, "ln", 3) + rect(210, y + 38, 210, 6, "ln", 3) + rect(210, y + 52, 190, 6, "ln", 3) + rect(210, y + 66, 200, 6, "ln", 3); } }
    else { o += text(110, 140, "# Scene 4 \u2014 Logo reveal", "t-small ink"); o += rect(110, 156, 300, 6, "ln", 3) + rect(110, 170, 260, 6, "ln", 3); o += '<rect x="110" y="188" width="' + r(eout(seg(t, 0.55, 0.8)) * 120) + '" height="14" rx="3" class="hl"/>' + text(112, 199, "logo +10%", "t-tiny ink"); }
    return o + "</g>";
  };

  // \u2500\u2500 Baerista: the bar itself \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  D.baerista = function (t) {
    var o = panel(170, 30, 300, 300, "Baerista"), names = ["Aline", "Compensate", "Notable", "Bouncer", "TextJam", "DockView"];
    var flip = Math.floor(t * 6) % 6, fk = (t * 6) % 1;
    names.forEach(function (n, i) {
      var x = 186 + (i % 2) * 140, y = 68 + Math.floor(i / 2) * 76, f = i === flip ? Math.sin(Math.min(1, fk * 1.4) * Math.PI) : 0;
      var h = 66 * (1 - f * 0.5);
      o += rect(x, y + (66 - h) / 2, 130, h, f > 0.5 ? "tile on" : "tile", 10);
      o += text(x + 14, y + 38, f > 0.5 ? (i === 1 ? "Update" : "Open") : n, f > 0.5 ? "t-small t-on" : "t-small ink");
    });
    o += rect(386, 36, 70, 14, "chip small", 7) + text(421, 47, "1 update", "t-tiny", "middle");
    return o;
  };

  // \u2500\u2500 runner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function run(el) {
    var id = el.getAttribute("data-demo"), dur = (+el.getAttribute("data-dur") || 7) * 1000, draw = D[id];
    if (!draw) return;
    var svg = el.querySelector("svg"), visible = true, t0 = performance.now();
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(el);
    if (reduce) { svg.innerHTML = draw(0.85); return; }
    (function frame(now) {
      if (visible) svg.innerHTML = draw(((now - t0) % dur) / dur);
      requestAnimationFrame(frame);
    })(t0);
  }
  window.DPDemos = D;
  document.querySelectorAll("[data-demo]").forEach(run);
})();

/*!
 * buildcursors v1.0.0
 * Coloured cursor "agents" build your page as it scrolls into view.
 * MIT License (c) 2026 Giovani Oliveira
 * https://github.com/giovaniolivr/buildcursors
 */
(function (global) {
  "use strict";

  const VERSION = "1.0.0";
  const doc = document;
  const root = doc.documentElement;

  // ── Configuration ────────────────────────────────────────────────────────────
  const DEFAULTS = {
    // What gets built. Outermost matches are built; matches nested inside them come along.
    targets:
      "h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, figure, img, video, table, article, form, [data-build]",
    // Which of those are typed out line by line (everything else gets a selection box).
    text: "h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, figcaption, dt, dd",
    // Text inside these arrives together with its panel instead of being typed.
    keep: "button, .btn, [role=button]",
    // Never hidden, never built (in addition to [data-build=skip]).
    ignore: "",
    // Plays at most once per cooldown per browser: ms number or "30s" / "10m" / "2h" / "1d"; 0 = every visit.
    cooldown: "10m",
    storageKey: "buildcursors:lastRun",
    // ?build=1 forces a run, ?build=0 disables it (the parameter is removed from the URL).
    param: "build",
    speed: 1.7,
    names: true,
    finale: true,
    escToSkip: true,
    skipBots: true,
    mobileBreakpoint: 640,
    // Names from `agents` used on narrow screens; null = all of them.
    mobileAgents: ["Layout", "Copy", "Media", "QA"],
    // role: "block" (selection boxes), "text" (typing), "img" (carries images), null (helps anywhere)
    agents: [
      { name: "Layout", color: "#ff4d6d", role: "block" },
      { name: "Copy", color: "#2f9bff", role: "text" },
      { name: "Media", color: "#ff9f1c", role: "img" },
      { name: "Grid", color: "#8b5cf6", role: "block" },
      { name: "Type", color: "#06b6d4", role: "text" },
      { name: "Editor", color: "#ec4899", role: "text" },
      { name: "QA", color: "#10b981", role: null },
    ],
    zIndex: 9990,
    // Selector of an element to append a "watch it again" button to.
    replayLink: null,
    replayText: "Watch it build",
    onStart: null,
    onDone: null,
  };

  // data-* attributes on the <script> tag: [attribute, option, type]
  const ATTRS = [
    ["targets", "targets", "str"], ["text", "text", "str"], ["keep", "keep", "str"],
    ["ignore", "ignore", "str"], ["cooldown", "cooldown", "str"], ["storage-key", "storageKey", "str"],
    ["param", "param", "str"], ["speed", "speed", "num"], ["names", "names", "bool"],
    ["finale", "finale", "bool"], ["esc-to-skip", "escToSkip", "bool"], ["skip-bots", "skipBots", "bool"],
    ["mobile-breakpoint", "mobileBreakpoint", "num"], ["mobile-agents", "mobileAgents", "list"],
    ["z-index", "zIndex", "num"], ["replay-link", "replayLink", "str"], ["replay-text", "replayText", "str"],
  ];

  function readConfig(script) {
    const cfg = Object.assign({}, DEFAULTS, global.buildcursorsConfig || {});
    if (script) {
      ATTRS.forEach(([attr, key, type]) => {
        const v = script.getAttribute("data-" + attr);
        if (v === null) return;
        if (type === "num") cfg[key] = parseFloat(v);
        else if (type === "bool") cfg[key] = v !== "false" && v !== "0";
        else if (type === "list") cfg[key] = v === "all" ? null : v.split(",").map((s) => s.trim()).filter(Boolean);
        else cfg[key] = v;
      });
    }
    return cfg;
  }

  function toMs(v) {
    if (typeof v === "number") return v;
    const m = String(v).trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i);
    if (!m) return 0;
    const unit = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[(m[2] || "ms").toLowerCase()];
    return parseFloat(m[1]) * unit;
  }

  const cfg = readConfig(doc.currentScript);
  const IGNORE = ["[data-build=skip]", "[data-build=skip] *", "#bc-layer", "#bc-layer *"]
    .concat(cfg.ignore ? [cfg.ignore] : [])
    .join(", ");

  // ── Gate: decided now, before first paint, so built parts never flash ───────
  function shouldPlay() {
    let q = null;
    try { q = new URLSearchParams(location.search).get(cfg.param); } catch (e) {}
    if (q === "1") return true;
    if (q === "0") return false;
    if (cfg.skipBots && navigator.webdriver) return false;
    if (global.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const cooldown = toMs(cfg.cooldown);
    if (cooldown > 0) {
      let last = 0;
      try { last = +localStorage.getItem(cfg.storageKey) || 0; } catch (e) {}
      if (Date.now() - last < cooldown) return false;
    }
    return true;
  }

  // Strip ?build=… so a reload doesn't force it again.
  function stripParam() {
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has(cfg.param)) return;
      url.searchParams.delete(cfg.param);
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    } catch (e) {}
  }

  const css = `
html.bc-on :is(${cfg.targets}):not(.bc-done):not(.bc-live):not(:is(${IGNORE})) { opacity: 0 !important; }
html.bc-on .bc-wait:not(.bc-live) { opacity: 0 !important; }
html.bc-on .bc-done { transition: opacity 450ms ease-out; }
html.bc-on img.bc-done { transition: opacity 300ms ease-out; }
#bc-layer { position: fixed; inset: 0; z-index: ${cfg.zIndex}; pointer-events: none; overflow: hidden; font-family: inherit; }
#bc-layer .bc-cursor { position: absolute; left: 0; top: 0; will-change: transform; transition: opacity 300ms ease-out; }
#bc-layer .bc-cursor svg { display: block; width: 20px; height: 26px; filter: drop-shadow(0 1px 1px rgba(0,0,0,.25)); }
#bc-layer .bc-name { position: absolute; left: 16px; top: 20px; padding: 2px 8px; border-radius: 100px;
  font-size: 11px; font-weight: 600; line-height: 16px; color: #fff; white-space: nowrap; }
#bc-layer .bc-guide { position: absolute; opacity: 0; transition: opacity 200ms ease-out; }
#bc-layer .bc-guide.h { left: 0; width: 100vw; height: 0; border-top: 1px dashed; }
#bc-layer .bc-guide.v { top: 0; height: 100vh; width: 0; border-left: 1px dashed; }
#bc-layer .bc-guide.on { opacity: .55; }
#bc-layer .bc-box { position: absolute; border: 1.5px solid; border-radius: 4px; opacity: 0; }
#bc-layer .bc-dim { position: absolute; left: -1px; top: -21px; padding: 1px 6px; border-radius: 4px;
  font-size: 10px; font-weight: 600; line-height: 16px; color: #fff; white-space: nowrap; font-variant-numeric: tabular-nums; }
#bc-layer .bc-caret { position: absolute; width: 2px; opacity: 0; border-radius: 1px; }
#bc-layer .bc-ripple { position: absolute; width: 28px; height: 28px; margin: -14px 0 0 -14px;
  border: 2px solid; border-radius: 50%; animation: bc-ripple 500ms ease-out forwards; }
#bc-layer .bc-carry { position: absolute; object-fit: cover; border: 2px solid; border-radius: 10px;
  box-shadow: 0 10px 30px rgba(10,19,23,.25); transition: opacity 350ms ease-out; }
@keyframes bc-ripple { from { transform: scale(.2); opacity: .9; } to { transform: scale(1.4); opacity: 0; } }
.bc-replay { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer;
  text-decoration: underline; text-underline-offset: 3px; }`;

  const style = doc.createElement("style");
  style.id = "bc-style";
  style.textContent = css;
  (doc.head || root).appendChild(style);

  const play = shouldPlay();
  stripParam();
  if (play) root.classList.add("bc-on");

  let current = null; // running instance (skip handle)

  function replay() {
    try { localStorage.removeItem(cfg.storageKey); } catch (e) {}
    const url = new URL(location.href);
    url.searchParams.set(cfg.param, "1");
    location.href = url.toString();
  }

  function addReplayLink() {
    if (!cfg.replayLink) return;
    const host = doc.querySelector(cfg.replayLink);
    if (!host) return;
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "bc-replay";
    btn.textContent = cfg.replayText;
    btn.addEventListener("click", replay);
    host.appendChild(btn);
  }

  function boot() {
    addReplayLink();
    if (!play) return;
    try {
      if (typeof cfg.onStart === "function") cfg.onStart();
    } catch (e) { console.error("[buildcursors] onStart failed", e); }
    const go = () => {
      try {
        current = run();
      } catch (e) {
        console.error("[buildcursors]", e);
        root.classList.remove("bc-on");
      }
    };
    (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(go, go);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();

  // ── Engine ───────────────────────────────────────────────────────────────────
  function run() {
    const S = { stopped: false, stamped: false, queue: [], busy: 0 };
    const clipped = new Map(); // element → its original inline clip-path
    const hasBox = (el) => el.getClientRects().length > 0;
    const isIgnored = (el) => el.matches(IGNORE);

    // Outermost targets only: whatever is nested inside one is handled by it.
    const all = Array.from(doc.querySelectorAll(cfg.targets)).filter((el) => !isIgnored(el));
    const set = new Set(all);
    const targets = all.filter((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
      return true;
    });

    const pending = new Set();
    targets.forEach((el) => {
      if (hasBox(el)) pending.add(el);
      else markDone(el); // hidden (e.g. a collapsed menu): shown as is whenever it opens
    });
    if (!pending.size) {
      teardownStatic();
      return null;
    }

    const crewDefs =
      cfg.mobileAgents && global.matchMedia && matchMedia(`(max-width: ${cfg.mobileBreakpoint}px)`).matches
        ? cfg.agents.filter((d) => cfg.mobileAgents.includes(d.name))
        : cfg.agents;
    const crew = crewDefs.length ? crewDefs : cfg.agents;

    const layer = div("", doc.body);
    layer.id = "bc-layer";
    layer.setAttribute("aria-hidden", "true");

    // Speed up when there's a backlog (visitor scrolling fast).
    const speed = () => cfg.speed * Math.min(2.5, 1 + Math.max(0, S.queue.length - 2) * 0.3);
    const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    function tween(ms, fn) {
      return new Promise((resolve) => {
        const d = ms / speed();
        let t0 = null;
        function frame(now) {
          if (S.stopped) return resolve();
          if (t0 === null) t0 = now;
          const p = Math.min(1, (now - t0) / d);
          fn(p);
          p < 1 ? requestAnimationFrame(frame) : resolve();
        }
        requestAnimationFrame(frame);
      });
    }
    const wait = (ms) => tween(ms, () => {});

    // ── Agents ──
    const agents = crew.map((def, i) => {
      const el = div("bc-cursor", layer);
      el.innerHTML =
        `<svg viewBox="0 0 20 26"><path d="M2 2 L2 21 L7 16.5 L10.5 24 L13.5 22.7 L10.2 15.5 L17 15.5 Z" ` +
        `fill="${def.color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
      if (cfg.names) {
        const tag = doc.createElement("span");
        tag.className = "bc-name";
        tag.style.background = def.color;
        tag.textContent = def.name;
        el.appendChild(tag);
      }
      const guides = ["h", "h", "v", "v"].map((k) => {
        const g = div("bc-guide " + k, layer);
        g.style.borderColor = def.color;
        return g;
      });
      const box = div("bc-box", layer);
      box.style.borderColor = def.color;
      box.style.background = def.color + "14";
      const dim = div("bc-dim", box);
      dim.style.background = def.color;
      const caret = div("bc-caret", layer);
      caret.style.background = def.color;
      // Waiting just past the right edge.
      const a = Object.assign({}, def, {
        i, el, guides, box, dim, caret,
        x: innerWidth + 40, y: 80 + Math.random() * Math.max(1, innerHeight - 160),
        away: true, idleSince: 0,
      });
      render(a);
      return a;
    });

    function render(a) {
      a.el.style.transform = `translate(${a.x - 2}px, ${a.y - 2}px)`;
    }

    // Curved flight towards a (possibly moving, e.g. while scrolling) point.
    async function move(a, getPt, ms, onFrame) {
      const sx = a.x, sy = a.y;
      const t = getPt();
      const dist = Math.hypot(t.x - sx, t.y - sy);
      const bend = (Math.random() - 0.5) * 0.6;
      await tween(ms || clamp(dist * 0.9, 250, 900), (p) => {
        const e = ease(p), pt = getPt();
        const cx = (sx + pt.x) / 2 - (pt.y - sy) * bend;
        const cy = (sy + pt.y) / 2 + (pt.x - sx) * bend;
        a.x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * pt.x;
        a.y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * pt.y;
        render(a);
        if (onFrame) onFrame();
      });
    }

    function setGuides(a, l, t, w, h, on) {
      const [top, bottom, left, right] = a.guides;
      top.style.top = t + "px";
      bottom.style.top = t + h + "px";
      left.style.left = l + "px";
      right.style.left = l + w + "px";
      a.guides.forEach((g) => g.classList.toggle("on", on));
    }

    function ripple(a) {
      const r = div("bc-ripple", layer);
      r.style.borderColor = a.color;
      r.style.left = a.x + "px";
      r.style.top = a.y + "px";
      setTimeout(() => r.remove(), 600);
    }

    function finish(el) {
      if (clipped.has(el)) {
        el.style.clipPath = clipped.get(el);
        clipped.delete(el);
      }
      markDone(el);
      pending.delete(el);
    }

    const kindOf = (el) => {
      const b = el.getAttribute("data-build");
      if (b === "text" || b === "block" || b === "img") return b;
      if (el.tagName === "IMG") return "img";
      return el.matches(cfg.text) ? "text" : "block";
    };

    // Inside `block`, but sitting in a button/link-like element that arrives with the panel.
    const kept = (el, block) => {
      if (!cfg.keep) return false;
      const k = el.closest(cfg.keep);
      return !!k && k !== block && block.contains(k);
    };

    // Block: drag out a selection box with live W × H, then drop the element in. Its text is
    // handed to the text agents to be typed, and its images to Media to be carried in.
    async function blockTask(a, el) {
      const R = () => el.getBoundingClientRect();
      const inner = Array.from(el.querySelectorAll(cfg.text)).filter(
        (t) => !isIgnored(t) && !kept(t, el) && t.textContent.trim() && hasBox(t)
      );
      const texts = inner.filter((t) => !inner.some((o) => o !== t && o.contains(t)));
      const imgs = Array.from(el.querySelectorAll("img")).filter(
        (img) => !isIgnored(img) && !kept(img, el) && hasBox(img) && !texts.some((t) => t.contains(img))
      );
      const handed = texts.concat(imgs);
      handed.forEach((t) => {
        t.classList.add("bc-wait");
        pending.add(t);
      });

      await move(a, () => ({ x: R().left, y: R().top }));
      a.box.style.opacity = 1;
      let w = 0, h = 0;
      const paint = () => {
        const r = R();
        Object.assign(a.box.style, { left: r.left + "px", top: r.top + "px", width: w + "px", height: h + "px" });
        setGuides(a, r.left, r.top, w, h, true);
        return r;
      };
      const r0 = R();
      await tween(clamp(Math.hypot(r0.width, r0.height) * 1.1, 450, 1100), (p) => {
        const e = ease(p), r = R();
        w = r.width * e; h = r.height * e;
        a.dim.textContent = `${Math.round(w)} × ${Math.round(h)}`;
        paint();
        a.x = r.left + w; a.y = r.top + h;
        render(a);
      });
      ripple(a);
      finish(el);
      await tween(380, (p) => {
        const r = paint();
        a.box.style.opacity = 1 - p;
        a.x = r.left + w; a.y = r.top + h;
        render(a);
      });
      a.box.style.opacity = 0;
      setGuides(a, 0, 0, 0, 0, false);
      handed.forEach((t) => io.observe(t)); // queued once on screen
    }

    // Fly off the nearest side edge, grab the picture, carry it in and drop it into its frame.
    async function imgTask(a, img) {
      const R = () => img.getBoundingClientRect();
      if (!R().width || !(img.currentSrc || img.src)) return finish(img);
      const fromLeft = R().left + R().width / 2 < innerWidth / 2;
      await move(a, () => ({ x: fromLeft ? -40 : innerWidth + 40, y: clamp(R().top + R().height / 2, 90, innerHeight - 90) }), 420);
      const clone = doc.createElement("img");
      clone.alt = "";
      clone.src = img.currentSrc || img.src;
      clone.className = "bc-carry";
      clone.style.borderColor = a.color;
      layer.appendChild(clone);
      const cw = clamp(R().width * 0.35, 90, 190);
      const ch = cw * (R().height / Math.max(1, R().width) || 0.6);
      const hang = () => {
        Object.assign(clone.style, {
          left: a.x - cw / 2 + "px", top: a.y + 10 + "px", width: cw + "px", height: ch + "px",
          transform: "rotate(-4deg)",
        });
      };
      hang();
      await move(a, () => ({ x: R().left + R().width / 2, y: R().top + R().height / 2 - ch / 2 - 10 }), 600, hang);
      const sx = a.x - cw / 2, sy = a.y + 10;
      await tween(280, (p) => {
        const e = ease(p), r = R();
        Object.assign(clone.style, {
          left: sx + (r.left - sx) * e + "px", top: sy + (r.top - sy) * e + "px",
          width: cw + (r.width - cw) * e + "px", height: ch + (r.height - ch) * e + "px",
          transform: `rotate(${-4 * (1 - e)}deg)`,
        });
        a.x = r.left + r.width / 2; a.y = r.top + r.height / 2;
        render(a);
      });
      ripple(a);
      finish(img);
      clone.style.opacity = 0;
      setTimeout(() => clone.remove(), 400);
      await wait(120);
    }

    // The text's real line boxes (relative to el), so empty space is never "typed".
    function lineBoxes(el) {
      const r = el.getBoundingClientRect();
      const range = doc.createRange();
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects()).filter((q) => q.width > 1 && q.height > 1);
      rects.sort((p, q) => p.top - q.top || p.left - q.left);
      const lines = [];
      rects.forEach((q) => {
        const last = lines[lines.length - 1];
        const cy = (q.top + q.bottom) / 2;
        if (last && cy > last.top && cy < last.bottom) {
          last.left = Math.min(last.left, q.left); last.right = Math.max(last.right, q.right);
          last.top = Math.min(last.top, q.top); last.bottom = Math.max(last.bottom, q.bottom);
        } else {
          lines.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
        }
      });
      return lines.map((l) => ({ left: l.left - r.left, right: l.right - r.left, top: l.top - r.top, bottom: l.bottom - r.top }));
    }

    // Text: typed out line by line, left → right.
    async function textTask(a, el) {
      const R = () => el.getBoundingClientRect();
      const lines = lineBoxes(el);
      if (!lines.length) return finish(el);
      const widths = lines.map((l) => l.right - l.left);
      const sum = widths.reduce((x, y) => x + y, 0);
      const n = Math.max(4, el.textContent.trim().length);
      const box = {
        left: Math.min(...lines.map((l) => l.left)), right: Math.max(...lines.map((l) => l.right)),
        top: lines[0].top, bottom: lines[lines.length - 1].bottom,
      };

      await move(a, () => ({ x: R().left + lines[0].left, y: R().top + lines[0].top + (lines[0].bottom - lines[0].top) * 0.8 }));
      if (!clipped.has(el)) clipped.set(el, el.style.clipPath);
      el.classList.add("bc-live");
      a.caret.style.opacity = 1;
      await tween(clamp(n * (lines.length === 1 ? 45 : 16), 500, 2800), (p) => {
        const r = R();
        setGuides(a, r.left + box.left, r.top + box.top, box.right - box.left, box.bottom - box.top, true);
        let d = (Math.floor(p * n) / n) * sum; // typewriter steps
        let k = 0;
        while (k < lines.length - 1 && d > widths[k]) { d -= widths[k]; k++; }
        const L = lines[k], x = L.left + Math.min(d, widths[k]);
        // Everything above the current line + the current line up to the caret
        // (-40px on the left so list bullets show with their line).
        el.style.clipPath =
          `polygon(-40px -8px, ${r.width + 8}px -8px, ${r.width + 8}px ${L.top}px, ${x}px ${L.top}px, ` +
          `${x}px ${L.bottom}px, -40px ${L.bottom}px)`;
        const cx = r.left + x, cy = r.top + L.top, chh = L.bottom - L.top;
        Object.assign(a.caret.style, { left: cx + "px", top: cy + "px", height: chh + "px" });
        a.x = cx + 3; a.y = cy + chh * 0.75;
        render(a);
      });
      a.caret.style.opacity = 0;
      finish(el);
      setGuides(a, 0, 0, 0, 0, false);
    }

    // ── Work queue: only what's on screen gets built; what scrolls past just appears. ──
    const unqueue = (el) => {
      const i = S.queue.indexOf(el);
      if (i >= 0) S.queue.splice(i, 1);
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!pending.has(target) || target._bcTaken) return;
          if (isIntersecting) {
            if (!S.queue.includes(target)) {
              S.queue.push(target);
              S.queue.sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
            }
          } else if (S.queue.includes(target)) {
            unqueue(target);
            finish(target);
          }
        });
      },
      { threshold: 0.15 }
    );
    pending.forEach((t) => io.observe(t));

    // Safety net: a fast scroll can jump over an element without the observer ever seeing it on
    // screen; anything already scrolled past (even partly, above the top edge) and not being
    // worked on just appears.
    let scrollQueued = false;
    const onScroll = () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        pending.forEach((el) => {
          if (el._bcTaken) return;
          const r = el.getBoundingClientRect();
          if (r.bottom > 0 && (r.top >= 0 || S.queue.includes(el))) return;
          unqueue(el);
          finish(el);
        });
      });
    };
    addEventListener("scroll", onScroll, { passive: true });

    // Keyboard users: anything focused is built instantly.
    const onFocus = (e) => {
      for (let t = e.target; t && t !== doc.body; t = t.parentElement) {
        if (pending.has(t)) {
          unqueue(t);
          finish(t);
        }
      }
    };
    doc.addEventListener("focusin", onFocus);

    const onKey = (e) => {
      if (e.key === "Escape") skip();
    };
    if (cfg.escToSkip) doc.addEventListener("keydown", onKey);

    // Off-screen spot just past the right edge, at the agent's current height.
    const offRight = (a) => ({ x: innerWidth + 40, y: clamp(a.y, 40, innerHeight - 40) });

    // Nothing to do on screen: retreat off the right edge instead of hovering over the content.
    async function hide(a) {
      a.away = true;
      const pt = offRight(a);
      await move(a, () => pt, 500);
      a.el.style.opacity = 0;
    }

    // Work arrived: reappear just off-screen and fly in from there.
    function show(a) {
      a.away = false;
      a.el.style.opacity = 1;
    }

    // Own kind of work first; otherwise help with whatever is waiting.
    function takeTask(a) {
      const pick = (kind) => {
        const i = S.queue.findIndex((el) => kindOf(el) === kind);
        return i < 0 ? null : { kind, el: S.queue.splice(i, 1)[0] };
      };
      return (a.role && pick(a.role)) || pick("img") || pick("block") || pick("text");
    }

    async function agentLoop(a) {
      await wait(300 + a.i * 60); // let the IntersectionObserver fill the queue first
      while (!S.stopped && pending.size) {
        const task = takeTask(a);
        if (!task) {
          if (!S.busy) stamp(); // first screen built → count it as seen
          // Short grace period: a panel that just landed hands its text over a moment later.
          const now = performance.now();
          if (!a.idleSince) a.idleSince = now;
          if (!a.away && now - a.idleSince > 900) await hide(a);
          else await wait(200);
          continue;
        }
        a.idleSince = 0;
        if (a.away) show(a);
        task.el._bcTaken = true;
        S.busy++;
        try {
          if (task.kind === "img") await imgTask(a, task.el);
          else if (task.kind === "text") await textTask(a, task.el);
          else await blockTask(a, task.el);
        } finally {
          S.busy--;
        }
      }
    }

    // Everything built: the crew lines up in a column on the right edge, each gives one
    // little hop, and they leave off the right side together.
    async function finale() {
      const n = agents.length;
      const gap = Math.min(56, (innerHeight - 160) / Math.max(1, n - 1));
      const top = Math.max(90, (innerHeight - gap * (n - 1)) / 2);
      const spot = (a) => ({ x: innerWidth - 100, y: top + a.i * gap }); // room for the label

      agents.forEach(show);
      await Promise.all(agents.map(async (a) => {
        await wait(a.i * 80);
        await move(a, () => spot(a), 800);
      }));
      if (S.stopped) return;
      await wait(300);

      await Promise.all(agents.map(async (a) => {
        await wait(a.i * 70);
        const p = spot(a);
        await tween(380, (t) => { a.x = p.x; a.y = p.y - Math.sin(t * Math.PI) * 12; render(a); });
      }));
      if (S.stopped) return;
      await wait(350);

      await Promise.all(agents.map(async (a) => {
        await wait(a.i * 60);
        const out = offRight(a);
        await move(a, () => out, 600);
      }));
    }

    function stamp() {
      if (S.stamped) return;
      S.stamped = true;
      try { localStorage.setItem(cfg.storageKey, String(Date.now())); } catch (e) {}
    }

    let tornDown = false;
    function teardown() {
      if (tornDown) return;
      tornDown = true;
      io.disconnect();
      doc.removeEventListener("focusin", onFocus);
      doc.removeEventListener("keydown", onKey);
      removeEventListener("scroll", onScroll);
      layer.remove();
      root.classList.remove("bc-on");
      current = null;
      try {
        if (typeof cfg.onDone === "function") cfg.onDone();
      } catch (e) { console.error("[buildcursors] onDone failed", e); }
    }

    function skip() {
      if (S.stopped) return;
      S.stopped = true;
      stamp();
      S.queue.length = 0;
      Array.from(pending).forEach(finish);
      teardown();
    }

    Promise.all(agents.map(agentLoop)).then(async () => {
      if (S.stopped) return;
      stamp();
      if (cfg.finale) await finale();
      else await Promise.all(agents.filter((a) => !a.away).map(hide));
      if (!S.stopped) teardown();
    });

    return { skip };
  }

  function markDone(el) {
    el.classList.remove("bc-live", "bc-wait");
    el.classList.add("bc-done");
    // Nested targets come along, except parts handed over to be typed / carried in.
    el.querySelectorAll(cfg.targets).forEach((d) => {
      if (!d.classList.contains("bc-wait")) d.classList.add("bc-done");
    });
  }

  // Nothing to build (no visible targets): just drop the hiding rules.
  function teardownStatic() {
    root.classList.remove("bc-on");
  }

  function div(cls, parent) {
    const d = doc.createElement("div");
    if (cls) d.className = cls;
    parent.appendChild(d);
    return d;
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  global.buildcursors = {
    version: VERSION,
    config: cfg,
    replay,
    skip() { if (current) current.skip(); },
    get running() { return !!current; },
  };
})(window);

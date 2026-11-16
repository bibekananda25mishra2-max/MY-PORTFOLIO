"use strict";

/* ==========================================================
   Settings you can edit
   ========================================================== */

// Paste your Formspree endpoint here, e.g. "https://formspree.io/f/abcdwxyz".
// While this is empty, the contact form opens the visitor's email app instead.
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "bibekananda25mishra2@gmail.com";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ==========================================================
   Footer year
   ========================================================== */
document.getElementById("year").textContent = new Date().getFullYear();

/* ==========================================================
   Navigation: scrolled state, mobile menu, active link
   ========================================================== */
const nav = document.getElementById("nav");
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

function updateNavState() {
  nav.classList.toggle("is-scrolled", window.scrollY > 12);
}
updateNavState();
window.addEventListener("scroll", updateNavState, { passive: true });

function setMenu(open) {
  navLinks.classList.toggle("is-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
navToggle.addEventListener("click", () => setMenu(navToggle.getAttribute("aria-expanded") !== "true"));
navLinks.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

const sectionLinks = [...navLinks.querySelectorAll('a[href^="#"]')];
const spy = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    sectionLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id);
    });
  });
}, { rootMargin: "-45% 0px -50% 0px" });
sectionLinks.forEach((link) => {
  const target = document.querySelector(link.getAttribute("href"));
  if (target) spy.observe(target);
});

/* ==========================================================
   Scroll reveal
   ========================================================== */
const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !prefersReducedMotion) {
  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach((el, i) => {
    el.style.transitionDelay = (i % 3) * 80 + "ms";
    revealObserver.observe(el);
  });
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

/* ==========================================================
   Toast
   ========================================================== */
const toast = document.getElementById("toast");
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-shown");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-shown"), 2200);
}

/* ==========================================================
   Copy email
   ========================================================== */
document.getElementById("copyEmail").addEventListener("click", async (e) => {
  const email = e.currentTarget.dataset.email;
  try {
    await navigator.clipboard.writeText(email);
    showToast("Email copied");
  } catch {
    // Fallback for older browsers or non-secure pages
    const temp = document.createElement("textarea");
    temp.value = email;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    try { document.execCommand("copy"); showToast("Email copied"); }
    catch { showToast("Copy failed. Select the email and copy it."); }
    temp.remove();
  }
});

/* ==========================================================
   Contact form
   ========================================================== */
const form = document.getElementById("contactForm");
const statusEl = document.getElementById("formStatus");

function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = "form__status" + (type ? " is-" + type : "");
}

function validate() {
  let valid = true;
  form.querySelectorAll(".field").forEach((field) => {
    const input = field.querySelector("input, textarea");
    let ok = input.value.trim() !== "";
    if (ok && input.type === "email") ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
    field.classList.toggle("has-error", !ok);
    if (!ok) valid = false;
  });
  return valid;
}

form.addEventListener("input", (e) => {
  const field = e.target.closest(".field");
  if (field) field.classList.remove("has-error");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) {
    setStatus("Please fill in your name, a valid email, and a message.", "error");
    return;
  }

  const data = new FormData(form);

  // No backend configured yet: open the visitor's email app with the message filled in.
  if (!FORM_ENDPOINT) {
    const subject = encodeURIComponent("Portfolio message from " + data.get("name"));
    const body = encodeURIComponent(data.get("message") + "\n\nFrom: " + data.get("name") + " (" + data.get("email") + ")");
    window.location.href = "mailto:" + CONTACT_EMAIL + "?subject=" + subject + "&body=" + body;
    setStatus("Opening your email app to send the message.", "ok");
    return;
  }

  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  setStatus("Sending...", "");
  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Request failed");
    form.reset();
    setStatus("Message sent. I'll reply soon.", "ok");
  } catch {
    setStatus("Message not sent. Please email me directly instead.", "error");
  } finally {
    button.disabled = false;
  }
});

/* ==========================================================
   Hero visual: breadth-first search on a small graph
   ========================================================== */
(function graphHero() {
  const canvas = document.getElementById("graph");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const styles = getComputedStyle(document.documentElement);
  const COLORS = {
    ink: styles.getPropertyValue("--ink").trim(),
    cobalt: styles.getPropertyValue("--cobalt").trim(),
    amber: styles.getPropertyValue("--amber").trim(),
    line: styles.getPropertyValue("--line").trim(),
  };

  const STEP_MS = 280;   // time between node visits
  const HOLD_MS = 2200;  // pause once the search finishes

  let W = 0, H = 0;
  let nodes = [], edges = [], adj = [];
  let order = [];        // [{ node, from }] in visit order
  let revealed = 0;
  let lastStep = 0, holdUntil = 0, lastRevealAt = 0;
  let rafId = null;
  let inView = true;

  // Small seeded random so the layout is the same on every load
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildGraph() {
    const rand = rng(11);
    const cols = 5, rows = 5;
    nodes = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) / cols + (rand() - 0.5) * 0.12) * W;
        const y = ((r + 0.5) / rows + (rand() - 0.5) * 0.12) * H;
        nodes.push({ x, y });
      }
    }

    const seen = new Set();
    edges = [];
    adj = nodes.map(() => []);
    nodes.forEach((a, i) => {
      nodes
        .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }))
        .filter((o) => o.j !== i)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3)
        .forEach(({ j }) => {
          const key = i < j ? i + "-" + j : j + "-" + i;
          if (seen.has(key)) return;
          seen.add(key);
          edges.push([i, j]);
          adj[i].push(j);
          adj[j].push(i);
        });
    });
  }

  function runSearch(start) {
    const visited = new Set([start]);
    const queue = [start];
    order = [{ node: start, from: -1 }];
    while (queue.length) {
      const u = queue.shift();
      adj[u].forEach((v) => {
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
          order.push({ node: v, from: u });
        }
      });
    }
  }

  function restart(now, startNode) {
    runSearch(startNode ?? Math.floor(Math.random() * nodes.length));
    revealed = 1;
    lastStep = now;
    lastRevealAt = now;
    holdUntil = 0;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildGraph();
    restart(performance.now());
    if (prefersReducedMotion) revealed = order.length;
    draw(performance.now());
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);

    // All edges, faint
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COLORS.line;
    ctx.beginPath();
    edges.forEach(([a, b]) => {
      ctx.moveTo(nodes[a].x, nodes[a].y);
      ctx.lineTo(nodes[b].x, nodes[b].y);
    });
    ctx.stroke();

    // Edges the search has walked
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.cobalt;
    ctx.beginPath();
    for (let i = 1; i < revealed; i++) {
      const { node, from } = order[i];
      ctx.moveTo(nodes[from].x, nodes[from].y);
      ctx.lineTo(nodes[node].x, nodes[node].y);
    }
    ctx.stroke();

    // Nodes
    const visitedAt = new Map(order.slice(0, revealed).map((o, i) => [o.node, i]));
    ctx.font = '600 11px "Instrument Sans", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    nodes.forEach((n, i) => {
      const idx = visitedAt.get(i);
      const isNewest = idx === revealed - 1 && revealed < order.length + 1 && !prefersReducedMotion;

      if (idx === undefined) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = COLORS.ink;
        ctx.stroke();
        return;
      }

      if (isNewest) {
        const t = Math.min((now - lastRevealAt) / 600, 1);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 13 + t * 12, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.amber;
        ctx.globalAlpha = 1 - t;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const radius = idx === 0 ? 15 : 13;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isNewest || idx === 0 ? (isNewest ? COLORS.amber : COLORS.ink) : COLORS.cobalt;
      ctx.fill();
      ctx.fillStyle = isNewest ? COLORS.ink : "#fff";
      ctx.fillText(String(idx + 1), n.x, n.y + 0.5);
    });
  }

  function tick(now) {
    rafId = null;
    if (!inView || document.hidden) return;

    if (revealed >= order.length) {
      if (!holdUntil) holdUntil = now + HOLD_MS;
      if (now >= holdUntil) restart(now);
    } else if (now - lastStep >= STEP_MS) {
      revealed++;
      lastStep = now;
      lastRevealAt = now;
    }

    draw(now);
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (prefersReducedMotion || rafId !== null) return;
    rafId = requestAnimationFrame(tick);
  }

  // Run only while visible to save battery
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) start();
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });

  canvas.style.cursor = "pointer";
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = 32 * 32;
    nodes.forEach((n, i) => { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = i; } });
    if (best < 0) return;
    restart(performance.now(), best);
    if (prefersReducedMotion) { revealed = order.length; draw(performance.now()); } else start();
  });

  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }).observe(canvas);

  resize();
  start();
})();

/* ==========================================================
   Round 2: motion & depth
   ========================================================== */
(function effects() {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const rm = prefersReducedMotion;
  const $$ = (s) => [...document.querySelectorAll(s)];

  // Scroll progress, timeline line, about word-fill
  const progress = document.getElementById("progress");
  const timeline = document.querySelector(".timeline");
  const words = $$(".wordfill").flatMap((p) => {
    const parts = p.textContent.split(/(\s+)/);
    p.textContent = "";
    return parts.map((t) => {
      if (/^\s+$/.test(t)) { p.append(t); return null; }
      const s = document.createElement("span");
      s.className = "w"; s.textContent = t; p.append(s); return s;
    }).filter(Boolean);
  });
  const aboutEl = document.querySelector(".about");
  let ticking = false;
  function onScroll() {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = "scaleX(" + (max > 0 ? scrollY / max : 0) + ")";
    if (timeline) {
      const r = timeline.getBoundingClientRect();
      timeline.style.setProperty("--tl", Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height)));
    }
    if (aboutEl && words.length) {
      const r = aboutEl.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.25)));
      const n = rm ? words.length : Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("lit", i < n));
    }
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // Marquee: duplicate the track for a seamless loop
  const track = document.querySelector(".marquee__track");
  if (track) track.innerHTML += track.innerHTML;

  // Section headings: word-by-word mask reveal
  $$(".section__head h2").forEach((h) => {
    h.innerHTML = h.textContent.trim().split(/\s+/).map((w, i) => '<span class="mask"><span class="word" style="--i:' + i + '">' + w + "</span></span>").join(" ");
  });
  $$(".chips").forEach((c) => [...c.children].forEach((li, i) => li.style.setProperty("--i", i)));

  // Hero name: split into letters; role: scramble-decode
  const name = document.querySelector(".hero__name");
  if (name && !rm) {
    let i = 0;
    name.querySelectorAll(".line > span").forEach((s) => {
      s.innerHTML = [...s.textContent].map((c) => '<span class="ch" style="--i:' + i++ + '">' + c + "</span>").join("");
    });
    name.classList.add("is-split");
  }
  const role = document.querySelector(".hero__role");
  if (role && !rm) {
    const final = role.textContent, glyphs = "01{}<>/#$%&*";
    role.setAttribute("aria-label", final);
    let f = 0;
    setTimeout(() => {
      const t = setInterval(() => {
        role.textContent = [...final].map((c, k) => (c === " " || k < f / 1.5) ? c : glyphs[Math.floor(Math.random() * glyphs.length)]).join("");
        if (++f > final.length * 1.5) { clearInterval(t); role.textContent = final; }
      }, 40);
    }, 250);
  }

  if (!fine || rm) return;

  // Cursor glow (eased)
  const glow = document.getElementById("cursorGlow");
  let gx = 0, gy = 0, tx = 0, ty = 0, glowRun = false;
  addEventListener("pointermove", (e) => {
    tx = e.clientX; ty = e.clientY; glow.classList.add("is-on");
    if (!glowRun) { glowRun = true; requestAnimationFrame(follow); }
  }, { passive: true });
  function follow() {
    gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
    glow.style.transform = "translate3d(" + gx + "px," + gy + "px,0)";
    if (Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5) requestAnimationFrame(follow); else glowRun = false;
  }

  // 3D tilt + spotlight on cards and the graph panel
  $$(".project, .hero__viz").forEach((el) => {
    const max = el.classList.contains("project") ? 3 : 7;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.classList.add("is-tilting");
      el.style.setProperty("--ry", ((px - 0.5) * 2 * max).toFixed(2) + "deg");
      el.style.setProperty("--rx", ((0.5 - py) * 2 * max).toFixed(2) + "deg");
      el.style.setProperty("--mx", px * 100 + "%");
      el.style.setProperty("--my", py * 100 + "%");
    });
    el.addEventListener("pointerleave", () => el.classList.remove("is-tilting"));
  });

  // Magnetic buttons
  $$(".btn").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty("--tx", (e.clientX - r.left - r.width / 2) * 0.22 + "px");
      b.style.setProperty("--ty", (e.clientY - r.top - r.height / 2) * 0.3 + "px");
    });
    b.addEventListener("pointerleave", () => { b.style.setProperty("--tx", "0px"); b.style.setProperty("--ty", "0px"); });
  });
})();

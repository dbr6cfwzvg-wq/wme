/* =========================================================
   Wharton Media & Entertainment Club — interactions
   ========================================================= */
(() => {
  const root = document.documentElement;
  const body = document.body;
  const header = document.getElementById('header');
  const brand = document.getElementById('brand');
  const brandFull = brand.querySelector('.brand__full');
  const brandSmall = brand.querySelector('.brand__small');
  const slot = document.getElementById('logoSlot');
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobileMenu');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Geometry of the source images (graphic area of the full logo vs. the whole file)
  const FULL_W = 1276, FULL_H = 964;   // homepage-logo.webp
  const GFX_W = 1256, GFX_H = 840;     // graphic portion (no text) inside it

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- Logo morph: hero → sticky header ---------- */
  let hero = {}, dock = {}, morphDistance = 1;
  let targetP = 0, currentP = -1;

  function measure() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Full logo (with text) fills the screen while staying fully visible
    const fullW = Math.min(vw * 0.84, (vh * 0.74) * (FULL_W / FULL_H), 1100);
    const fullH = fullW * (FULL_H / FULL_W);
    const boxW = fullW * (GFX_W / FULL_W);
    const boxH = boxW * (GFX_H / GFX_W);
    const fullLeft = (vw - fullW) / 2;
    const fullTop = (vh - fullH) / 2 - vh * 0.02;

    hero = {
      x: fullLeft + fullW * (10 / FULL_W),
      y: fullTop + fullH * (10 / FULL_H),
      w: boxW,
      h: boxH,
    };

    const r = slot.getBoundingClientRect();
    dock = { x: r.left, y: r.top, w: r.width, h: r.width * (GFX_H / GFX_W) };
    dock.y = r.top + (r.height - dock.h) / 2;

    morphDistance = Math.max(vh * 0.75, 300);
    currentP = -1; // force a repaint
  }

  function renderMorph(p) {
    const e = easeInOut(p);
    const x = lerp(hero.x, dock.x, e);
    const y = lerp(hero.y, dock.y, e);
    const w = lerp(hero.w, dock.w, e);
    const h = lerp(hero.h, dock.h, e);

    brand.style.width = w + 'px';
    brand.style.height = h + 'px';
    brand.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    // The two graphics overlap exactly: bring the text-less logo in underneath
    // first, then fade the full logo out so only the wordmark text disappears.
    brandSmall.style.opacity = clamp(p / 0.08);
    brandFull.style.opacity = 1 - clamp((p - 0.08) / 0.3);

    root.style.setProperty('--p', p.toFixed(4));
    header.classList.toggle('is-docked', p > 0.85);
  }

  /* ---------- Scroll-linked bits ---------- */
  const progressBar = document.querySelector('.progress');
  const perfs = document.querySelectorAll('.perf');
  const parallaxEls = [...document.querySelectorAll('[data-parallax]')];

  function onScroll() {
    const y = window.scrollY;
    targetP = clamp(y / morphDistance);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);

    perfs.forEach(el => el.style.setProperty('--perf-x', (y * 0.35).toFixed(1) + 'px'));

    if (!reduceMotion) {
      const vh = window.innerHeight;
      parallaxEls.forEach(img => {
        const r = img.parentElement.getBoundingClientRect();
        const offset = (r.top + r.height / 2 - vh / 2) * parseFloat(img.dataset.parallax);
        img.style.setProperty('--py', (-offset).toFixed(1) + 'px');
      });
    }
  }

  function tick() {
    // ease toward the scroll target for a buttery morph
    if (currentP < 0) currentP = targetP;
    else currentP += (targetP - currentP) * (reduceMotion ? 1 : 0.16);
    if (Math.abs(targetP - currentP) < 0.0005) currentP = targetP;
    renderMorph(currentP);
    requestAnimationFrame(tick);
  }

  /* ---------- Smooth anchor scrolling ---------- */
  let scrollAnim = null;

  function smoothScrollTo(targetY) {
    const startY = window.scrollY;
    const dist = targetY - startY;
    if (reduceMotion || Math.abs(dist) < 2) {
      window.scrollTo(0, targetY);
      return;
    }
    const duration = clamp(Math.abs(dist) / 2.2, 650, 1600);
    const start = performance.now();
    cancelAnimationFrame(scrollAnim);

    const step = now => {
      const t = clamp((now - start) / duration);
      window.scrollTo(0, startY + dist * easeInOut(t));
      if (t < 1) scrollAnim = requestAnimationFrame(step);
    };
    scrollAnim = requestAnimationFrame(step);
  }

  // Cancel the programmatic scroll if the user takes over
  ['wheel', 'touchstart', 'keydown'].forEach(evt =>
    window.addEventListener(evt, () => cancelAnimationFrame(scrollAnim), { passive: true })
  );

  function targetFor(id) {
    if (id === 'home') return 0;
    const el = document.getElementById(id);
    if (!el) return null;
    const headerH = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 80;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH + 1;
    // never land inside the hero morph zone — always fully docked
    return Math.max(top, morphDistance);
  }

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const y = targetFor(id);
      if (y === null) return;
      e.preventDefault();
      closeMenu();
      smoothScrollTo(y);
      history.replaceState(null, '', '#' + id);
    });
  });

  /* ---------- Active nav link ---------- */
  const sectionIds = ['about', 'treks', 'conference', 'join'];
  const links = document.querySelectorAll('[data-link]');

  function updateActive() {
    const mark = window.innerHeight * 0.4;
    let active = null;
    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= mark) active = id;
    });
    // bottom of page → last section
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = 'join';
    links.forEach(l => l.classList.toggle('is-active', l.dataset.link === active));
  }

  /* ---------- Split headings into words ---------- */
  function splitWords(el) {
    let n = 0;
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
            } else {
              const w = document.createElement('span');
              w.className = 'w';
              const inner = document.createElement('span');
              inner.style.setProperty('--w', n++);
              inner.textContent = part;
              w.appendChild(inner);
              frag.appendChild(w);
            }
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(el);
  }
  document.querySelectorAll('[data-split]').forEach(splitWords);

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('[data-reveal], [data-split]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-in'));
  }

  /* ---------- Mobile menu ---------- */
  function closeMenu() {
    body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    menu.setAttribute('aria-hidden', 'true');
  }
  burger.addEventListener('click', () => {
    const open = !body.classList.contains('menu-open');
    body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ---------- Trek countdown ---------- */
  const countdown = document.getElementById('countdown');
  const trekStart = new Date('2026-11-12T09:00:00-05:00');
  const trekEnd = new Date('2026-11-13T23:59:59-05:00');
  const cd = {};
  countdown.querySelectorAll('[data-cd]').forEach(el => (cd[el.dataset.cd] = el));
  const pad = v => String(v).padStart(2, '0');

  function updateCountdown() {
    const now = new Date();
    if (now >= trekEnd) {
      countdown.remove();
      return false;
    }
    if (now >= trekStart) {
      countdown.classList.add('is-live');
      countdown.textContent = 'The trek is happening now — see you in NYC!';
      return false;
    }
    let s = Math.floor((trekStart - now) / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    cd.d.textContent = pad(d);
    cd.h.textContent = pad(h);
    cd.m.textContent = pad(m);
    cd.s.textContent = pad(s);
    return true;
  }
  if (updateCountdown()) {
    const timer = setInterval(() => { if (!updateCountdown()) clearInterval(timer); }, 1000);
  }

  /* ---------- Film-leader countdown (Conference) ---------- */
  const leaderNum = document.getElementById('leaderNum');
  const sweep = document.querySelector('.leader__sweep');
  let leaderN = 5;
  sweep.addEventListener('animationiteration', () => {
    leaderN = leaderN <= 1 ? 5 : leaderN - 1;
    leaderNum.textContent = leaderN;
  });

  /* ---------- Init ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();

  let resizeRaf;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { measure(); onScroll(); updateActive(); });
  });
  window.addEventListener('scroll', () => { onScroll(); updateActive(); }, { passive: true });

  measure();
  onScroll();
  updateActive();
  requestAnimationFrame(tick);

  // honour deep links like /#treks once fonts/layout have settled
  window.addEventListener('load', () => {
    measure();
    const id = location.hash.slice(1);
    if (id && id !== 'home') {
      const y = targetFor(id);
      if (y !== null) window.scrollTo(0, y);
    }
    onScroll();
  });
})();

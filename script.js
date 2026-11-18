/* =========================================================
   Media & Entertainment Club at Wharton — interactions
   ========================================================= */
(() => {
  const root = document.documentElement;
  const body = document.body;
  const header = document.getElementById('header');
  const brand = document.getElementById('brand');
  const brandFull = brand.querySelector('.brand__full'); // only on the home page
  const brandSmall = brand.querySelector('.brand__small');
  const slot = document.getElementById('logoSlot');
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobileMenu');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Only the home page has the full-screen logo; inner pages start docked.
  const isHome = !!document.querySelector('.hero');

  // Both logo files share the same canvas; the small one just drops the tagline
  const LOGO_W = 998, LOGO_H = 538;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- Logo morph: hero → sticky header ---------- */
  let hero = {}, dock = {}, morphDistance = 1;
  let targetP = 0, currentP = -1;

  function measure() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Full logo fills the screen while staying fully visible
    const w = Math.min(vw * 0.86, (vh * 0.62) * (LOGO_W / LOGO_H), 1150);
    const h = w * (LOGO_H / LOGO_W);
    hero = { x: (vw - w) / 2, y: (vh - h) / 2 - vh * 0.03, w, h };

    const r = slot.getBoundingClientRect();
    const dh = r.width * (LOGO_H / LOGO_W);
    dock = { x: r.left, y: r.top + (r.height - dh) / 2, w: r.width, h: dh };
    if (!isHome) hero = dock;

    morphDistance = Math.max(vh * 0.75, 300);
    currentP = -1; // force a repaint
    if (!isHome) requestAnimationFrame(tick); // inner pages only repaint on demand
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

    // The two images overlap exactly: bring the tagline-free logo in underneath
    // first, then fade the full logo out so only "Club at Wharton" disappears.
    brandSmall.style.opacity = clamp(p / 0.08);
    if (brandFull) brandFull.style.opacity = 1 - clamp((p - 0.08) / 0.3);

    root.style.setProperty('--p', p.toFixed(4));
    header.classList.toggle('is-docked', p > 0.85);
  }

  /* ---------- Scroll-linked bits ---------- */
  const progressBar = document.querySelector('.progress');
  const perfs = document.querySelectorAll('.wave');
  const parallaxEls = [...document.querySelectorAll('[data-parallax]')];

  function onScroll() {
    const y = window.scrollY;
    targetP = isHome ? clamp(y / morphDistance) : 1;

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
    if (isHome) requestAnimationFrame(tick);
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
    if (id === 'home' || id === '') return 0;
    const el = document.getElementById(id);
    if (!el) return null;
    const headerH = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 80;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH + 1;
    // never land inside the hero morph zone — always fully docked
    return isHome ? Math.max(top, morphDistance) : top;
  }

  // Links to somewhere on the current page (e.g. the logo or "About" on the
  // home page) glide there; links to other pages load normally.
  const samePath = url =>
    url.origin === location.origin &&
    url.pathname.replace(/index\.html$/, '') === location.pathname.replace(/index\.html$/, '');

  document.querySelectorAll('a[href]').forEach(a => {
    a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
      const url = new URL(a.href, location.href);
      if (!samePath(url)) return;
      const id = url.hash.slice(1);
      const y = targetFor(id);
      if (y === null) return;
      e.preventDefault();
      closeMenu();
      smoothScrollTo(y);
      history.replaceState(null, '', id ? '#' + id : location.pathname);
    });
  });

  /* ---------- Active nav link ---------- */
  // Inner pages highlight their own link; the home page lights up "About"
  // once the About section scrolls into view.
  const links = document.querySelectorAll('[data-link]');
  const aboutEl = document.getElementById('about');

  function updateActive() {
    let active = body.dataset.page;
    if (isHome) {
      active = aboutEl && aboutEl.getBoundingClientRect().top <= window.innerHeight * 0.4 ? 'about' : null;
    }
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

  /* ---------- Film-leader countdown (Conference) ---------- */
  const leaderNum = document.getElementById('leaderNum');
  const sweep = document.querySelector('.leader__sweep');
  let leaderN = 5;
  if (sweep && leaderNum) {
    sweep.addEventListener('animationiteration', () => {
      leaderN = leaderN <= 1 ? 5 : leaderN - 1;
      leaderNum.textContent = leaderN;
    });
  }

  /* ---------- Marquee sign bulbs ---------- */
  // Evenly space whole bulbs around a rounded rectangle just inside the sign's border.
  function layoutBulbs(sign) {
    const bulbBox = sign.querySelector('.sign__bulbs');
    const inset = 13, r = 10, gap = 24;
    const W = sign.clientWidth - inset * 2;
    const H = sign.clientHeight - inset * 2;
    if (W <= 2 * r || H <= 2 * r) return;

    const sx = W - 2 * r, sy = H - 2 * r, arc = Math.PI * r / 2;
    // perimeter walked clockwise from the top-left, after the corner
    const segs = [
      { len: sx,  at: t => [inset + r + t, inset] },
      { len: arc, at: t => corner(inset + W - r, inset + r, -90, t) },
      { len: sy,  at: t => [inset + W, inset + r + t] },
      { len: arc, at: t => corner(inset + W - r, inset + H - r, 0, t) },
      { len: sx,  at: t => [inset + W - r - t, inset + H] },
      { len: arc, at: t => corner(inset + r, inset + H - r, 90, t) },
      { len: sy,  at: t => [inset, inset + H - r - t] },
      { len: arc, at: t => corner(inset + r, inset + r, 180, t) },
    ];
    function corner(cx, cy, startDeg, t) {
      const a = (startDeg * Math.PI) / 180 + t / r;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }

    const total = segs.reduce((s, g) => s + g.len, 0);
    const n = Math.max(12, Math.round(total / gap / 3) * 3); // multiple of 3 keeps the chase seamless
    const step = total / n;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      let d = i * step, k = 0;
      while (d > segs[k].len && k < segs.length - 1) d -= segs[k++].len;
      const [x, y] = segs[k].at(d);
      const b = document.createElement('i');
      b.className = 'bulb';
      b.style.left = x.toFixed(1) + 'px';
      b.style.top = y.toFixed(1) + 'px';
      b.style.setProperty('--k', i % 3);
      frag.appendChild(b);
    }
    bulbBox.replaceChildren(frag);
  }

  document.querySelectorAll('.sign').forEach(sign => {
    if (!sign.querySelector('.sign__bulbs')) return;
    layoutBulbs(sign);
    if ('ResizeObserver' in window) new ResizeObserver(() => layoutBulbs(sign)).observe(sign);
  });

  /* ---------- About: NYC Trek photo carousel ---------- */
  const carousel = document.getElementById('carousel');
  if (carousel) {
    const slides = [...carousel.querySelectorAll('.carousel__slide')];
    const dots = [...document.querySelectorAll('.carousel__dot')];
    let index = 0, timer = null;

    const show = i => {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, k) => {
        s.classList.toggle('is-active', k === index);
        s.setAttribute('aria-hidden', String(k !== index));
      });
      dots.forEach((d, k) => {
        d.classList.toggle('is-active', k === index);
        d.setAttribute('aria-current', String(k === index));
      });
    };
    const play = () => {
      if (reduceMotion) return;
      clearInterval(timer);
      timer = setInterval(() => show(index + 1), 5000);
    };
    const stop = () => clearInterval(timer);

    carousel.querySelector('.carousel__btn--prev').addEventListener('click', () => { show(index - 1); play(); });
    carousel.querySelector('.carousel__btn--next').addEventListener('click', () => { show(index + 1); play(); });
    dots.forEach((d, k) => d.addEventListener('click', () => { show(k); play(); }));

    // pause while someone is looking closely
    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', play);
    carousel.addEventListener('focusin', stop);
    carousel.addEventListener('focusout', play);

    // swipe on touch screens
    let x0 = null;
    carousel.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    carousel.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
      x0 = null;
      play();
    });

    carousel.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { show(index - 1); play(); }
      if (e.key === 'ArrowRight') { show(index + 1); play(); }
    });

    // only auto-advance while the carousel is on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => (en.isIntersecting ? play() : stop())).observe(carousel);
    } else {
      play();
    }
  }

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

  // honour deep links like index.html#about once fonts/layout have settled
  window.addEventListener('load', () => {
    measure();
    const id = location.hash.slice(1);
    if (id && id !== 'home' && document.getElementById(id)) {
      const y = targetFor(id);
      if (y !== null) window.scrollTo(0, y);
    }
    onScroll();
  });
})();

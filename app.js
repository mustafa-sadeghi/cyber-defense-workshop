/* CYBER//AWARE — defensive education workshop */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const on = (el, evt, fn, opts) => { if (el) el.addEventListener(evt, fn, opts); };

  const slides = $$('.slide');
  if (!slides.length) return;

  let index = Math.max(0, slides.findIndex(s => s.classList.contains('active')));
  let presentation = document.body.classList.contains('presentation-mode');
  let lock = false;
  const pad = n => String(n).padStart(2, '0');

  const slideTotal = $('#slideTotal');
  if (slideTotal) slideTotal.textContent = pad(slides.length);

  // Build the navigation from the deck itself so slide count/title edits never break the menu.
  const nav = $('#chapterNav');
  if (nav) {
    nav.innerHTML = '';
    slides.forEach((slide, i) => {
      const b = document.createElement('button');
      const label = slide.dataset.title || `بخش ${i + 1}`;
      b.innerHTML = `<span>${label}</span><small>${pad(i + 1)}</small>`;
      on(b, 'click', () => { go(i); closeDrawer(); });
      nav.appendChild(b);
    });
  }

  function syncUI() {
    const s = slides[index];
    const slideNow = $('#slideNow');
    const chapterLabel = $('#chapterLabel');
    const progressBar = $('#progressBar');
    if (slideNow) slideNow.textContent = pad(index + 1);
    if (chapterLabel) chapterLabel.textContent = s?.dataset.short || s?.dataset.title || '';
    if (progressBar) progressBar.style.width = `${((index + 1) / slides.length) * 100}%`;
    $$('#chapterNav button').forEach((b, i) => b.classList.toggle('active', i === index));
    if (presentation && s?.id) history.replaceState(null, '', `#${s.id}`);
  }

  function preloadSlideImages(slide) {
    if (!slide) return;
    $$('img', slide).forEach(img => {
      attachImageHandling(img);
      if (!img.complete) {
        const p = new Image();
        p.referrerPolicy = 'no-referrer';
        p.src = img.currentSrc || img.src;
      }
    });
  }

  function warmNearbyImages(centerIndex) {
    for (let offset = 0; offset <= 2; offset += 1) {
      preloadSlideImages(slides[centerIndex + offset]);
    }
  }

  function go(nextIndex) {
    nextIndex = Math.max(0, Math.min(slides.length - 1, nextIndex));

    if (!presentation) {
      index = nextIndex;
      syncUI();
      slides[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (nextIndex === index || lock) return;
    lock = true;
    const old = slides[index];
    const nextSlide = slides[nextIndex];

    old.classList.add('leaving');
    old.classList.remove('active');
    nextSlide.classList.add('active');
    index = nextIndex;
    syncUI();
    warmNearbyImages(index);

    window.setTimeout(() => {
      old.classList.remove('leaving');
      lock = false;
    }, 620);
  }

  const next = () => go(index + 1);
  const prev = () => go(index - 1);

  $$('[data-next]').forEach(b => on(b, 'click', next));
  on($('#nextBtn'), 'click', next);
  on($('#prevBtn'), 'click', prev);
  on($('#homeBtn'), 'click', () => go(0));

  function setMode(asPresentation) {
    presentation = Boolean(asPresentation);
    document.body.classList.toggle('presentation-mode', presentation);
    document.body.classList.toggle('reading-mode', !presentation);
    const modeBtn = $('#modeBtn');
    if (modeBtn) modeBtn.textContent = presentation ? 'حالت مطالعه' : 'حالت ارائه';

    if (presentation) {
      slides.forEach((s, i) => s.classList.toggle('active', i === index));
      window.scrollTo(0, 0);
      warmNearbyImages(index);
    } else {
      slides.forEach(s => s.classList.add('active'));
      slides[index].scrollIntoView({ block: 'start' });
    }
    syncUI();
  }

  on($('#modeBtn'), 'click', () => setMode(!presentation));

  // Keep the current section indicator accurate in reading mode.
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      if (presentation) return;
      const hit = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!hit) return;
      const i = slides.indexOf(hit.target);
      if (i >= 0) { index = i; syncUI(); }
    }, { threshold: [.2, .45, .7] });
    slides.forEach(s => sectionObserver.observe(s));
  }

  // Keyboard navigation.
  on(document, 'keydown', e => {
    if ($('.source-modal.open')) {
      if (e.key === 'Escape') closeSources();
      return;
    }
    if (drawer?.classList.contains('open')) {
      if (e.key === 'Escape') closeDrawer();
      return;
    }
    if (e.key.toLowerCase() === 'p') { setMode(!presentation); return; }
    if (e.key.toLowerCase() === 'f') { toggleFullscreen(); return; }
    if (!presentation) return;

    const active = slides[index];
    const canScrollDown = active && active.scrollTop + active.clientHeight < active.scrollHeight - 12;
    const canScrollUp = active && active.scrollTop > 12;

    // Long explanatory slides can be scrolled with ↑/↓ before moving to the next page.
    if (e.key === 'ArrowDown' && canScrollDown) {
      e.preventDefault(); active.scrollBy({ top: Math.max(260, innerHeight * .42), behavior: 'smooth' }); return;
    }
    if (e.key === 'ArrowUp' && canScrollUp) {
      e.preventDefault(); active.scrollBy({ top: -Math.max(260, innerHeight * .42), behavior: 'smooth' }); return;
    }

    if (['PageDown', ' ', 'ArrowLeft', 'ArrowDown'].includes(e.key)) {
      e.preventDefault(); next();
    } else if (['PageUp', 'ArrowRight', 'ArrowUp'].includes(e.key)) {
      e.preventDefault(); prev();
    } else if (e.key === 'Home') {
      e.preventDefault(); go(0);
    } else if (e.key === 'End') {
      e.preventDefault(); go(slides.length - 1);
    }
  });

  // Swipe navigation. Vertical scroll inside a long slide remains untouched.
  let touchX = null;
  let touchY = null;
  on(document, 'touchstart', e => {
    if (!e.touches?.length) return;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });
  on(document, 'touchend', e => {
    if (!presentation || touchX === null || !e.changedTouches?.length) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? next() : prev();
    touchX = touchY = null;
  }, { passive: true });

  // Drawer.
  const drawer = $('#drawer');
  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  on($('#menuBtn'), 'click', openDrawer);
  on($('#drawerClose'), 'click', closeDrawer);

  // Sources modal.
  const sourceModal = $('#sourceModal');
  function openSources() {
    if (!sourceModal) return;
    sourceModal.classList.add('open');
    sourceModal.setAttribute('aria-hidden', 'false');
  }
  function closeSources() {
    if (!sourceModal) return;
    sourceModal.classList.remove('open');
    sourceModal.setAttribute('aria-hidden', 'true');
  }
  on($('#sourceBtn'), 'click', openSources);
  on($('#sourceClose'), 'click', closeSources);
  on(sourceModal, 'click', e => { if (e.target === sourceModal) closeSources(); });

  // Fullscreen.
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch?.(() => {});
    else document.exitFullscreen?.().catch?.(() => {});
  }
  on($('#presentBtn'), 'click', toggleFullscreen);

  // Interactive decision blocks that appear later in the workshop.
  $$('[data-decision]').forEach(b => on(b, 'click', () => {
    const good = b.dataset.decision === 'good';
    const out = $('#decisionFeedback');
    if (!out) return;
    out.className = `decision-feedback ${good ? 'good' : 'bad'}`;
    out.textContent = good
      ? '✓ امن‌تر: مسیر رسمی را خودت باز کن و درخواست را از کانال مستقل تأیید کن.'
      : '⚠ همین واکنش سریع چیزی است که مهاجم می‌خواهد. مکث و راستی‌آزمایی، بخشی از دفاع است.';
  }));

  // Strava explanation layers.
  const layers = {
    route: 'یک مسیر به‌تنهایی ممکن است بی‌اهمیت باشد؛ ارزش اطلاعاتی وقتی بالا می‌رود که مسیرها تکرار شوند.',
    repeat: 'تکرار می‌تواند ورودی‌ها، محدوده‌های پرتردد یا مسیرهای ثابت را برجسته کند؛ حتی اگر کسی نام مکان را ننوشته باشد.',
    identity: 'اگر پروفایل فعالیت عمومی باشد، یک الگوی مکانی ممکن است به فرد واقعی و حساب‌های دیگرش وصل شود.',
    time: 'زمان ثبت فعالیت‌ها ممکن است الگوی حضور، تغییر شیفت یا دوره‌های نبودن را آشکار کند.'
  };
  $$('.layer').forEach(b => on(b, 'click', () => {
    $$('.layer').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const explain = $('#layerExplain');
    if (explain) explain.textContent = layers[b.dataset.layer] || '';
  }));

  // Metadata demo.
  on($('#metaBtn'), 'click', e => {
    const panel = $('#metaPanel');
    if (!panel) return;
    panel.classList.toggle('unlocked');
    e.currentTarget.textContent = panel.classList.contains('unlocked') ? 'پنهان‌کردن اطلاعات' : 'نمایش اطلاعات فایل';
  });

  // Final checklist.
  on($('#checkBtn'), 'click', () => {
    const checks = $$('#finalChecklist input');
    const out = $('#checkResult');
    if (!out || !checks.length) return;
    const count = checks.filter(x => x.checked).length;
    if (count === checks.length) {
      out.textContent = '✓ هر پنج کنترل مرور شد. حالا تصمیم آگاهانه‌تر است.';
      out.style.color = 'var(--green)';
    } else if (count >= 3) {
      out.textContent = '△ چند کنترل باقی مانده؛ قبل از اقدام کاملشان کن.';
      out.style.color = 'var(--amber)';
    } else {
      out.textContent = '⚠ هنوز برای یک تصمیم پرریسک، راستی‌آزمایی کافی انجام نشده.';
      out.style.color = 'var(--red)';
    }
  });

  // Image reliability: retry once, then replace the broken frame with an explanatory fallback.
  function makeFallback(img) {
    if (!img || img.dataset.failed) return;
    img.dataset.failed = '1';
    const wrap = img.parentElement;
    if (!wrap) return;
    img.remove();
    const div = document.createElement('div');
    div.className = 'image-fallback';
    div.innerHTML = '<div><b>تصویر منبع از این شبکه بارگذاری نشد.</b><span>متن پرونده و لینک منبع همچنان در همین اسلاید در دسترس است.</span></div>';
    wrap.prepend(div);
  }

  function attachImageHandling(img) {
    if (!img || img.dataset.bound) return;
    img.dataset.bound = '1';
    on(img, 'error', () => {
      if (!img.dataset.retry) {
        img.dataset.retry = '1';
        const src = img.src;
        window.setTimeout(() => { img.src = ''; img.src = src; }, 450);
      } else {
        makeFallback(img);
      }
    });
  }

  $$('img').forEach(attachImageHandling);

  // Matrix — subtle decorative background; automatically disabled for reduced-motion users.
  const canvas = $('#matrix');
  if (canvas?.getContext && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const ctx = canvas.getContext('2d');
    let drops = [];
    let cols = 0;
    const chars = '01OSINTOPSECAUTHVERIFYDATA';

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(innerWidth / 28);
      drops = Array(cols).fill(0).map(() => Math.random() * -50);
    }

    function draw() {
      ctx.fillStyle = 'rgba(7,10,15,.085)';
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      ctx.fillStyle = 'rgba(85,229,223,.34)';
      ctx.font = '11px monospace';
      drops.forEach((y, i) => {
        const ch = chars[(Math.random() * chars.length) | 0];
        ctx.fillText(ch, i * 28, y * 18);
        if (y * 18 > innerHeight && Math.random() > .987) drops[i] = 0;
        else drops[i] += .28;
      });
      requestAnimationFrame(draw);
    }

    resize();
    on(window, 'resize', resize);
    draw();
  }

  // Load a valid slide hash without leaving two slides active.
  const hash = decodeURIComponent(location.hash.replace('#', ''));
  const hashIndex = slides.findIndex(s => s.id === hash);
  if (hashIndex >= 0) {
    slides.forEach(s => s.classList.remove('active'));
    index = hashIndex;
    slides[index].classList.add('active');
  } else {
    slides.forEach((s, i) => s.classList.toggle('active', i === index));
  }

  syncUI();
  warmNearbyImages(index);

  // Cache the local shell when hosted on HTTPS / localhost. Remote evidence images remain source-hosted.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();

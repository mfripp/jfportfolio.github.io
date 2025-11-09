var toggleTheme = function () {
  document.body.classList.toggle('dark');
  localStorage.setItem('dark-theme', document.body.classList.contains('dark'));
};

(function () {
  const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const gallery = document.getElementById('works');
  if (!gallery) return;

  /* turn off main-page scrolling when a lightroom is open */
  let pageScrollY = 0;

  function lockPageScroll() {
    pageScrollY = window.scrollY || 0;
    document.documentElement.classList.add('no-scroll');
    document.body.classList.add('no-scroll');

    /* Robust iOS lock: fix the body in place */
    document.body.style.position = 'fixed';
    document.body.style.top = `-${pageScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlockPageScroll() {
    document.documentElement.classList.remove('no-scroll');
    document.body.classList.remove('no-scroll');

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';

    window.scrollTo(0, pageScrollY);
  }

  // Track which image-card is currently enlarged and its index among viewable images.
  let currentIndex = null;
  let zoom = 1;

  // NodeList of IMG elements that are *enlargeable* (i.e., real images, not inside a media link).
  function getViewableImages() {
    return Array.from(gallery.querySelectorAll('.image-card img')).filter(
      (img) => !img.closest('a.media-link')   // ignore PDFs/videos wrapped in links
        && !img.closest('div.popup')          // ignore images inside <div class="popup">
    );
  }
  // Find the inner container that gets the .lightroom class in your template
  function getInnerContainerFromTarget(t) {
    // Original structure: .image-card > div > <img> ...
    const card = t.closest && t.closest('.image-card');
    if (!card) return null;
    // The "inner" div is the first div inside .image-card
    const inner = card.querySelector(':scope > div');
    return inner || null;
  }

  function getCardFromTarget(t) {
    return t.closest && t.closest('.image-card');
  }

  function isOpen() {
    return document.querySelector('.image-card.lightroom') != null;
  }

  function openAtIndex(idx) {
    const imgs = getViewableImages();
    if (idx < 0 || idx >= imgs.length) return;
    // Clear any existing open card
    closeLightroom();

    const img = imgs[idx];
    const card = getCardFromTarget(img);
    if (!card) return;
    card.classList.add('lightroom');
    currentIndex = idx;
    zoom = 1;
    applyZoom();
    ensureUI();
    updateUIState();
    lockPageScroll();
  }

  function closeLightroom() {
    const open = document.querySelector('.image-card.lightroom');
    if (open) open.classList.remove('lightroom');
    zoom = 1;
    applyZoom();
    currentIndex = null;
    hideUI();
    unlockPageScroll();
  }

  function applyZoom() {
    const img = currentImageEl();
    if (!img) return;

    // On touch devices, let the browser handle pinch zoom; don't transform.
    if (isTouch) { img.style.transform = ''; img.style.transformOrigin = ''; return; }
    img.style.transformOrigin = 'center center';
    img.style.transform = `scale(${zoom})`;
    img.style.transition = 'transform 120ms ease';
    const card = getCardFromTarget(img);
    if (card) {
      card.style.overflow = zoom > 1 ? 'auto' : '';
      card.style.cursor = zoom > 1 ? 'zoom-out' : '';
    }
  }

  function currentImageEl() {
    if (currentIndex == null) return null;
    const imgs = getViewableImages();
    return imgs[currentIndex] || null;
  }

  function nextImage() {
    const imgs = getViewableImages();
    if (!imgs.length) return;
    const next = (currentIndex + 1) % imgs.length;
    openAtIndex(next);
  }

  function prevImage() {
    const imgs = getViewableImages();
    if (!imgs.length) return;
    const prev = (currentIndex - 1 + imgs.length) % imgs.length;
    openAtIndex(prev);
  }

  // === UI (overlay controls) ===
  let uiRoot = null;
  function ensureUI() {
    if (uiRoot) { uiRoot.style.display = ''; return; }

    uiRoot = document.createElement('div');
    uiRoot.id = 'lr-ui';
    uiRoot.style.position = 'fixed';
    uiRoot.style.inset = '0';
    uiRoot.style.pointerEvents = 'none'; // buttons re-enable
    uiRoot.style.display = 'flex';
    uiRoot.style.alignItems = 'center';
    uiRoot.style.justifyContent = 'space-between';

    // Button factory
    function mkBtn(label, title, onClick) {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title;
      b.style.pointerEvents = 'auto';
      b.style.fontSize = '14px';
      b.style.padding = '8px 10px';
      b.style.margin = '8px';
      b.style.background = 'rgba(0,0,0,.5)';
      b.style.color = '#fff';
      b.style.border = 'none';
      b.style.borderRadius = '6px';
      b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
      return b;
    }

    // Left/right containers
    const leftCol = document.createElement('div');
    leftCol.style.display = 'flex';
    leftCol.style.flexDirection = 'column';
    leftCol.style.alignItems = 'flex-start';

    const rightCol = document.createElement('div');
    rightCol.style.display = 'flex';
    rightCol.style.flexDirection = 'column';
    rightCol.style.alignItems = 'flex-end';

    // Prev / Next (desktop)
    const prevBtn = mkBtn('←', 'Previous (←)', prevImage);
    const nextBtn = mkBtn('→', 'Next (→)', nextImage);

    // Create a dedicated, fixed top-right layer for Close
    const closeBtn = mkBtn('✕', 'Close (Esc)', closeLightroom);
    const closeArea = document.createElement('div');
    closeArea.id = 'lr-close-area';
    closeBtn.style.pointerEvents = 'auto';
    closeArea.appendChild(closeBtn);

    // Zoom controls (desktop only)
    let zoomRow = null;
    if (!isTouch) {
      const zoomInBtn = mkBtn('+', 'Zoom in (+)', () => { zoom = Math.min(zoom * 1.25, 8); applyZoom(); });
      const zoomOutBtn = mkBtn('−', 'Zoom out (−)', () => { zoom = Math.max(zoom / 1.25, 1); applyZoom(); });
      // const zoomResetBtn = mkBtn('⤾', 'Reset zoom (0)', () => { zoom = 1; applyZoom(); });

      zoomRow = document.createElement('div');
      zoomRow.style.display = 'flex';
      zoomRow.appendChild(zoomOutBtn);
      // zoomRow.appendChild(zoomResetBtn);
      zoomRow.appendChild(zoomInBtn);
    }

    const navRow = document.createElement('div');
    navRow.style.display = 'flex';
    navRow.appendChild(nextBtn);
    leftCol.appendChild(prevBtn);
    if (zoomRow) rightCol.appendChild(zoomRow);
    rightCol.appendChild(navRow);

    uiRoot.appendChild(leftCol);
    uiRoot.appendChild(rightCol);
    uiRoot.appendChild(closeArea);
    document.body.appendChild(uiRoot);
  }

  function hideUI() { if (uiRoot) uiRoot.style.display = 'none'; }
  function updateUIState() { /* placeholder if you later want per-image state */ }

  // === CLICK HANDLER (open/close) ===
  function onGalleryClick(event) {
    // Ignore clicks on media links (PDF/MOV) so they open normally
    if (event.target.closest && event.target.closest('.media-link')) return; // PDFs/videos
    const card = getCardFromTarget(event.target);
    if (!card) return;

    const imgs = getViewableImages();
    const clickedImg = event.target.tagName === 'IMG' ? event.target : card.querySelector('img');
    const alreadyOpen = card.classList.contains('lightroom');

    if (!alreadyOpen) {
      // Open the clicked card
      const idx = imgs.indexOf(clickedImg);
      if (idx !== -1) openAtIndex(idx);
    } else {
      if (event.target.tagName === 'IMG' || event.target === card) {
        closeLightroom();
      }
    }
  }

  function onGalleryClickVideo(e) {
    const link = e.target.closest && e.target.closest('.media-link[data-kind="video"]');
    if (!link) return;
    e.preventDefault();

    // Close any open image enlargement
    closeLightroom();

    // Create a simple full-viewport overlay for the video
    const ov = document.createElement('div');
    ov.id = 'video-overlay';
    Object.assign(ov.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,.9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002
    });

    const vid = document.createElement('video');
    vid.controls = true;
    vid.autoplay = true;
    vid.style.maxWidth = '90vw';
    vid.style.maxHeight = '90vh';

    // Provide both sources if you created WebM too
    const srcMp4 = document.createElement('source');
    srcMp4.src = link.getAttribute('href');
    srcMp4.type = 'video/mp4';
    vid.appendChild(srcMp4);

    // Optional webm fallback:
    // const srcWebm = document.createElement('source');
    // srcWebm.src = link.getAttribute('href').replace(/\.mp4$/, '.webm');
    // srcWebm.type = 'video/webm';
    // vid.appendChild(srcWebm);

    ov.appendChild(vid);

    // Click outside video or press Esc to close
    ov.addEventListener('click', (ev) => { if (ev.target === ov) document.body.removeChild(ov); });
    document.addEventListener('keydown', function onEsc(ev) {
      if (ev.key === 'Escape') { document.removeChild(ov); document.removeEventListener('keydown', onEsc); }
    });

    document.body.appendChild(ov);
  };



  // === KEYBOARD: Esc, arrows, + / - / 0 ===
  function onKeydown(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); closeLightroom(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); nextImage(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevImage(); return; }
    if (isTouch) return; // no keyboard zoom on touch devices
    if (e.key === '+') { e.preventDefault(); zoom = Math.min(zoom * 1.25, 8); applyZoom(); return; }
    if (e.key === '-') { e.preventDefault(); zoom = Math.max(zoom / 1.25, 1); applyZoom(); return; }
    if (e.key === '0') { e.preventDefault(); zoom = 1; applyZoom(); return; }
  }

  // === SWIPE (mobile) ===
  let touchStartX = null, touchStartY = null, touchTime = 0, pinchActive = false;

  function onTouchStart(e) {
    if (!isOpen()) return;
    if (e.touches && e.touches.length > 1) { pinchActive = true; return; }
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    touchStartX = t.clientX; touchStartY = t.clientY; touchTime = Date.now();
  }

  function onTouchEnd(e) {
    if (!isOpen()) return;
    if (pinchActive) { pinchActive = false; return; }
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = Date.now() - touchTime;
    const isSwipe = Math.abs(dx) > 40 && Math.abs(dy) < 60 && dt < 600;
    if (isSwipe) { if (dx < 0) nextImage(); else prevImage(); }
  }

  // Wire up
  gallery.addEventListener('click', onGalleryClick);
  // optional embedded video display, but it makes it hard to go back to
  // main page (have to click outside the video)
  // gallery.addEventListener('click', onGalleryClickVideo);
  document.addEventListener('keydown', onKeydown, { passive: false });
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });

  // Persist theme (unchanged)
  if (JSON.parse(localStorage.getItem('dark-theme'))) {
    document.body.classList.add('dark');
  }

  // Theme toggle (unchanged)
  const tt = document.getElementById('theme-toggle');
  if (tt) tt.addEventListener('click', toggleTheme);
})();
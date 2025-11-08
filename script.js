// === THEME (unchanged) ===
var toggleTheme = function () {
  document.body.classList.toggle('dark');
  localStorage.setItem('dark-theme', document.body.classList.contains('dark'));
};

// === GALLERY ENHANCEMENTS ===
(function () {
  const gallery = document.getElementById('works');
  if (!gallery) return;

  // Track which image-card is currently enlarged and its index among viewable images.
  let currentIndex = null;
  let zoom = 1;

  // NodeList of IMG elements that are *enlargeable* (i.e., real images, not inside a media link).
  function getViewableImages() {
    return Array.from(gallery.querySelectorAll('.image-card img')).filter(
      (img) => !img.closest('a.media-link') // ignore PDFs/MOV thumbnails wrapped in links
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

  function isOpen() {
    return document.querySelector('.image-card .lightroom') != null;
  }

  function openAtIndex(idx) {
    const imgs = getViewableImages();
    if (idx < 0 || idx >= imgs.length) return;
    // Clear any existing open card
    closeLightroom();

    const img = imgs[idx];
    const inner = getInnerContainerFromTarget(img);
    if (!inner) return;
    inner.classList.add('lightroom');
    currentIndex = idx;
    zoom = 1;
    applyZoom();
    ensureUI();
    updateUIState();
  }

  function closeLightroom() {
    const open = document.querySelector('.image-card .lightroom');
    if (open) open.classList.remove('lightroom');
    currentIndex = null;
    zoom = 1;
    applyZoom();
    hideUI();
  }

  function applyZoom() {
    const img = currentImageEl();
    if (!img) return;
    // Scale around the center; keep it simple and reversible
    img.style.transformOrigin = 'center center';
    img.style.transform = `scale(${zoom})`;
    img.style.transition = 'transform 120ms ease';
    // Prevent layout shifts by containing the image
    const inner = getInnerContainerFromTarget(img);
    if (inner) {
      inner.style.overflow = zoom > 1 ? 'auto' : '';
      inner.style.cursor = zoom > 1 ? 'zoom-out' : '';
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

    // Zoom controls (desktop)
    const zoomInBtn = mkBtn('+', 'Zoom in (+)', () => { zoom = Math.min(zoom * 1.25, 8); applyZoom(); });
    const zoomOutBtn = mkBtn('−', 'Zoom out (−)', () => { zoom = Math.max(zoom / 1.25, 1); applyZoom(); });
    const zoomResetBtn = mkBtn('⤾', 'Reset zoom (0)', () => { zoom = 1; applyZoom(); });

    // Close
    const closeBtn = mkBtn('✕', 'Close (Esc)', closeLightroom);

    leftCol.appendChild(prevBtn);

    // Right column: zoom controls stacked above next/close
    const zoomRow = document.createElement('div');
    zoomRow.style.display = 'flex';
    zoomRow.appendChild(zoomOutBtn);
    zoomRow.appendChild(zoomResetBtn);
    zoomRow.appendChild(zoomInBtn);

    const navRow = document.createElement('div');
    navRow.style.display = 'flex';
    navRow.appendChild(nextBtn);
    navRow.appendChild(closeBtn);

    rightCol.appendChild(zoomRow);
    rightCol.appendChild(navRow);

    uiRoot.appendChild(leftCol);
    uiRoot.appendChild(rightCol);
    document.body.appendChild(uiRoot);
  }

  function hideUI() { if (uiRoot) uiRoot.style.display = 'none'; }
  function updateUIState() { /* placeholder if you later want per-image state */ }

  // === CLICK HANDLER (open/close) ===
  function onGalleryClick(event) {
    // Ignore clicks on media links (PDF/MOV) so they open normally
    if (event.target.closest && event.target.closest('.media-link')) return;

    const inner = getInnerContainerFromTarget(event.target);
    if (!inner) return;

    const imgs = getViewableImages();
    const clickedImg = event.target.tagName === 'IMG' ? event.target : inner.querySelector('img');

    const alreadyOpen = inner.classList.contains('lightroom');

    if (!alreadyOpen) {
      // Open the clicked card
      const idx = imgs.indexOf(clickedImg);
      if (idx !== -1) openAtIndex(idx);
    } else {
      // NEW: clicking the enlarged image closes; clicking background also closes
      if (event.target.tagName === 'IMG' || event.target === inner) {
        closeLightroom();
      }
    }
  }

  // === KEYBOARD: Esc, arrows, + / - / 0 ===
  function onKeydown(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); closeLightroom(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); nextImage(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevImage(); return; }
    if (e.key === '+') { e.preventDefault(); zoom = Math.min(zoom * 1.25, 8); applyZoom(); return; }
    if (e.key === '-') { e.preventDefault(); zoom = Math.max(zoom / 1.25, 1); applyZoom(); return; }
    if (e.key === '0') { e.preventDefault(); zoom = 1; applyZoom(); return; }
  }

  // === SWIPE (mobile) ===
  let touchStartX = null, touchStartY = null, touchTime = 0;
  function onTouchStart(e) {
    if (!isOpen()) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    touchStartX = t.clientX; touchStartY = t.clientY; touchTime = Date.now();
  }
  function onTouchEnd(e) {
    if (!isOpen()) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = Date.now() - touchTime;
    const isSwipe = Math.abs(dx) > 40 && Math.abs(dy) < 60 && dt < 600;
    if (isSwipe) {
      if (dx < 0) nextImage();
      else prevImage();
    }
  }

  // Wire up
  gallery.addEventListener('click', onGalleryClick);
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
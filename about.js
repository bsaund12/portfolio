const RECENTLY_PLAYED_ENDPOINT = 'https://portfolio-now-playing-api.vercel.app/api/recently-played';
const REQUEST_TIMEOUT_MS = 8000;
const AUTO_ADVANCE_MS = 4500;

const showcase = document.querySelector('[data-album-showcase]');

if (showcase) {
  const statusElement = showcase.querySelector('[data-album-status]');
  const viewport = showcase.querySelector('[data-album-viewport]');
  const track = showcase.querySelector('[data-album-track]');
  const previousButton = showcase.querySelector('[data-album-prev]');
  const nextButton = showcase.querySelector('[data-album-next]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let autoAdvanceTimer = null;
  let autoDirection = 1;
  let isVisible = false;
  let isUserInteracting = false;
  let scrollUpdateFrame = null;

  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

  const isHttpsUrl = (value) => {
    if (!hasText(value)) return false;

    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isSpotifyAlbumUrl = (value) => {
    if (!hasText(value)) return false;

    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'open.spotify.com' && url.pathname.startsWith('/album/');
    } catch {
      return false;
    }
  };

  const setStatus = (message) => {
    if (statusElement) statusElement.textContent = message;
  };

  const setButtonsDisabled = (disabled) => {
    if (previousButton) previousButton.disabled = disabled;
    if (nextButton) nextButton.disabled = disabled;
  };

  const getScrollStep = () => {
    const firstCard = track?.querySelector('.about-album-card');

    if (!firstCard || !viewport) return 0;

    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;

    return firstCard.getBoundingClientRect().width + gap;
  };

  const getMaxScroll = () => {
    if (!viewport) return 0;

    return Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  };

  const updateButtons = () => {
    if (!viewport || !previousButton || !nextButton) return;

    const maxScroll = getMaxScroll();
    const hasOverflow = maxScroll > 2;

    previousButton.disabled = !hasOverflow || viewport.scrollLeft <= 2;
    nextButton.disabled = !hasOverflow || viewport.scrollLeft >= maxScroll - 2;
  };

  const updateAutoAdvance = () => {
    window.clearInterval(autoAdvanceTimer);
    autoAdvanceTimer = null;

    if (reduceMotion || isUserInteracting || document.hidden || !isVisible || getMaxScroll() <= 2) {
      return;
    }

    autoAdvanceTimer = window.setInterval(() => {
      const maxScroll = getMaxScroll();

      if (!viewport || maxScroll <= 2) return;

      if (viewport.scrollLeft >= maxScroll - 2) {
        autoDirection = -1;
      } else if (viewport.scrollLeft <= 2) {
        autoDirection = 1;
      }

      moveByCard(autoDirection);
    }, AUTO_ADVANCE_MS);
  };

  const requestButtonUpdate = () => {
    if (scrollUpdateFrame) return;

    scrollUpdateFrame = window.requestAnimationFrame(() => {
      scrollUpdateFrame = null;
      updateButtons();
    });
  };

  const moveByCard = (direction) => {
    if (!viewport) return;

    const step = getScrollStep();
    if (!step) return;

    viewport.scrollBy({
      left: step * direction,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  const setUserInteracting = (isInteracting) => {
    isUserInteracting = isInteracting;
    updateAutoAdvance();
  };

  const normalizeItems = (items) => items
    .filter((item) => (
      item &&
      hasText(item.album) &&
      isHttpsUrl(item.albumArt)
    ))
    .map((item) => ({
      title: hasText(item.title) ? item.title.trim() : '',
      artist: hasText(item.artist) ? item.artist.trim() : 'Unknown artist',
      album: item.album.trim(),
      albumArt: item.albumArt.trim(),
      albumUrl: isSpotifyAlbumUrl(item.albumUrl) ? item.albumUrl.trim() : '',
    }));

  const createAlbumCard = (item) => {
    const element = item.albumUrl ? document.createElement('a') : document.createElement('article');
    element.className = 'about-album-card';
    element.setAttribute('role', 'listitem');

    if (item.albumUrl) {
      element.href = item.albumUrl;
      element.target = '_blank';
      element.rel = 'noopener noreferrer';
    }

    const image = document.createElement('img');
    image.src = item.albumArt;
    image.alt = `Album cover for ${item.album} by ${item.artist}`;
    image.loading = 'lazy';
    image.decoding = 'async';

    const caption = document.createElement('span');
    caption.className = 'about-album-caption';

    const album = document.createElement('span');
    album.className = 'about-album-name';
    album.textContent = item.album;

    const artist = document.createElement('span');
    artist.className = 'about-album-artist';
    artist.textContent = item.artist;

    caption.append(album, artist);

    if (hasText(item.title)) {
      const title = document.createElement('span');
      title.className = 'about-album-track-title';
      title.textContent = item.title;
      caption.append(title);
    }

    element.append(image, caption);

    return element;
  };

  const renderAlbums = (items) => {
    const validItems = normalizeItems(items);

    if (!track) return;

    track.replaceChildren();

    if (validItems.length === 0) {
      setStatus('No recent listening history is available right now.');
      setButtonsDisabled(true);
      updateAutoAdvance();
      return;
    }

    const cards = validItems.map(createAlbumCard);
    track.append(...cards);
    setStatus('');

    window.requestAnimationFrame(() => {
      updateButtons();
      updateAutoAdvance();
    });
  };

  const loadAlbums = async () => {
    setStatus('Loading recent albums…');
    setButtonsDisabled(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(RECENTLY_PLAYED_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Recently played request failed');
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.items)) {
        throw new Error('Recently played response was malformed');
      }

      renderAlbums(data.items);
    } catch {
      if (track) track.replaceChildren();
      setStatus('The listening showcase is unavailable right now.');
      setButtonsDisabled(true);
      updateAutoAdvance();
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  previousButton?.addEventListener('click', () => moveByCard(-1));
  nextButton?.addEventListener('click', () => moveByCard(1));
  viewport?.addEventListener('scroll', requestButtonUpdate, { passive: true });
  showcase.addEventListener('pointerenter', () => setUserInteracting(true));
  showcase.addEventListener('pointerleave', () => setUserInteracting(false));
  showcase.addEventListener('focusin', () => setUserInteracting(true));
  showcase.addEventListener('focusout', (event) => {
    if (!showcase.contains(event.relatedTarget)) {
      setUserInteracting(false);
    }
  });
  showcase.addEventListener('touchstart', () => setUserInteracting(true), { passive: true });
  showcase.addEventListener('touchend', () => setUserInteracting(false), { passive: true });
  showcase.addEventListener('touchcancel', () => setUserInteracting(false), { passive: true });
  document.addEventListener('visibilitychange', updateAutoAdvance);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries.some((entry) => entry.isIntersecting);
        updateAutoAdvance();
      },
      {
        threshold: 0.35,
      }
    );

    observer.observe(showcase);
  } else {
    isVisible = true;
  }

  loadAlbums();
}

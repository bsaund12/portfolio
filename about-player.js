(() => {
  const NOW_PLAYING_ENDPOINT = 'https://portfolio-now-playing-api.vercel.app/api/now-playing';
  const REQUEST_TIMEOUT_MS = 8000;

  if (!document.body.classList.contains('about-page')) return;

  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

  const isHttpsUrl = (value) => {
    if (!hasText(value)) return false;

    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isSpotifyTrackUrl = (value) => {
    if (!hasText(value)) return false;

    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'open.spotify.com' && url.pathname.startsWith('/track/');
    } catch {
      return false;
    }
  };

  const player = document.createElement('aside');
  player.className = 'about-now-playing';
  player.setAttribute('aria-label', 'Spotify listening activity');

  player.innerHTML = `
    <div class="about-now-playing-shell">
      <a
        class="about-now-playing-link"
        data-about-player-link
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the current track in Spotify"
      >
        <span class="about-now-playing-art-wrap" aria-hidden="true">
          <img class="about-now-playing-art" data-about-player-art alt="" />
        </span>

        <span class="about-now-playing-copy">
          <span class="about-now-playing-status">
            <span class="about-now-playing-bars" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
            <span data-about-player-status>Listening now</span>
          </span>
          <strong class="about-now-playing-title" data-about-player-title></strong>
          <span class="about-now-playing-artist" data-about-player-artist></span>
          <span class="about-now-playing-album" data-about-player-album></span>
        </span>
      </a>

      <button
        class="about-now-playing-toggle"
        type="button"
        aria-label="Minimize music player"
        aria-expanded="true"
        data-about-player-toggle
      >
        <span aria-hidden="true" data-about-player-toggle-icon>−</span>
      </button>
    </div>
  `;

  document.body.append(player);

  const link = player.querySelector('[data-about-player-link]');
  const art = player.querySelector('[data-about-player-art]');
  const status = player.querySelector('[data-about-player-status]');
  const title = player.querySelector('[data-about-player-title]');
  const artist = player.querySelector('[data-about-player-artist]');
  const album = player.querySelector('[data-about-player-album]');
  const toggle = player.querySelector('[data-about-player-toggle]');
  const toggleIcon = player.querySelector('[data-about-player-toggle-icon]');

  const setCollapsed = (collapsed) => {
    player.classList.toggle('is-collapsed', collapsed);
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    toggle?.setAttribute('aria-label', collapsed ? 'Expand music player' : 'Minimize music player');

    if (toggleIcon) {
      toggleIcon.textContent = collapsed ? '♫' : '−';
    }
  };

  toggle?.addEventListener('click', () => {
    setCollapsed(!player.classList.contains('is-collapsed'));
  });

  const renderTrack = (data) => {
    if (
      !data ||
      !hasText(data.title) ||
      !hasText(data.artist) ||
      !isHttpsUrl(data.albumArt)
    ) {
      return false;
    }

    if (art) {
      art.src = data.albumArt.trim();
      art.alt = `Album cover for ${hasText(data.album) ? data.album.trim() : data.title.trim()}`;
    }

    if (status) {
      status.textContent = data.isPlaying ? 'Listening now' : 'Recently played';
    }

    if (title) title.textContent = data.title.trim();
    if (artist) artist.textContent = data.artist.trim();

    if (album) {
      album.textContent = hasText(data.album) ? data.album.trim() : '';
      album.hidden = !hasText(data.album);
    }

    if (link) {
      if (isSpotifyTrackUrl(data.spotifyUrl)) {
        link.href = data.spotifyUrl.trim();
      } else {
        link.removeAttribute('href');
        link.removeAttribute('target');
        link.removeAttribute('aria-label');
      }
    }

    player.classList.toggle('is-playing', Boolean(data.isPlaying));
    player.classList.add('is-ready');
    return true;
  };

  const loadNowPlaying = async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(NOW_PLAYING_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Now-playing request failed');
      }

      const data = await response.json();
      renderTrack(data);
    } catch {
      player.remove();
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  loadNowPlaying();
})();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Smooth scroll for same-page section links.
document.querySelectorAll('[data-scroll], a[href^="#"]').forEach((el) => {
  el.addEventListener('click', (e) => {
    const targetSelector = el.getAttribute('data-scroll') || el.getAttribute('href');
    if (!targetSelector || targetSelector === '#') return;

    const targetId = targetSelector.startsWith('#') ? targetSelector.slice(1) : targetSelector;
    const target = document.getElementById(decodeURIComponent(targetId));
    if (!target) return;

    e.preventDefault();

    const header = document.querySelector('.site-header');
    const headerOffset = header ? header.getBoundingClientRect().height : 0;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset - 16;

    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: reduceMotion ? 'auto' : 'smooth'
    });

    history.pushState(null, '', `#${target.id}`);
  });
});

// Scroll reveal using IntersectionObserver
const revealElements = document.querySelectorAll('.reveal');

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealElements.forEach((el) => el.classList.add('visible'));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // animate once
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15
    }
  );

  revealElements.forEach((el) => observer.observe(el));
}

// Floating music mini-player
const musicPlayer = document.querySelector('.music-player');
const musicPlayerToggle = document.querySelector('.music-player-toggle');
const musicPlayerClose = document.querySelector('.music-player-close');
const spotifyNowPlayingEndpoint = 'https://portfolio-now-playing-api.vercel.app/api/now-playing';
const spotifyPollIntervalMs = 60000;

if (musicPlayer && musicPlayerToggle && musicPlayerClose && !window.__portfolioMusicPlayerInitialized) {
  window.__portfolioMusicPlayerInitialized = true;

  const setMusicPlayerExpanded = (isExpanded) => {
    musicPlayer.classList.toggle('is-expanded', isExpanded);
    musicPlayerToggle.setAttribute('aria-expanded', String(isExpanded));

    if (isExpanded) {
      musicPlayerClose.focus();
    } else {
      musicPlayerToggle.focus();
    }
  };

  musicPlayerToggle.addEventListener('click', () => setMusicPlayerExpanded(true));
  musicPlayerClose.addEventListener('click', () => setMusicPlayerExpanded(false));

  const compactTitle = musicPlayer.querySelector('[data-spotify-title="compact"]');
  const compactMeta = musicPlayer.querySelector('[data-spotify-meta="compact"]');
  const compactStatus = musicPlayer.querySelector('[data-spotify-status="compact"]');
  const expandedTitle = musicPlayer.querySelector('[data-spotify-title="expanded"]');
  const expandedMeta = musicPlayer.querySelector('[data-spotify-meta="expanded"]');
  const statusHeading = musicPlayer.querySelector('[data-spotify-status-heading]');
  const statusText = musicPlayer.querySelector('[data-spotify-status]');
  const spotifyLink = musicPlayer.querySelector('[data-spotify-link]');
  const albumArtImages = musicPlayer.querySelectorAll('[data-spotify-album-art]');

  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

  const isValidSpotifyUrl = (value) => {
    if (!hasText(value)) return false;

    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'open.spotify.com';
    } catch {
      return false;
    }
  };

  const hideSpotifyLink = () => {
    if (!spotifyLink) return;

    spotifyLink.classList.add('is-hidden');
    spotifyLink.removeAttribute('href');
  };

  const updateAlbumArt = ({ albumArt, title, artist }) => {
    albumArtImages.forEach((image) => {
      const altText = `Album artwork for ${title} by ${artist}`;
      image.alt = altText;

      if (hasText(albumArt)) {
        image.src = albumArt;
      } else {
        image.removeAttribute('src');
      }
    });
  };

  const renderFallback = () => {
    musicPlayer.classList.remove('is-playing');

    if (compactTitle) compactTitle.textContent = 'Spotify unavailable';
    if (compactMeta) compactMeta.textContent = 'Check back soon';
    if (compactStatus) compactStatus.textContent = 'Music Unavailable';
    if (statusHeading) statusHeading.textContent = 'Music Unavailable';
    if (statusText) statusText.textContent = 'Spotify connection unavailable';

    hideSpotifyLink();
  };

  const renderSpotifyTrack = (track) => {
    const title = hasText(track.title) ? track.title.trim() : 'Untitled track';
    const artist = hasText(track.artist) ? track.artist.trim() : 'Unknown artist';
    const album = hasText(track.album) ? track.album.trim() : 'Unknown album';
    const status = track.isPlaying ? 'Currently Listening' : 'Recently Played';

    musicPlayer.classList.toggle('is-playing', Boolean(track.isPlaying));

    if (compactTitle) compactTitle.textContent = title;
    if (compactMeta) compactMeta.textContent = `${artist} · ${album}`;
    if (compactStatus) compactStatus.textContent = status;
    if (expandedTitle) expandedTitle.textContent = title;
    if (expandedMeta) expandedMeta.textContent = `${artist} · ${album}`;
    if (statusHeading) statusHeading.textContent = status;
    if (statusText) statusText.textContent = status;

    updateAlbumArt({
      albumArt: track.albumArt,
      title,
      artist
    });

    if (isValidSpotifyUrl(track.spotifyUrl)) {
      spotifyLink.href = track.spotifyUrl;
      spotifyLink.classList.remove('is-hidden');
    } else {
      hideSpotifyLink();
    }
  };

  const loadSpotifyTrack = async () => {
    try {
      const response = await fetch(spotifyNowPlayingEndpoint, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Spotify request failed');
      }

      const track = await response.json();

      if (!track || !hasText(track.title) || !hasText(track.artist)) {
        throw new Error('Spotify response was incomplete');
      }

      renderSpotifyTrack(track);
    } catch {
      renderFallback();
    }
  };

  loadSpotifyTrack();

  if (!window.__portfolioSpotifyPlayerInterval) {
    window.__portfolioSpotifyPlayerInterval = window.setInterval(loadSpotifyTrack, spotifyPollIntervalMs);
  }
}

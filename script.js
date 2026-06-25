const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Subtle ambient dust layer.
const dustCanvas = document.querySelector('.ambient-dust');

if (dustCanvas && !reduceMotion) {
  const ctx = dustCanvas.getContext('2d');
  const particles = [];
  const particleCount = 58;
  let width = 0;
  let height = 0;
  let animationFrameId;

  const resizeDustCanvas = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    dustCanvas.width = Math.floor(width * pixelRatio);
    dustCanvas.height = Math.floor(height * pixelRatio);
    dustCanvas.style.width = `${width}px`;
    dustCanvas.style.height = `${height}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const createParticle = () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 1.4 + 0.35,
    speedX: (Math.random() - 0.5) * 0.08,
    speedY: Math.random() * 0.12 + 0.025,
    alpha: Math.random() * 0.28 + 0.08
  });

  const seedParticles = () => {
    particles.length = 0;

    for (let i = 0; i < particleCount; i += 1) {
      particles.push(createParticle());
    }
  };

  const drawDust = () => {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((particle) => {
      particle.x += particle.speedX;
      particle.y += particle.speedY;

      if (particle.y > height + 8) particle.y = -8;
      if (particle.x < -8) particle.x = width + 8;
      if (particle.x > width + 8) particle.x = -8;

      ctx.beginPath();
      ctx.fillStyle = `rgba(245, 242, 234, ${particle.alpha})`;
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });

    animationFrameId = window.requestAnimationFrame(drawDust);
  };

  resizeDustCanvas();
  seedParticles();
  drawDust();

  window.addEventListener('resize', () => {
    window.cancelAnimationFrame(animationFrameId);
    resizeDustCanvas();
    seedParticles();
    drawDust();
  });
}

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

  const renderSpotifyLoading = () => {
    musicPlayer.classList.remove('is-playing');

    if (compactTitle) compactTitle.textContent = 'Loading recent listening activity…';
    if (compactMeta) compactMeta.textContent = '';
    if (compactStatus) compactStatus.textContent = 'CHECKING SPOTIFY';
    if (expandedTitle) expandedTitle.textContent = 'See what Brian’s listening to';
    if (expandedMeta) expandedMeta.textContent = '';
    if (statusHeading) statusHeading.textContent = 'CHECKING SPOTIFY';
    if (statusText) statusText.textContent = 'Loading recent listening activity…';

    hideSpotifyLink();
  };

  const renderFallback = () => {
    musicPlayer.classList.remove('is-playing');

    if (compactTitle) compactTitle.textContent = 'Check back soon';
    if (compactMeta) compactMeta.textContent = '';
    if (compactStatus) compactStatus.textContent = 'SPOTIFY UNAVAILABLE';
    if (expandedTitle) expandedTitle.textContent = 'Check back soon';
    if (expandedMeta) expandedMeta.textContent = '';
    if (statusHeading) statusHeading.textContent = 'SPOTIFY UNAVAILABLE';
    if (statusText) statusText.textContent = 'Check back soon';

    hideSpotifyLink();
  };

  const renderSpotifyTrack = (track) => {
    const title = hasText(track.title) ? track.title.trim() : 'Untitled track';
    const artist = hasText(track.artist) ? track.artist.trim() : 'Unknown artist';
    const album = hasText(track.album) ? track.album.trim() : 'Unknown album';
    const status = track.isPlaying ? 'NOW PLAYING.' : 'RECENTLY PLAYED.';

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
    renderSpotifyLoading();

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

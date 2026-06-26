const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Subtle ambient dust layer.
const dustCanvas = document.querySelector('.ambient-dust');

if (dustCanvas && !reduceMotion) {
  const ctx = dustCanvas.getContext('2d');
  const particles = [];
  const canUsePointerAttraction = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const attraction = {
    active: false,
    x: 0,
    y: 0,
    radius: 128,
    force: 0.0028,
    maxVelocity: 0.18
  };
  const getDustSettings = () => {
    if (window.innerWidth < 700) {
      return {
        count: 64,
        minRadius: 0.35,
        radiusRange: 1,
        minAlpha: 0.04,
        alphaRange: 0.09,
        maxSpeedX: 0.03,
        minSpeedY: 0.014,
        speedYRange: 0.031
      };
    }

    return {
      count: 128,
      minRadius: 0.45,
      radiusRange: 1.4,
      minAlpha: 0.05,
      alphaRange: 0.11,
      maxSpeedX: 0.035,
      minSpeedY: 0.018,
      speedYRange: 0.042
    };
  };

  let width = 0;
  let height = 0;
  let dustSettings = getDustSettings();
  let resizeObserver;
  let animationFrameId;

  const getDocumentHeight = () => Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  const resizeDustCanvas = () => {
    const pixelRatio = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = getDocumentHeight();
    dustSettings = getDustSettings();
    dustCanvas.width = Math.floor(width * pixelRatio);
    dustCanvas.height = Math.floor(height * pixelRatio);
    dustCanvas.style.width = `${width}px`;
    dustCanvas.style.height = `${height}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const createParticle = () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * dustSettings.radiusRange + dustSettings.minRadius,
    speedX: (Math.random() - 0.5) * (dustSettings.maxSpeedX * 2),
    speedY: Math.random() * dustSettings.speedYRange + dustSettings.minSpeedY,
    alpha: Math.random() * dustSettings.alphaRange + dustSettings.minAlpha,
    velocityX: 0,
    velocityY: 0
  });

  const seedParticles = () => {
    particles.length = 0;

    for (let i = 0; i < dustSettings.count; i += 1) {
      particles.push(createParticle());
    }
  };

  const drawDust = () => {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((particle) => {
      if (attraction.active) {
        const deltaX = attraction.x - particle.x;
        const deltaY = attraction.y - particle.y;
        const distance = Math.hypot(deltaX, deltaY);

        if (distance > 0 && distance < attraction.radius) {
          const pull = (1 - distance / attraction.radius) * attraction.force;
          particle.velocityX += (deltaX / distance) * pull;
          particle.velocityY += (deltaY / distance) * pull;
        }
      }

      particle.velocityX *= 0.94;
      particle.velocityY *= 0.94;
      particle.velocityX = Math.max(-attraction.maxVelocity, Math.min(attraction.maxVelocity, particle.velocityX));
      particle.velocityY = Math.max(-attraction.maxVelocity, Math.min(attraction.maxVelocity, particle.velocityY));

      particle.x += particle.speedX + particle.velocityX;
      particle.y += particle.speedY + particle.velocityY;

      if (particle.y > height + 8) particle.y = -8;
      if (particle.x < -8) particle.x = width + 8;
      if (particle.x > width + 8) particle.x = -8;

      ctx.beginPath();
      ctx.fillStyle = `rgba(17, 17, 17, ${particle.alpha})`;
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });

    animationFrameId = window.requestAnimationFrame(drawDust);
  };

  resizeDustCanvas();
  seedParticles();
  drawDust();

  const handleDustResize = () => {
    window.cancelAnimationFrame(animationFrameId);
    resizeDustCanvas();
    seedParticles();
    drawDust();
  };

  window.addEventListener('resize', handleDustResize);

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(handleDustResize);
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);
  }

  if (canUsePointerAttraction) {
    document.querySelectorAll('a, button').forEach((element) => {
      element.addEventListener('pointerenter', (event) => {
        attraction.active = true;
        attraction.x = event.clientX + window.scrollX;
        attraction.y = event.clientY + window.scrollY;
      });

      element.addEventListener('pointermove', (event) => {
        if (!attraction.active) return;

        attraction.x = event.clientX + window.scrollX;
        attraction.y = event.clientY + window.scrollY;
      });

      element.addEventListener('pointerleave', () => {
        attraction.active = false;
      });
    });
  }
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

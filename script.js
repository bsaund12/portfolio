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
        minRadius: 0.45,
        radiusRange: 1.2,
        minAlpha: 0.09,
        alphaRange: 0.14,
        maxSpeedX: 0.03,
        minSpeedY: 0.014,
        speedYRange: 0.031
      };
    }

    return {
      count: 128,
      minRadius: 0.55,
      radiusRange: 1.55,
      minAlpha: 0.11,
      alphaRange: 0.17,
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
  let activeStreak = null;
  let nextStreakAt = 0;

  const getRandomBetween = (min, max) => Math.random() * (max - min) + min;

  const scheduleNextStreak = (now) => {
    nextStreakAt = now + getRandomBetween(8000, 15000);
  };

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

  const getContentAvoidRects = () => {
    const selectors = [
      '.site-header',
      '.brand',
      '.nav-links',
      '.hero-content',
      '.hero-visual',
      '.section-heading',
      '.project-card',
      '.experience-card',
      '.skills-card',
      '.focus-card',
      '.contact-links',
      '.button',
      'h1',
      'h2',
      'h3',
      'p',
      'li'
    ];

    return Array.from(document.querySelectorAll(selectors.join(','))).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left + window.scrollX - 52,
        right: rect.right + window.scrollX + 52,
        top: rect.top + window.scrollY - 52,
        bottom: rect.bottom + window.scrollY + 52
      };
    });
  };

  const rectsOverlap = (first, second) => (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );

  const canPlaceStreak = (streak, avoidRects) => {
    const endX = streak.x + Math.cos(streak.angle) * streak.travel;
    const endY = streak.y + Math.sin(streak.angle) * streak.travel;
    const bounds = {
      left: Math.min(streak.x, endX) - streak.length - 36,
      right: Math.max(streak.x, endX) + streak.length + 36,
      top: Math.min(streak.y, endY) - streak.length - 36,
      bottom: Math.max(streak.y, endY) + streak.length + 36
    };

    return !avoidRects.some((rect) => rectsOverlap(bounds, rect));
  };

  const createStreak = (now) => {
    const avoidRects = getContentAvoidRects();

    for (let attempt = 0; attempt < 28; attempt += 1) {
      const angleDegrees = (Math.random() < 0.5 ? -1 : 1) * getRandomBetween(28, 48);
      const angle = angleDegrees * (Math.PI / 180);
      const streak = {
        x: getRandomBetween(24, Math.max(25, width - 24)),
        y: getRandomBetween(24, Math.max(25, height - 24)),
        angle,
        startTime: now,
        duration: getRandomBetween(650, 900),
        length: getRandomBetween(40, 100),
        travel: getRandomBetween(70, 140),
        alpha: getRandomBetween(0.08, 0.18)
      };

      if (canPlaceStreak(streak, avoidRects)) return streak;
    }

    return null;
  };

  const drawStreak = (streak, now) => {
    const progress = Math.min((now - streak.startTime) / streak.duration, 1);
    const fade = Math.sin(progress * Math.PI);
    const headX = streak.x + Math.cos(streak.angle) * streak.travel * progress;
    const headY = streak.y + Math.sin(streak.angle) * streak.travel * progress;
    const segmentCount = 7;

    for (let index = 0; index < segmentCount; index += 1) {
      const startOffset = (index / segmentCount) * streak.length;
      const endOffset = ((index + 1) / segmentCount) * streak.length;
      const segmentAlpha = streak.alpha * fade * (1 - index / segmentCount);
      const lineWidth = 1.15 - (index / segmentCount) * 0.8;

      ctx.beginPath();
      ctx.strokeStyle = `rgba(17, 17, 17, ${segmentAlpha})`;
      ctx.lineWidth = Math.max(lineWidth, 0.25);
      ctx.lineCap = 'round';
      ctx.moveTo(
        headX - Math.cos(streak.angle) * startOffset,
        headY - Math.sin(streak.angle) * startOffset
      );
      ctx.lineTo(
        headX - Math.cos(streak.angle) * endOffset,
        headY - Math.sin(streak.angle) * endOffset
      );
      ctx.stroke();
    }

    if (progress >= 1) activeStreak = null;
  };

  const drawDust = () => {
    const now = performance.now();

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

    if (!activeStreak && now >= nextStreakAt) {
      activeStreak = createStreak(now);
      scheduleNextStreak(now);
    }

    if (activeStreak) {
      drawStreak(activeStreak, now);
    }

    animationFrameId = window.requestAnimationFrame(drawDust);
  };

  resizeDustCanvas();
  seedParticles();
  scheduleNextStreak(performance.now());
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

// Reveal the homepage when returning from the personal about page.
const returnParams = new URLSearchParams(window.location.search);

if (returnParams.get('from') === 'about') {
  const cleanReturnUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('from');
    const cleanSearch = url.searchParams.toString();
    const cleanUrl = `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${url.hash}`;
    window.history.replaceState(null, '', cleanUrl);
  };

  if (reduceMotion) {
    cleanReturnUrl();
  } else {
    document.documentElement.classList.add('is-returning-from-about');

    window.setTimeout(() => {
      document.documentElement.classList.remove('is-returning-from-about');
      cleanReturnUrl();
    }, 900);
  }
}

// Page transition for the hero portrait link.
const portraitAboutLink = document.querySelector('.portrait-link[href="about.html"]');

if (portraitAboutLink) {
  let isPageTransitioning = false;

  window.addEventListener('pageshow', () => {
    isPageTransitioning = false;
    document.body.classList.remove('is-page-transitioning');
  });

  portraitAboutLink.addEventListener('click', (event) => {
    const shouldUseDefaultNavigation = (
      reduceMotion ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      portraitAboutLink.target
    );

    if (shouldUseDefaultNavigation) return;

    event.preventDefault();

    if (isPageTransitioning) return;

    isPageTransitioning = true;
    document.body.classList.add('is-page-transitioning');

    window.setTimeout(() => {
      window.location.href = portraitAboutLink.href;
    }, 760);
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

// Visitor counter — fetches and displays the atomic count from my API.
const VISITOR_COUNT_ENDPOINT = 'https://7udcf08keh.execute-api.us-east-1.amazonaws.com/count';
const VISITOR_COUNT_TIMEOUT_MS = 8000;

const visitorCountElement = document.querySelector('[data-visitor-count]');

if (visitorCountElement) {
  const loadVisitorCount = async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), VISITOR_COUNT_TIMEOUT_MS);

    try {
      const response = await fetch(VISITOR_COUNT_ENDPOINT, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Visitor count request failed');
      }

      const data = await response.json();

      if (!data || typeof data.count !== 'number') {
        throw new Error('Visitor count response was malformed');
      }

      visitorCountElement.textContent = data.count.toLocaleString();
    } catch {
      visitorCountElement.textContent = '—';
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  loadVisitorCount();
}

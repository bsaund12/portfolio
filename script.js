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

    const header = document.querySelector('.site-nav');
    const headerOffset = header ? header.getBoundingClientRect().height : 0;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset - 16;

    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: reduceMotion ? 'auto' : 'smooth'
    });

    history.pushState(null, '', `#${target.id}`);
  });
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Shared scroll loop — one passive scroll listener drives every scroll effect.
// Scroll can fire many times per frame, so the work runs at most once per
// frame. Each effect has two parts:
//   measure() runs on load, resize and font load, for things that rarely change
//   read()    runs every scroll frame; it only READS layout and returns a
//             function that WRITES styles
// All reads happen before all writes, so the browser works out layout once.
const scrollEffects = [];
let scrollFrameQueued = false;

const runScrollEffects = () => {
  scrollFrameQueued = false;
  const writes = scrollEffects.map((effect) => effect.read());
  writes.forEach((write) => write());
};

const queueScrollEffects = () => {
  if (scrollFrameQueued) return;
  scrollFrameQueued = true;
  window.requestAnimationFrame(runScrollEffects);
};

const measureScrollEffects = () => {
  scrollEffects.forEach((effect) => effect.measure());
  queueScrollEffects();
};

// Timeline progress — draws the white line down #path as you scroll and fills
// each circle the moment the line's tip reaches its center.
const timeline = document.querySelector('.timeline');
const timelineItems = timeline ? Array.from(timeline.querySelectorAll('.timeline-item')) : [];

if (timeline && timelineItems.length) {
  // The line's tip follows this point on the screen (60% of the way down).
  const TRIGGER_RATIO = 0.6;

  // Circle centers, measured from the top of the timeline.
  let circleCenters = [];

  scrollEffects.push({
    measure: () => {
      const timelineTop = timeline.getBoundingClientRect().top;

      circleCenters = timelineItems.map((item) => {
        const circle = getComputedStyle(item, '::before');
        const itemTop = item.getBoundingClientRect().top - timelineTop;
        return itemTop + parseFloat(circle.top) + parseFloat(circle.height) / 2;
      });

      const lineTop = circleCenters[0];
      const lineLength = circleCenters[circleCenters.length - 1] - lineTop;
      timeline.style.setProperty('--line-top', `${lineTop}px`);
      timeline.style.setProperty('--line-length', `${lineLength}px`);
    },

    read: () => {
      if (reduceMotion) {
        return () => {
          timeline.style.setProperty('--line-progress', 1);
          timelineItems.forEach((item) => item.classList.add('is-filled'));
        };
      }

      const lineTop = circleCenters[0];
      const lineLength = circleCenters[circleCenters.length - 1] - lineTop;
      const tip = window.innerHeight * TRIGGER_RATIO - timeline.getBoundingClientRect().top;
      const progress = lineLength > 0 ? clamp((tip - lineTop) / lineLength, 0, 1) : 0;

      return () => {
        timeline.style.setProperty('--line-progress', progress);
        timelineItems.forEach((item, index) => {
          item.classList.toggle('is-filled', tip >= circleCenters[index]);
        });
      };
    }
  });
}

// Project cards — they stack like a deck (position: sticky in CSS). While the
// next card slides over the current one, the current one shrinks to 0.92,
// lifts and dims. Each card's content reveals when it arrives, and the counter
// shows which card is on top.
const projectList = document.querySelector('.project-list');
const projectCards = projectList ? Array.from(projectList.querySelectorAll('.project-card')) : [];
const projectCurrent = document.querySelector('[data-project-current]');
const projectTotal = document.querySelector('[data-project-total]');

if (projectCards.length) {
  const SCALE_DROP = 0.08; // 1 → 0.92 when fully covered
  const MAX_DIM = 0.5; // opacity of the black dimming layer
  const MAX_LIFT = 16; // px the covered card rises
  const REVEAL_AT = 0.75; // reveal once a card's top passes 75% down the screen
  const pad = (number) => String(number).padStart(2, '0');

  let stickyTops = [];
  let heights = [];
  const lifts = projectCards.map(() => 0);
  const revealed = projectCards.map(() => false);
  let shownIndex = -1;

  if (projectTotal) projectTotal.textContent = pad(projectCards.length);

  // Hides the content so it can reveal; skipped for reduced motion.
  if (!reduceMotion) projectList.classList.add('is-enhanced');

  scrollEffects.push({
    measure: () => {
      stickyTops = projectCards.map((card) => parseFloat(getComputedStyle(card).top));
      heights = projectCards.map((card) => card.offsetHeight);
    },

    read: () => {
      // Where each card sits without our transform. Scaling from the top edge
      // doesn't move the top, so only the lift needs undoing.
      const tops = projectCards.map((card, index) => card.getBoundingClientRect().top + lifts[index]);

      // How far the next card has slid over this one: 0 when it touches this
      // card's bottom edge, 1 when it reaches its own sticky spot.
      const covered = projectCards.map((card, index) => {
        if (index === projectCards.length - 1) return 0;
        const start = stickyTops[index] + heights[index];
        const end = stickyTops[index + 1];
        return clamp((start - tops[index + 1]) / (start - end), 0, 1);
      });

      tops.forEach((top, index) => {
        if (top <= window.innerHeight * REVEAL_AT) revealed[index] = true;
        // Only reset once the card is fully below the screen, so the replay is never seen.
        if (top > window.innerHeight) revealed[index] = false;
      });

      // A card "takes over" once it covers more than half of the one before it.
      let activeIndex = 0;
      covered.forEach((amount, index) => {
        if (amount >= 0.5) activeIndex = index + 1;
      });

      return () => {
        projectCards.forEach((card, index) => {
          if (!reduceMotion) {
            const amount = covered[index];
            lifts[index] = MAX_LIFT * amount;
            card.style.transform = amount > 0
              ? `translateY(${-lifts[index]}px) scale(${1 - SCALE_DROP * amount})`
              : '';
            card.style.setProperty('--card-dim', MAX_DIM * amount);
          }

          card.classList.toggle('is-revealed', revealed[index]);
        });

        if (projectCurrent && activeIndex !== shownIndex) {
          projectCurrent.textContent = pad(activeIndex + 1);
          shownIndex = activeIndex;
        }
      };
    }
  });
}

// Flow-in — any [data-flow-in] element rises 90px, grows from 96% and fades
// in as it scrolls into view, finishing about a third of the way up the
// screen. It's tied to scroll position, so scrolling back up reverses it.
const flowInElements = Array.from(document.querySelectorAll('[data-flow-in]'));

if (flowInElements.length && !reduceMotion) {
  const RISE = 90; // px it starts below its spot
  const START_SCALE = 0.96;
  const FINISH_AT = 0.35; // share of the trip across the screen when it's fully in

  // How far down we've pushed each one, so reads can undo it. Scaling from
  // the top edge doesn't move the top, so only the rise needs undoing.
  const offsets = flowInElements.map(() => 0);

  flowInElements.forEach((element) => {
    element.style.transformOrigin = 'top center';
    element.style.willChange = 'transform, opacity';
  });

  scrollEffects.push({
    measure: () => {},

    read: () => {
      const viewportHeight = window.innerHeight;

      // 0 when the element's top touches the bottom of the screen, 1 once it
      // has travelled FINISH_AT of the way from entering to fully leaving.
      const progress = flowInElements.map((element, index) => {
        const top = element.getBoundingClientRect().top - offsets[index];
        const travel = (viewportHeight + element.offsetHeight) * FINISH_AT;
        return clamp((viewportHeight - top) / travel, 0, 1);
      });

      return () => {
        flowInElements.forEach((element, index) => {
          const amount = progress[index];
          offsets[index] = RISE * (1 - amount);
          element.style.opacity = amount;
          element.style.transform = amount < 1
            ? `translateY(${offsets[index]}px) scale(${START_SCALE + (1 - START_SCALE) * amount})`
            : '';
        });
      };
    }
  });
}

if (scrollEffects.length) {
  measureScrollEffects();
  window.addEventListener('scroll', queueScrollEffects, { passive: true });
  window.addEventListener('resize', measureScrollEffects);

  // Web fonts can change text heights once they load, which moves things.
  if (document.fonts) document.fonts.ready.then(measureScrollEffects);
}

// Skill ribbons — two bands drifting in opposite directions at a steady speed.
// Scrolling the page gives them a push that fades out; hovering one slows it
// to a crawl so it can be read. Reduced motion skips all of this and CSS
// wraps the lists onto several lines instead.
const ribbonsSection = document.querySelector('.ribbons');
const ribbons = Array.from(document.querySelectorAll('[data-ribbon]'))
  .map((element) => ({
    element,
    track: element.querySelector('.ribbon-track'),
    list: element.querySelector('.ribbon-list'),
    direction: element.dataset.direction === 'right' ? 1 : -1,
    offset: 0,
    loopWidth: 0,
    speedFactor: 1,
    hovered: false
  }))
  .filter((ribbon) => ribbon.track && ribbon.list);

if (ribbonsSection && ribbons.length && !reduceMotion) {
  const BASE_SPEED = 60; // px per second, the same for both lists however long they are
  const SCROLL_BOOST = 0.35; // extra px/s for each px/s the page scrolls
  const MAX_BOOST = 600; // px per second
  const HOVER_SPEED = 0.15; // fraction of normal speed while hovered

  let boost = 0;
  let lastTime = 0;
  let lastScrollY = 0;
  let rafId = 0;
  let inView = !('IntersectionObserver' in window);

  // Move `current` toward `target`. `rate` is how quickly (bigger = faster);
  // using dt makes it feel the same on 60 Hz and 120 Hz screens.
  const approach = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));

  ribbons.forEach((ribbon) => {
    // Second copy for the seamless loop; screen readers skip it.
    const copy = ribbon.list.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.removeAttribute('aria-label');
    ribbon.track.append(copy);

    // Touch has no real hover, so only mouse and pen slow the ribbon.
    ribbon.element.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') ribbon.hovered = true;
    });
    ribbon.element.addEventListener('pointerleave', () => {
      ribbon.hovered = false;
    });
  });

  // One loop = exactly half the track (one copy of the list). Computed width
  // keeps the fractions of a pixel and ignores the ribbon's tilt.
  const measureRibbons = () => {
    ribbons.forEach((ribbon) => {
      ribbon.loopWidth = parseFloat(getComputedStyle(ribbon.track).width) / 2;
    });
  };

  const frame = (now) => {
    const dt = clamp((now - lastTime) / 1000, 0, 0.1);
    lastTime = now;

    const scrollSpeed = dt > 0 ? Math.abs(window.scrollY - lastScrollY) / dt : 0;
    lastScrollY = window.scrollY;

    // Speed up quickly when scrolling starts, settle back slowly after.
    const targetBoost = Math.min(scrollSpeed * SCROLL_BOOST, MAX_BOOST);
    boost = approach(boost, targetBoost, targetBoost > boost ? 12 : 2.5, dt);

    ribbons.forEach((ribbon) => {
      ribbon.speedFactor = approach(ribbon.speedFactor, ribbon.hovered ? HOVER_SPEED : 1, 6, dt);
      if (!ribbon.loopWidth) return;

      ribbon.offset += ribbon.direction * (BASE_SPEED + boost) * ribbon.speedFactor * dt;
      // Wrap into the range -loopWidth..0. Both copies are identical, so the jump is invisible.
      ribbon.offset = (((ribbon.offset % ribbon.loopWidth) + ribbon.loopWidth) % ribbon.loopWidth) - ribbon.loopWidth;
      ribbon.track.style.transform = `translate3d(${ribbon.offset}px, 0, 0)`;
    });

    rafId = window.requestAnimationFrame(frame);
  };

  const start = () => {
    if (rafId) return;
    lastTime = performance.now();
    lastScrollY = window.scrollY;
    rafId = window.requestAnimationFrame(frame);
  };

  const stop = () => {
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const updateRunning = () => {
    if (inView && !document.hidden) {
      start();
    } else {
      stop();
    }
  };

  measureRibbons();
  window.addEventListener('resize', measureRibbons);
  if (document.fonts) document.fonts.ready.then(measureRibbons);
  document.addEventListener('visibilitychange', updateRunning);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      updateRunning();
    }).observe(ribbonsSection);
  }

  updateRunning();
}

// Custom cursor — a white square that sits on the mouse and a thin gray ring
// that trails behind it. Built only on devices with a real mouse; phones and
// tablets never get it. Links grow the ring; "Let's talk" grows it more and
// shows "Email" inside.
const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (hasFinePointer) {
  const RING_FOLLOW = 0.12; // share of the gap the ring closes each frame (at 60 fps)
  const INTERACTIVE = 'a, button, [role="button"], input, select, textarea, label, summary';

  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.innerHTML = '<span class="cursor-ring-shape"></span><span class="cursor-label">Email</span>';

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.setAttribute('aria-hidden', 'true');
  dot.innerHTML = '<span class="cursor-dot-shape"></span>';

  document.body.append(ring, dot);
  document.documentElement.classList.add('has-custom-cursor');

  const mouse = { x: 0, y: 0 };
  const ringPosition = { x: 0, y: 0 };
  let rafId = 0;
  let lastTime = 0;
  let visible = false;

  const place = (element, x, y) => {
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const setVisible = (isVisible) => {
    visible = isVisible;
    ring.classList.toggle('is-visible', isVisible);
    dot.classList.toggle('is-visible', isVisible);
  };

  // Each frame the ring closes part of the gap to the mouse ("lerp"). Using
  // the frame time keeps the trail the same on 60 Hz and 120 Hz screens.
  const frame = (now) => {
    const dt = clamp((now - lastTime) / 1000, 0, 0.1);
    lastTime = now;

    const follow = reduceMotion ? 1 : 1 - Math.pow(1 - RING_FOLLOW, dt * 60);
    ringPosition.x += (mouse.x - ringPosition.x) * follow;
    ringPosition.y += (mouse.y - ringPosition.y) * follow;

    place(dot, mouse.x, mouse.y);
    place(ring, ringPosition.x, ringPosition.y);

    // Caught up: stop the loop until the mouse moves again.
    if (Math.abs(mouse.x - ringPosition.x) < 0.1 && Math.abs(mouse.y - ringPosition.y) < 0.1) {
      rafId = 0;
      return;
    }

    rafId = window.requestAnimationFrame(frame);
  };

  const wake = () => {
    if (rafId) return;
    lastTime = performance.now();
    rafId = window.requestAnimationFrame(frame);
  };

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;

    mouse.x = event.clientX;
    mouse.y = event.clientY;

    // Coming (back) into the window: start the ring on the mouse, not across the screen.
    if (!visible) {
      ringPosition.x = mouse.x;
      ringPosition.y = mouse.y;
      setVisible(true);
    }

    wake();
  }, { passive: true });

  // Leaving the window: mouseout with nothing on the other side.
  document.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) setVisible(false);
  });

  // One listener for the whole page instead of one per link.
  document.addEventListener('pointerover', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const overCta = Boolean(target && target.closest('.contact-cta'));
    const overInteractive = Boolean(target && target.closest(INTERACTIVE));

    ring.classList.toggle('is-hovering', overInteractive && !overCta);
    ring.classList.toggle('is-cta', overCta);
    dot.classList.toggle('is-hidden', overInteractive);
  });

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') ring.classList.add('is-pressed');
  });

  const release = () => ring.classList.remove('is-pressed');
  window.addEventListener('pointerup', release);
  window.addEventListener('blur', release);
}

// Visitor counter — fetches and displays the atomic count from my API.
const VISITOR_COUNT_ENDPOINT = 'https://7udcf08keh.execute-api.us-east-1.amazonaws.com/count';
const VISITOR_COUNT_TIMEOUT_MS = 8000;

const visitorCountElement = document.querySelector('[data-visitor-count]');

// Only count visits on the real domain, so local previews don't bump the total.
const isLiveSite = ['bjsaunders.com', 'www.bjsaunders.com'].includes(window.location.hostname);

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

  // Off the live site, skip the request so DynamoDB isn't incremented.
  // The element keeps its "—" from the HTML.
  if (isLiveSite) {
    loadVisitorCount();
  }
}

// Spotify card — shows what I'm playing right now, or the last thing I played,
// from my own API (bsaund12/portfolio-now-playing-api on Vercel). Checks every
// 30 seconds while the tab is visible. The API only allows my real domain, so
// anywhere else the card keeps its "MUSIC / Always something on" fallback.
const musicCard = document.querySelector('[data-music]');

if (musicCard) {
  const NOW_PLAYING_ENDPOINT = 'https://portfolio-now-playing-api.vercel.app/api/now-playing';
  const RECENTLY_PLAYED_ENDPOINT = 'https://portfolio-now-playing-api.vercel.app/api/recently-played';
  const MUSIC_POLL_MS = 30000;
  const MUSIC_TIMEOUT_MS = 8000;
  const SWAP_MS = 200; // each half of the slide-out / slide-in

  const art = musicCard.querySelector('[data-music-art]');
  const artWrap = musicCard.querySelector('.music-art-wrap');
  const label = musicCard.querySelector('[data-music-label]');
  const trackName = musicCard.querySelector('[data-music-track]');
  const artistName = musicCard.querySelector('[data-music-artist]');

  let shownContent = null; // what's on the card now, to spot a real track change
  let pollTimer = 0;
  let refreshing = false;
  let warned = false;

  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

  // The API sends artists as one string today; accept a list too, just in case.
  const toText = (value) => {
    if (Array.isArray(value)) return value.filter(hasText).map((item) => item.trim()).join(', ');
    return hasText(value) ? value.trim() : '';
  };

  // Only trust URLs from the one host we expect. Anything else becomes ''.
  const allowUrl = (value, hostname) => {
    if (!hasText(value)) return '';

    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === hostname ? url.href : '';
    } catch {
      return '';
    }
  };

  const toTrack = (data, isPlaying) => {
    const title = toText(data && data.title);
    const artist = toText(data && (data.artist || data.artists));
    if (!title || !artist) return null;

    return {
      title,
      artist,
      album: toText(data.album),
      art: allowUrl(data.albumArt, 'i.scdn.co'),
      // Now-playing has a track link; recently-played only has an album link.
      link: allowUrl(data.spotifyUrl, 'open.spotify.com') || allowUrl(data.albumUrl, 'open.spotify.com'),
      isPlaying
    };
  };

  const getJson = async (url) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), MUSIC_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`${url} answered ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  // Playing right now? Use it. Otherwise fall back to the last played track.
  const loadTrack = async () => {
    const nowPlaying = await getJson(NOW_PLAYING_ENDPOINT);
    const playing = nowPlaying && nowPlaying.isPlaying ? toTrack(nowPlaying, true) : null;
    if (playing) return playing;

    const recent = await getJson(RECENTLY_PLAYED_ENDPOINT);
    const last = toTrack(recent && Array.isArray(recent.items) ? recent.items[0] : null, false);
    if (!last) throw new Error('No track in the API response');
    return last;
  };

  // Wait for the new cover to download so it doesn't pop in half-loaded.
  const preload = (src) => new Promise((resolve) => {
    if (!src) {
      resolve();
      return;
    }
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = src;
  });

  const slide = (from, to) => Promise.all(
    [artWrap, trackName, artistName].map((element) => element.animate(
      [
        { opacity: from.opacity, transform: `translateY(${from.y}px)` },
        { opacity: to.opacity, transform: `translateY(${to.y}px)` }
      ],
      { duration: SWAP_MS, easing: 'ease', fill: 'forwards' }
    ).finished)
  );

  const clearSlides = () => {
    [artWrap, trackName, artistName].forEach((element) => {
      element.getAnimations().forEach((animation) => animation.cancel());
    });
  };

  // Writes the card. Text goes in with textContent, never innerHTML, because
  // it comes from an outside API and must never be treated as HTML.
  const fillCard = (track) => {
    musicCard.classList.remove('is-loading');
    musicCard.classList.toggle('is-playing', Boolean(track && track.isPlaying));
    musicCard.classList.toggle('is-last-played', Boolean(track && !track.isPlaying));
    musicCard.classList.toggle('is-fallback', !track);

    label.textContent = !track ? 'MUSIC' : track.isPlaying ? 'NOW PLAYING' : 'LAST PLAYED';
    trackName.textContent = track ? track.title : 'Always something on';
    artistName.textContent = track ? track.artist : '';
    artistName.hidden = !track;

    if (track && track.art) {
      art.src = track.art;
      art.alt = `Album cover for ${track.album || track.title}`;
      art.hidden = false;
    } else {
      art.removeAttribute('src');
      art.alt = '';
      art.hidden = true;
    }

    // An <a> without href isn't a link at all, so the fallback can't be clicked.
    if (track && track.link) {
      musicCard.href = track.link;
      musicCard.target = '_blank';
      musicCard.rel = 'noopener noreferrer';
      musicCard.setAttribute('aria-label', `Listening to ${track.title} by ${track.artist} on Spotify`);
    } else {
      musicCard.removeAttribute('href');
      musicCard.removeAttribute('target');
      musicCard.removeAttribute('rel');
      musicCard.removeAttribute('aria-label');
    }
  };

  const showTrack = async (track) => {
    const content = track ? [track.title, track.artist, track.art].join('|') : 'fallback';
    const contentChanged = content !== shownContent;
    const wasLoading = musicCard.classList.contains('is-loading');

    // Same song, maybe just playing ↔ paused: update the label and state only.
    if (!contentChanged) {
      fillCard(track);
      return;
    }

    await preload(track && track.art);

    if (reduceMotion) {
      fillCard(track);
    } else if (wasLoading || shownContent === null) {
      fillCard(track);
      await slide({ opacity: 0, y: 8 }, { opacity: 1, y: 0 });
      clearSlides();
    } else {
      await slide({ opacity: 1, y: 0 }, { opacity: 0, y: -8 });
      fillCard(track);
      await slide({ opacity: 0, y: 8 }, { opacity: 1, y: 0 });
      clearSlides();
    }

    shownContent = content;
  };

  const refreshMusic = async () => {
    if (refreshing) return;
    refreshing = true;

    try {
      await showTrack(await loadTrack());
    } catch (error) {
      // One quiet warning, not one per poll.
      if (!warned) {
        console.warn(`Spotify card: showing the fallback (${error.name === 'AbortError' ? 'request timed out' : error.message}).`);
        warned = true;
      }
      await showTrack(null);
    } finally {
      refreshing = false;
    }
  };

  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = window.setInterval(refreshMusic, MUSIC_POLL_MS);
  };

  const stopPolling = () => {
    window.clearInterval(pollTimer);
    pollTimer = 0;
  };

  if (isLiveSite) {
    musicCard.classList.remove('is-fallback');
    musicCard.classList.add('is-loading');
    refreshMusic();
    if (!document.hidden) startPolling();

    // Hidden tab: stop asking. Back again: catch up right away, then resume.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopPolling();
      } else {
        refreshMusic();
        startPolling();
      }
    });
  } else {
    shownContent = 'fallback';
  }
}

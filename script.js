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

// Timeline progress — draws the white line down #path as you scroll and fills
// each circle the moment the line's tip reaches its center.
const timeline = document.querySelector('.timeline');
const timelineItems = timeline ? Array.from(timeline.querySelectorAll('.timeline-item')) : [];

if (timeline && timelineItems.length) {
  // The line's tip follows this point on the screen (60% of the way down).
  const TRIGGER_RATIO = 0.6;

  // Circle centers, measured from the top of the timeline. Recomputed on resize.
  let circleCenters = [];
  let updateQueued = false;

  const measureTimeline = () => {
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
  };

  const updateTimeline = () => {
    updateQueued = false;

    const lineTop = circleCenters[0];
    const lineLength = circleCenters[circleCenters.length - 1] - lineTop;
    const tip = window.innerHeight * TRIGGER_RATIO - timeline.getBoundingClientRect().top;
    const progress = lineLength > 0 ? Math.min(Math.max((tip - lineTop) / lineLength, 0), 1) : 0;

    timeline.style.setProperty('--line-progress', progress);
    timelineItems.forEach((item, index) => {
      item.classList.toggle('is-filled', tip >= circleCenters[index]);
    });
  };

  // Scroll can fire many times per frame; only do the work once per frame.
  const queueTimelineUpdate = () => {
    if (updateQueued) return;
    updateQueued = true;
    window.requestAnimationFrame(updateTimeline);
  };

  measureTimeline();

  if (reduceMotion) {
    timeline.style.setProperty('--line-progress', 1);
    timelineItems.forEach((item) => item.classList.add('is-filled'));
    window.addEventListener('resize', measureTimeline);
  } else {
    updateTimeline();

    window.addEventListener('scroll', queueTimelineUpdate, { passive: true });
    window.addEventListener('resize', () => {
      measureTimeline();
      queueTimelineUpdate();
    });
  }

  // Web fonts can change line heights once they load, which moves the circles.
  if (document.fonts) {
    document.fonts.ready.then(() => {
      measureTimeline();
      if (!reduceMotion) queueTimelineUpdate();
    });
  }
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

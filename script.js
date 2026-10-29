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

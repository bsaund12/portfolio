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

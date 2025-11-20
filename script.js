// Smooth scroll for nav links & buttons using data-scroll or href="#id"
document.querySelectorAll('[data-scroll], .nav-links a[href^="#"]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const targetSelector = el.getAttribute('data-scroll') || el.getAttribute('href');
    const target = document.querySelector(targetSelector);
    if (!target) return;

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
});

// Scroll reveal using IntersectionObserver
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

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

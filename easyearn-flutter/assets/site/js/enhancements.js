/**
 * EasyEarn file note: Handles the enhancements page behavior and related user interactions.
 */
// UI enhancements: reveal on scroll
(function () {
  'use strict';

  const selectors = [
    '.section-title',
    '.hero-inner',
    '.feat-card',
    '.job-card',
    '.support-card',
    '.split-card',
    '.role-card',
    '.coverage-card',
    '.module-card',
    '.policy-card',
    '.security-card',
    '.step-card',
    '.report-info-card',
    '.report-form',
    '.faq-item'
  ];

  // Helper function for apply reveal used by this script.
  function applyReveal() {
    const elements = document.querySelectorAll(selectors.join(','));
    elements.forEach((el) => el.classList.add('reveal'));

    if (!('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    elements.forEach((el) => observer.observe(el));
  }

  // Sets up hero slider when this script is loaded.
  function initHeroSlider() {
    const slides = Array.from(document.querySelectorAll('.hero-photo .hero-slide'));
    if (slides.length <= 1) return;

    // Rotate the active hero background so the CSS opacity transition can fade slides.
    let activeIndex = slides.findIndex((slide) => slide.classList.contains('active'));
    if (activeIndex < 0) {
      activeIndex = 0;
      slides[0].classList.add('active');
    }

    window.setInterval(() => {
      slides[activeIndex].classList.remove('active');
      activeIndex = (activeIndex + 1) % slides.length;
      slides[activeIndex].classList.add('active');
    }, 4200);
  }

  // Sets up enhancements when this script is loaded.
  function initEnhancements() {
    applyReveal();
    initHeroSlider();
  }

  if (document.readyState === 'loading') {
    // Waits until the HTML has loaded before running page setup code.
    document.addEventListener('DOMContentLoaded', initEnhancements);
  } else {
    initEnhancements();
  }
})();

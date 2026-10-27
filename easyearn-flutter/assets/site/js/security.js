/**
 * EasyEarn file note: Handles the security page behavior and related user interactions.
 */
// security page scripts
(function () {
  'use strict';

  // Sets up security hero slides when this script is loaded.
  function initSecurityHeroSlides() {
    const slides = document.querySelectorAll('.security-hero-slide');
    if (!slides.length) return;
    let index = 0;
    setInterval(() => {
      slides[index].classList.remove('is-active');
      index = (index + 1) % slides.length;
      slides[index].classList.add('is-active');
    }, 5000);
  }

  if (document.readyState === 'loading') {
    // Waits until the HTML has loaded before running page setup code.
    document.addEventListener('DOMContentLoaded', initSecurityHeroSlides);
  } else {
    initSecurityHeroSlides();
  }
})();

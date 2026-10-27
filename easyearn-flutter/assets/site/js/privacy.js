/**
 * EasyEarn file note: Handles the privacy page behavior and related user interactions.
 */
// privacy page scripts
(function () {
  'use strict';

  // Sets up privacy hero slides when this script is loaded.
  function initPrivacyHeroSlides() {
    const slides = document.querySelectorAll('.privacy-hero-slide');
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
    document.addEventListener('DOMContentLoaded', initPrivacyHeroSlides);
  } else {
    initPrivacyHeroSlides();
  }
})();

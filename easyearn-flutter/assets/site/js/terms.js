/**
 * EasyEarn file note: Handles the terms page behavior and related user interactions.
 */
// terms page scripts
(function () {
  'use strict';

  // Sets up terms hero slides when this script is loaded.
  function initTermsHeroSlides() {
    const slides = document.querySelectorAll('.terms-hero-slide');
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
    document.addEventListener('DOMContentLoaded', initTermsHeroSlides);
  } else {
    initTermsHeroSlides();
  }
})();

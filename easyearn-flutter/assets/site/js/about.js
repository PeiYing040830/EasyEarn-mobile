/**
 * EasyEarn file note:
 * This script controls the interactive parts of the About page.
 * It has two features:
 * 1. The highlight cards rotate when the user clicks the card stack.
 * 2. The hero background image changes automatically every few seconds.
 */

// Highlight card rotation feature
(function () {
  'use strict';

  // Find the card stack container from about.html.
  // If this element does not exist, stop the script so other pages do not break.
  const container = document.getElementById('stacking-cards');
  if (!container) return;

  // Convert the card elements into an array so their order can be changed easily.
  let cards = Array.from(container.querySelectorAll('.stacking-card'));

  // At least two cards are needed for the rotation effect to make sense.
  if (cards.length < 2) return;

  // Apply visual position classes based on the current card order.
  // The CSS uses these classes to decide which card appears in front, middle, and back.
  function applyOrder() {
    // Remove old position classes before assigning the new card order.
    cards.forEach((card) => {
      card.classList.remove('is-front', 'is-middle', 'is-back');
    });

    // The first card appears at the front of the stack.
    if (cards[0]) cards[0].classList.add('is-front');

    // The second card appears behind the front card.
    if (cards[1]) cards[1].classList.add('is-middle');

    // The third card appears at the back of the stack.
    if (cards[2]) cards[2].classList.add('is-back');
  }

  // Move the first card to the end of the array, then refresh the visual classes.
  // This creates the effect of the cards cycling forward after every click.
  function rotateCards() {
    cards.push(cards.shift());
    applyOrder();
  }

  // Set the correct front/middle/back classes when the page first loads.
  applyOrder();

  // Rotate the highlight cards whenever the user clicks the card stack.
  container.addEventListener('click', rotateCards);
})();

// About hero background slideshow feature
(function () {
  'use strict';

  // Get all hero background slides from about.html.
  const slides = document.querySelectorAll('.about-hero-slide');

  // If there are no slides, stop the slideshow code safely.
  if (!slides.length) return;

  // Track which slide is currently active.
  let idx = 0;

  // Change the active hero background every 5 seconds.
  setInterval(() => {
    // Hide the current slide.
    slides[idx].classList.remove('is-active');

    // Move to the next slide.
    // The modulo (%) makes the slideshow return to the first slide after the last one.
    idx = (idx + 1) % slides.length;

    // Show the new active slide.
    slides[idx].classList.add('is-active');
  }, 5000);
})();

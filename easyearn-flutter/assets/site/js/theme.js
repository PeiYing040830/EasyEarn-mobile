/**
 * EasyEarn file note: Handles the theme page behavior and related user interactions.
 */
(function () {
  'use strict';

  const sunSvg = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const moonSvg = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M21 14.5A9 9 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z" fill="currentColor"/></svg>';

  const STORAGE_KEY = 'easyearn_theme';

  // Helper function for apply theme used by this script.
  function applyTheme(isDark) {
    document.body.classList.toggle('theme-dark', isDark);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      btn.innerHTML = isDark ? sunSvg : moonSvg;
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  // Sets up theme toggle when this script is loaded.
  function initThemeToggle() {
    // Read saved preference first; fall back to system preference
    const saved = localStorage.getItem(STORAGE_KEY);
    let isDark;
    if (saved !== null) {
      isDark = saved === 'dark';
    } else {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    applyTheme(isDark);

    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    // Connects this element event to the handler that should run next.
    btn.addEventListener('click', function () {
      const currentlyDark = document.body.classList.contains('theme-dark');
      const next = !currentlyDark;
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      applyTheme(next);
    });
  }

  window.initEasyEarnTheme = initThemeToggle;
})();

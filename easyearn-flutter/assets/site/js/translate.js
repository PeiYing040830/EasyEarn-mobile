/**
 * EasyEarn file note: Handles the translate page behavior and related user interactions.
 */
(function () {
  'use strict';

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'ms', label: 'Bahasa Malaysia' },
    { code: 'zh-CN', label: 'Chinese (Simplified)' },
    { code: 'ta', label: 'Tamil' },
    { code: 'id', label: 'Indonesian' },
    { code: 'hi', label: 'Hindi' },
    { code: 'zh-TW', label: 'Chinese (Traditional)' },
    { code: 'bn', label: 'Bengali' },
    { code: 'th', label: 'Thai' },
    { code: 'vi', label: 'Vietnamese' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'ar', label: 'Arabic' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'ru', label: 'Russian' },
    { code: 'it', label: 'Italian' },
    { code: 'nl', label: 'Dutch' },
    { code: 'pl', label: 'Polish' },
    { code: 'tr', label: 'Turkish' },
    { code: 'sv', label: 'Swedish' },
    { code: 'no', label: 'Norwegian' },
    { code: 'da', label: 'Danish' },
    { code: 'fi', label: 'Finnish' },
    { code: 'el', label: 'Greek' },
    { code: 'he', label: 'Hebrew' },
    { code: 'cs', label: 'Czech' },
    { code: 'ro', label: 'Romanian' }
  ];

  const googleChromeSelector = [
    '.goog-te-banner-frame',
    '.VIpgJd-ZVi9od-ORHb',
    '.VIpgJd-ZVi9od-ORHb-OEVmcd',
    'body > .VIpgJd-ZVi9od-ORHb',
    'body > .VIpgJd-ZVi9od-ORHb-OEVmcd',
    'body > iframe.goog-te-banner-frame'
  ].join(', ');

  function getCurrentLanguage() {
    const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
    if (!match) return 'en';

    const parts = decodeURIComponent(match[1]).split('/');
    return parts[2] || 'en';
  }

  function writeTranslateCookie(value) {
    const hostname = window.location.hostname;
    const cookie = `googtrans=${value};path=/;max-age=31536000;SameSite=Lax`;
    document.cookie = cookie;

    if (hostname && hostname !== 'localhost') {
      document.cookie = `${cookie};domain=${hostname}`;
      document.cookie = `${cookie};domain=.${hostname}`;
    }
  }

  function clearTranslateCookie() {
    const hostname = window.location.hostname;
    const expired = 'googtrans=;path=/;max-age=0;SameSite=Lax';
    document.cookie = expired;

    if (hostname && hostname !== 'localhost') {
      document.cookie = `${expired};domain=${hostname}`;
      document.cookie = `${expired};domain=.${hostname}`;
    }
  }

  function chooseLanguage(lang) {
    if (lang === 'en') {
      clearTranslateCookie();
    } else {
      writeTranslateCookie(`/en/${lang}`);
    }

    window.location.reload();
  }

  function setImportantStyle(node, property, value) {
    node.style.setProperty(property, value, 'important');
  }

  function hideGoogleTranslateChrome() {
    setImportantStyle(document.documentElement, 'margin-top', '0');
    setImportantStyle(document.body, 'top', '0');
    setImportantStyle(document.body, 'position', 'static');

    document
      .querySelectorAll(googleChromeSelector)
      .forEach(function (node) {
        setImportantStyle(node, 'display', 'none');
        setImportantStyle(node, 'visibility', 'hidden');
        setImportantStyle(node, 'height', '0');
        setImportantStyle(node, 'min-height', '0');
        setImportantStyle(node, 'max-height', '0');
        setImportantStyle(node, 'opacity', '0');
        setImportantStyle(node, 'pointer-events', 'none');
      });
  }

  function renderLanguageMenu(el) {
    const currentLanguage = getCurrentLanguage();
    const currentLabel =
      languages.find(function (language) {
        return language.code === currentLanguage;
      })?.label || 'Language';

    el.innerHTML = `
      <button class="easyearn-translate-trigger" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Choose language">
        <span class="easyearn-translate-current">${currentLabel}</span>
      </button>
      <div class="easyearn-translate-menu" role="menu">
        ${languages
          .map(function (language) {
            const isActive = language.code === currentLanguage;
            return `<button class="easyearn-translate-option${isActive ? ' is-active' : ''}" type="button" role="menuitem" data-lang="${language.code}">${language.label}</button>`;
          })
          .join('')}
      </div>
      <div id="google_translate_widget" class="easyearn-google-widget" aria-hidden="true"></div>
    `;

    const trigger = el.querySelector('.easyearn-translate-trigger');
    const menu = el.querySelector('.easyearn-translate-menu');

    trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      const isOpen = el.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(isOpen));
    });

    menu.addEventListener('click', function (event) {
      const option = event.target.closest('[data-lang]');
      if (!option) return;

      event.preventDefault();
      chooseLanguage(option.dataset.lang);
    });

    document.addEventListener('click', function (event) {
      if (el.contains(event.target)) return;
      el.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      el.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function watchGoogleTranslateChrome() {
    hideGoogleTranslateChrome();

    if (window.easyEarnTranslateObserver) return;

    window.easyEarnTranslateObserver = new MutationObserver(hideGoogleTranslateChrome);
    window.easyEarnTranslateObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    window.setInterval(hideGoogleTranslateChrome, 800);
  }

  // Sets up init when this script is loaded.
  function init() {
    const el = document.getElementById('google_translate_element');
    if (!el) return;

    renderLanguageMenu(el);
    watchGoogleTranslateChrome();

    window.googleTranslateElementInit = function () {
      if (typeof google !== 'undefined' && google.translate) {
        new google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: languages.map(function (language) {
              return language.code;
            }).join(','),
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false
          },
          'google_translate_widget'
        );
        hideGoogleTranslateChrome();
      }
    };

    if (document.getElementById('google-translate-script')) {
      if (window.googleTranslateElementInit) {
        window.googleTranslateElementInit();
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-translate-script';
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    script.defer = true;
    script.onerror = function () {
      el.innerHTML = '<span class="translate-fallback">Select Language</span>';
    };
    document.head.appendChild(script);
  }

  window.initEasyEarnTranslate = init;
})();

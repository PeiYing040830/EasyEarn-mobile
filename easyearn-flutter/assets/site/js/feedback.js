/**
 * EasyEarn file note: Handles the feedback page behavior and related user interactions.
 */
(function () {
  window.EasyEarnToast = {
    show() {
      // Inline status messages are used for save/submit feedback.
    }
  };
  return;

  const TOAST_ROOT_ID = 'easyearn-toast-root';
  const STATUS_SELECTOR = [
    '.employer-inline-status',
    '.admin-inline-status',
    '.profile-inline-status',
    '.profile-upload-status',
    '.messages-status',
    '#profile-status-message',
    '#error-msg'
  ].join(',');

  const seenMessages = new Map();
  let styleInjected = false;

  // Helper function for inject styles used by this script.
  function injectStyles() {
    if (styleInjected || document.getElementById('easyearn-toast-style')) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.id = 'easyearn-toast-style';
    style.textContent = `
      #${TOAST_ROOT_ID} {
        position: fixed;
        top: 96px;
        right: 22px;
        z-index: 99999;
        display: grid;
        gap: 10px;
        width: min(360px, calc(100vw - 32px));
        pointer-events: none;
      }
      .easyearn-toast {
        pointer-events: auto;
        border-radius: 12px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: #ffffff;
        color: #0f172a;
        box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
        padding: 13px 15px;
        font: 700 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        transform: translateY(-8px);
        opacity: 0;
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .easyearn-toast.is-visible {
        opacity: 1;
        transform: translateY(0);
      }
      .easyearn-toast.is-success {
        border-color: rgba(34, 197, 94, 0.38);
        background: #f0fdf4;
        color: #166534;
      }
      .easyearn-toast.is-error {
        border-color: rgba(239, 68, 68, 0.38);
        background: #fef2f2;
        color: #991b1b;
      }
      .easyearn-toast.is-info {
        border-color: rgba(14, 165, 233, 0.34);
        background: #ecfeff;
        color: #155e75;
      }
      body.theme-dark .easyearn-toast {
        background: #111827;
        border-color: rgba(148, 163, 184, 0.28);
        color: #e5e7eb;
        box-shadow: 0 18px 36px rgba(0, 0, 0, 0.34);
      }
      body.theme-dark .easyearn-toast.is-success {
        background: #052e16;
        border-color: rgba(74, 222, 128, 0.44);
        color: #bbf7d0;
      }
      body.theme-dark .easyearn-toast.is-error {
        background: #450a0a;
        border-color: rgba(252, 165, 165, 0.44);
        color: #fecaca;
      }
      body.theme-dark .easyearn-toast.is-info {
        background: #083344;
        border-color: rgba(103, 232, 249, 0.38);
        color: #cffafe;
      }
      @media (max-width: 640px) {
        #${TOAST_ROOT_ID} {
          top: 82px;
          left: 16px;
          right: 16px;
          width: auto;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Loads root data so the page can display current information.
  function getRoot() {
    injectStyles();
    let root = document.getElementById(TOAST_ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = TOAST_ROOT_ID;
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('aria-atomic', 'true');
      document.body.appendChild(root);
    }
    return root;
  }

  // Helper function for classify used by this script.
  function classify(message, el) {
    const className = String(el?.className || '').toLowerCase();
    const text = String(message || '').toLowerCase();
    if (className.includes('is-error') || className.includes('error')) return 'error';
    if (className.includes('is-success') || className.includes('success')) return 'success';
    if (/\b(fail|failed|unable|error|denied|invalid|required|cannot|wrong)\b/.test(text)) return 'error';
    if (/\b(saved|success|submitted|published|updated|loaded|sent|approved|resolved|unlocked|locked)\b/.test(text)) return 'success';
    if (/\b(saving|loading|updating|publishing|sending)\b/.test(text)) return 'info';
    return '';
  }

  // Shows the toast message or section when the user needs feedback.
  function showToast(message, type = 'info') {
    const text = String(message || '').trim();
    if (!text) return;
    const root = getRoot();
    const toast = document.createElement('div');
    toast.className = `easyearn-toast is-${type || 'info'}`;
    toast.textContent = text;
    root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => toast.remove(), 220);
    }, type === 'error' ? 5200 : 3400);
  }

  // Helper function for maybe toast from status used by this script.
  function maybeToastFromStatus(el) {
    if (!el) return;
    // Helper function for message used by this script.
    const message = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!message || message.length < 3) return;
    const type = classify(message, el);
    if (!type) return;
    if (seenMessages.get(el) === message) return;
    seenMessages.set(el, message);
    showToast(message, type);
  }

  // Runs the status element step for this page workflow.
  function observeStatusElement(el) {
    if (!el || seenMessages.has(el)) return;
    seenMessages.set(el, (el.textContent || '').replace(/\s+/g, ' ').trim());
    const observer = new MutationObserver(() => maybeToastFromStatus(el));
    observer.observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // Sets up feedback when this script is loaded.
  function initFeedback() {
    document.querySelectorAll(STATUS_SELECTOR).forEach(observeStatusElement);

    const bodyObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches?.(STATUS_SELECTOR)) observeStatusElement(node);
          node.querySelectorAll?.(STATUS_SELECTOR).forEach(observeStatusElement);
        });
      });
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  window.EasyEarnToast = { show: showToast };

  if (document.readyState === 'loading') {
    // Waits until the HTML has loaded before running page setup code.
    document.addEventListener('DOMContentLoaded', initFeedback);
  } else {
    initFeedback();
  }
})();

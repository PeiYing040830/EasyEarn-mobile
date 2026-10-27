/**
 * EasyEarn file note: Handles the index page behavior and related user interactions.
 */
function loadPartial(id, path) {
  const target = document.getElementById(id);
  if (!target) return Promise.resolve(false);

  return fetch(path)
    .then((res) => res.text())
    .then((html) => {
      target.innerHTML = html;
      return true;
    })
    .catch(() => {
      target.innerHTML = '';
      return false;
    });
}

// Helper function for highlight current nav used by this script.
function highlightCurrentNav() {
  const navLinks = document.querySelectorAll('#site-header .nav-links a[href]');
  if (!navLinks.length) return;

  const currentPath = window.location.pathname.replace(/\\/g, '/').toLowerCase();
  let bestMatch = null;
  let bestLength = -1;

  navLinks.forEach((link) => {
    link.classList.remove('is-active');
    link.removeAttribute('aria-current');

    try {
      const linkUrl = new URL(link.getAttribute('href'), window.location.href);
      const linkPath = linkUrl.pathname.replace(/\\/g, '/').toLowerCase();
      if (currentPath.endsWith(linkPath) && linkPath.length > bestLength) {
        bestMatch = link;
        bestLength = linkPath.length;
      }
    } catch {
      // Ignore malformed link targets.
    }
  });

  if (bestMatch) {
    bestMatch.classList.add('is-active');
    bestMatch.setAttribute('aria-current', 'page');
  }
}

// Formats or checks footer links so later code can use a clean value.
function normalizeFooterLinks(basePath) {
  const footerLinks = document.querySelectorAll('#site-footer a[href]');
  if (!footerLinks.length) return;

  footerLinks.forEach((link) => {
    const publicPage = link.dataset.footerPage;
    if (publicPage) {
      link.setAttribute('href', `${basePath}${publicPage}`);
      return;
    }

    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.includes(':') || href.startsWith('/')) return;
    link.setAttribute('href', `${basePath}${href.replace(/^(\.\/)+/, '')}`);
  });
}

// Waits until the HTML has loaded before running page setup code.
document.addEventListener('DOMContentLoaded', () => {
  const basePath = window.EASYEARN_BASE_PATH || '';
  const headerPath = window.EASYEARN_HEADER_PATH || `${basePath}partials/header.html`;
  const footerPath = window.EASYEARN_FOOTER_PATH || `${basePath}partials/footer.html`;
  const isJobSeekerHeader = String(headerPath).includes('header-jobseeker.html');
  const isEmployerHeader = String(headerPath).includes('header-employer.html');
  const isAdminHeader = String(headerPath).includes('header-admin.html');
  Promise.all([
    loadPartial('site-header', headerPath),
    loadPartial('site-footer', footerPath)
  ]).then(() => {
    normalizeFooterLinks(basePath);
    highlightCurrentNav();

    if (typeof window.initEasyEarnTranslate === 'function') {
      window.initEasyEarnTranslate();
    }
    if (typeof window.initEasyEarnTheme === 'function') {
      window.initEasyEarnTheme();
    } else {
      if (!document.getElementById('easyearn-theme-script')) {
        const script = document.createElement('script');
        script.id = 'easyearn-theme-script';
        script.src = `${basePath}js/theme.js`;
        script.defer = true;
        script.onload = function () {
          if (typeof window.initEasyEarnTheme === 'function') {
            window.initEasyEarnTheme();
          }
        };
        document.head.appendChild(script);
      }
    }

    if (!document.getElementById('easyearn-floating-chatbot')) {
      const script = document.createElement('script');
      script.id = 'easyearn-floating-chatbot';
      script.type = 'module';
      script.src = `${basePath}js/floating-chatbot.js?v=20260829a`;
      document.body.appendChild(script);
    }

    if (!document.getElementById('easyearn-enhancements')) {
      const script = document.createElement('script');
      script.id = 'easyearn-enhancements';
      script.src = `${basePath}js/enhancements.js?v=20260727a`;
      script.defer = true;
      document.body.appendChild(script);
    }

    if (!document.getElementById('easyearn-feedback')) {
      const script = document.createElement('script');
      script.id = 'easyearn-feedback';
      script.src = `${basePath}js/feedback.js?v=20260802a`;
      script.defer = true;
      document.body.appendChild(script);
    }

    if (!document.getElementById('easyearn-role-guard')) {
      const script = document.createElement('script');
      script.id = 'easyearn-role-guard';
      script.type = 'module';
      script.src = `${basePath}js/role-guard.js?v=20260930b`;
      document.body.appendChild(script);
    }

    if (isJobSeekerHeader && !document.getElementById('easyearn-jobseeker-header')) {
      const script = document.createElement('script');
      script.id = 'easyearn-jobseeker-header';
      script.type = 'module';
      script.src = `${basePath}js/jobseeker-header.js?v=20260409b`;
      document.body.appendChild(script);
    }

    if ((isJobSeekerHeader || isEmployerHeader || isAdminHeader) && !document.getElementById('easyearn-notif-bell')) {
      const bellScript = document.createElement('script');
      bellScript.id = 'easyearn-notif-bell';
      bellScript.type = 'module';
      bellScript.src = `${basePath}js/notifications-bell.js?v=20261002e`;
      document.body.appendChild(bellScript);
    }

    if (isEmployerHeader && !document.getElementById('easyearn-employer-header')) {
      const script = document.createElement('script');
      script.id = 'easyearn-employer-header';
      script.type = 'module';
      script.src = `${basePath}js/employer-header.js?v=20260611b`;
      document.body.appendChild(script);
    }

    if (isAdminHeader && !document.getElementById('easyearn-admin-header')) {
      const script = document.createElement('script');
      script.id = 'easyearn-admin-header';
      script.type = 'module';
      script.src = `${basePath}js/admin-header.js?v=20260409b`;
      document.body.appendChild(script);
    }

// Initialize hamburger menu after header partial is loaded
function initHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navbar = document.querySelector('.marketing-navbar') || document.querySelector('.app-navbar');

  if (hamburgerBtn && navbar) {
    // Remove previous listener to prevent duplicate bindings
    hamburgerBtn.removeEventListener('click', toggleMenu);

    // Helper function for toggle menu used by this script.
    function toggleMenu() {
      navbar.classList.toggle('nav-active');
    }

    // Connects this element event to the handler that should run next.
    hamburgerBtn.addEventListener('click', toggleMenu);

    // Close the mobile menu automatically if clicking outside the navbar area
    document.addEventListener('click', (e) => {
      if (!navbar.contains(e.target) && navbar.classList.contains('nav-active')) {
        navbar.classList.remove('nav-active');
      }
    });
  }
}

  initHamburgerMenu();
  });
});

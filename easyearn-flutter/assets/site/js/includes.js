/**
 * EasyEarn file note: Handles the includes page behavior and related user interactions.
 */
function loadPartial(id, path) {
  const target = document.getElementById(id);
  if (!target) return Promise.resolve(false);

  return fetch(path)
    .then((res) => res.text())
    .then((html) => {
      const template = document.createElement('template');
      template.innerHTML = html;
      const logo = template.content.querySelector('.nav-logo');
      if (logo) {
        const basePath = window.EASYEARN_BASE_PATH || '';
        logo.setAttribute('src', `${basePath}images/logo.png`);
      }
      target.replaceChildren(template.content);
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

// Sets up hamburger menu when this script is loaded.
function initHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navbar = document.querySelector('.marketing-navbar') || document.querySelector('.app-navbar');
  if (!hamburgerBtn || !navbar) return;

  // Helper function for toggle menu used by this script.
  function toggleMenu(event) {
    event?.preventDefault();
    event?.stopPropagation();
    const isOpen = navbar.classList.toggle('nav-active');
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
  }

  // Connects this element event to the handler that should run next.
  hamburgerBtn.addEventListener('click', toggleMenu);
  hamburgerBtn.setAttribute('aria-expanded', String(navbar.classList.contains('nav-active')));

  navbar.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', () => {
      navbar.classList.remove('nav-active');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    });
  });

  // Waits until the HTML has loaded before running page setup code.
  document.addEventListener('click', (e) => {
    if (!navbar.contains(e.target) && navbar.classList.contains('nav-active')) {
      navbar.classList.remove('nav-active');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    }
  });
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

// Formats or checks logo path so later code can use a clean value.
function normalizeLogoPath(basePath) {
  const logoImg = document.querySelector('#site-header .nav-logo');
  if (!logoImg) return;
  logoImg.setAttribute('src', `${basePath}images/logo.png`);
}

// Runs the favicon step for this page workflow.
function ensureFavicon(basePath) {
  const existingIcon = document.querySelector('link[rel~="icon"]');
  if (existingIcon) return;

  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.type = 'image/png';
  icon.href = `${basePath}images/logo.png?v=20260829`;
  document.head.appendChild(icon);
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
    ensureFavicon(basePath);
    normalizeLogoPath(basePath);
    normalizeFooterLinks(basePath);
    highlightCurrentNav();
    initHamburgerMenu();

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
      script.src = `${basePath}js/floating-chatbot.js?v=20261025a`;
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
  });
});

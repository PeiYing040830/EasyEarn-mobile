/**
 * EasyEarn file note: Handles the admin header page behavior and related user interactions.
 */
import { fetchProfile, getInitials, observeAuth, signOutUser } from './supabase-data.js';

(function () {
  'use strict';

  // Updates header after the user changes something or data is refreshed.
  function updateHeader(name, photoSrc = '') {
    const navName = document.getElementById('nav-user-name');
    const navBadge = document.getElementById('nav-user-badge');

    if (navName) navName.textContent = name || 'Admin';
    if (!navBadge) return;

    if (photoSrc) {
      navBadge.classList.add('has-image');
      navBadge.style.backgroundImage = `url("${photoSrc}")`;
      navBadge.textContent = '';
      return;
    }

    navBadge.classList.remove('has-image');
    navBadge.style.backgroundImage = '';
    navBadge.textContent = getInitials(name || 'Admin', 'AD');
  }

  // Sets up logout when this script is loaded.
  function bindLogout() {
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (!logoutBtn || logoutBtn.dataset.bound === 'true') return;

    logoutBtn.dataset.bound = 'true';
    // Connects this element event to the handler that should run next.
    logoutBtn.addEventListener('click', async () => {
      await signOutUser();
      window.location.href = '../../logout.html';
    });
  }

  // Formats or checks role so later code can use a clean value.
  function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'jobseeker' || value === 'job seeker') return 'seeker';
    return value;
  }

  // Runs the non admin step for this page workflow.
  function redirectNonAdmin(role) {
    if (role === 'employer') {
      window.location.href = '../employer/dashboard.html';
      return;
    }

    window.location.href = '../jobseeker/dashboard.html';
  }

  observeAuth(async (user) => {
    bindLogout();

    if (!user) {
      updateHeader('Admin');
      return;
    }

    try {
      const profile = await fetchProfile(user.id, user);
      const profileRole = normalizeRole(user.app_metadata?.role === 'admin' ? 'admin' : profile.role || user.user_metadata?.role);

      if (profileRole && profileRole !== 'admin') {
        updateHeader('Admin');
        redirectNonAdmin(profileRole);
        return;
      }

      const resolvedName = profile.name || user.user_metadata?.name || user.email || 'Admin';
      const resolvedPhoto = profile.photoData || profile.photoUrl || '';
      updateHeader(resolvedName, resolvedPhoto);
      try {
        sessionStorage.setItem('ee_logout_name', resolvedName);
        sessionStorage.setItem('ee_logout_photo', resolvedPhoto);
      } catch (e) {}
    } catch (error) {
      console.error('Failed to load admin header data:', error);
      const fallbackRole = normalizeRole(user.app_metadata?.role === 'admin' ? 'admin' : user.user_metadata?.role);
      if (fallbackRole && fallbackRole !== 'admin') {
        updateHeader('Admin');
        redirectNonAdmin(fallbackRole);
        return;
      }
      updateHeader(user.user_metadata?.name || user.email || 'Admin');
    }
  });
})();

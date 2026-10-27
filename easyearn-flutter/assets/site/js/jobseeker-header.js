/**
 * EasyEarn file note: Handles the jobseeker header page behavior and related user interactions.
 */
import { fetchProfile, getInitials, observeAuth, signOutUser } from './supabase-data.js';

(function () {
  'use strict';

  // Updates header after the user changes something or data is refreshed.
  function updateHeader(name, photoSrc = '') {
    const navName = document.getElementById('nav-user-name');
    const navBadge = document.getElementById('nav-user-badge');

    if (navName) navName.textContent = name || 'Job Seeker';
    if (!navBadge) return;

    if (photoSrc) {
      navBadge.classList.add('has-image');
      navBadge.style.backgroundImage = `url("${photoSrc}")`;
      navBadge.textContent = '';
      return;
    }

    navBadge.classList.remove('has-image');
    navBadge.style.backgroundImage = '';
    navBadge.textContent = getInitials(name || 'Job Seeker', 'JS');
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

  // Runs the non jobseeker step for this page workflow.
  function redirectNonJobseeker(role) {
    if (role === 'admin') {
      window.location.href = '../admin/dashboard.html';
      return;
    }

    window.location.href = '../employer/dashboard.html';
  }

  observeAuth(async (user) => {
    bindLogout();

    if (!user) {
      updateHeader('Job Seeker');
      return;
    }

    try {
      const profile = await fetchProfile(user.id, user);
      const profileRole = normalizeRole(profile.role || user.user_metadata?.role);

      // Redirect non-seekers away from jobseeker pages, mirroring the check
      // that employer-header.js already performs for employer pages.
      if (profileRole && profileRole !== 'seeker' && profileRole !== 'jobseeker') {
        updateHeader('Job Seeker');
        redirectNonJobseeker(profileRole);
        return;
      }

      const resolvedName = profile.name || user.user_metadata?.name || user.email || 'Job Seeker';
      const resolvedPhoto = profile.photoData || profile.photoUrl || '';
      updateHeader(resolvedName, resolvedPhoto);
      try {
        sessionStorage.setItem('ee_logout_name', resolvedName);
        sessionStorage.setItem('ee_logout_photo', resolvedPhoto);
      } catch (e) {}
    } catch (error) {
      console.error('Failed to load job seeker header data:', error);
      const fallbackRole = normalizeRole(user.user_metadata?.role);
      if (fallbackRole && fallbackRole !== 'seeker') {
        updateHeader('Job Seeker');
        redirectNonJobseeker(fallbackRole);
        return;
      }
      updateHeader(user.user_metadata?.name || user.email || 'Job Seeker');
    }
  });
})();

/**
 * EasyEarn file note: Handles the employer header page behavior and related user interactions.
 */
import { fetchProfile, getInitials, observeAuth, signOutUser } from './supabase-data.js';

(function () {
  'use strict';

  let currentUser = null;
  let logoutName = 'Employer';
  let logoutPhoto = '';

  // Updates header after the user changes something or data is refreshed.
  function updateHeader(name, imageSrc = '') {
    const navName = document.getElementById('nav-user-name');
    const navBadge = document.getElementById('nav-user-badge');

    if (navName) navName.textContent = name || 'Employer';
    if (!navBadge) return;

    if (imageSrc) {
      navBadge.classList.add('has-image');
      navBadge.style.backgroundImage = `url("${imageSrc}")`;
      navBadge.textContent = '';
      return;
    }

    navBadge.classList.remove('has-image');
    navBadge.style.backgroundImage = '';
    navBadge.textContent = getInitials(name || 'Employer', 'EM');
  }

  // Sets up logout when this script is loaded.
  function bindLogout() {
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (!logoutBtn || logoutBtn.dataset.bound === 'true') return;

    logoutBtn.dataset.bound = 'true';
    // Connects this element event to the handler that should run next.
    logoutBtn.addEventListener('click', async () => {
      try {
        if (currentUser?.id) {
          const profile = await fetchProfile(currentUser.id, currentUser);
          logoutName = profile.companyName || profile.businessName || profile.name || currentUser.email || logoutName;
          logoutPhoto = profile.photoData || profile.photoUrl || logoutPhoto || '';
        }
        sessionStorage.setItem('ee_logout_name', logoutName || 'Employer');
        sessionStorage.setItem('ee_logout_photo', logoutPhoto || '');
      } catch (error) {
        console.warn('Unable to cache employer logout snapshot:', error);
      }

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

  // Runs the non employer step for this page workflow.
  function redirectNonEmployer(role) {
    if (role === 'admin') {
      window.location.href = '../admin/dashboard.html';
      return;
    }

    window.location.href = '../jobseeker/dashboard.html';
  }

  observeAuth(async (user) => {
    currentUser = user;
    bindLogout();

    if (!user) {
      updateHeader('Employer');
      return;
    }

    try {
      const profile = await fetchProfile(user.id, user);
      const profileRole = normalizeRole(profile.role || user.user_metadata?.role);

      if (profileRole && profileRole !== 'employer') {
        updateHeader('Employer');
        redirectNonEmployer(profileRole);
        return;
      }

      // Runs the resolved name step for this page workflow.
      const resolvedName = (() => {
          const baseName = profile.companyName || profile.businessName || profile.name || user.email || 'Employer';
          const status = String(profile.accountStatus || 'active').toLowerCase();
          if (status === 'suspended') return `${baseName} (Suspended)`;
          if (status === 'under_review') return `${baseName} (Under Review)`;
          return baseName;
        })();
      const resolvedPhoto = profile.photoData || profile.photoUrl || '';
      logoutName = resolvedName;
      logoutPhoto = resolvedPhoto;
      updateHeader(resolvedName, resolvedPhoto);
      try {
        sessionStorage.setItem('ee_logout_name', resolvedName);
        sessionStorage.setItem('ee_logout_photo', resolvedPhoto);
      } catch (e) {}
    } catch (error) {
      console.error('Failed to load employer header data:', error);
      const fallbackRole = normalizeRole(user.user_metadata?.role);
      if (fallbackRole && fallbackRole !== 'employer') {
        updateHeader('Employer');
        redirectNonEmployer(fallbackRole);
        return;
      }
      updateHeader(user.user_metadata?.name || user.email || 'Employer');
    }
  });
})();

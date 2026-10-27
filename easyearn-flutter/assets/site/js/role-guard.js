/**
 * EasyEarn file note: Handles the role guard page behavior and related user interactions.
 */
import { observeAuth } from './supabase-data.js';
import { fetchAccountAccess, isAccountLocked, signOutLockedAccount } from './account-access.js';

(function () {
  'use strict';

  // Formats or checks role so later code can use a clean value.
  function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'jobseeker' || value === 'job seeker') return 'seeker';
    return value;
  }

  // Runs the required role for current path step for this page workflow.
  function requiredRoleForCurrentPath() {
    const path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    if (path.includes('/pages/admin/')) return 'admin';
    if (path.includes('/pages/employer/')) return 'employer';
    if (path.includes('/pages/jobseeker/')) return 'seeker';
    return '';
  }

  // Helper function for dashboard for role used by this script.
  function dashboardForRole(role) {
    const basePath = window.EASYEARN_BASE_PATH || '../../';
    if (role === 'admin') return `${basePath}pages/admin/dashboard.html`;
    if (role === 'employer') return `${basePath}pages/employer/dashboard.html`;
    if (role === 'seeker') return `${basePath}pages/jobseeker/dashboard.html`;
    return `${basePath}login.html`;
  }

  // Helper function for role matches used by this script.
  function roleMatches(requiredRole, actualRole) {
    return requiredRole && actualRole && requiredRole === actualRole;
  }

  const requiredRole = requiredRoleForCurrentPath();
  if (!requiredRole) return;

  let currentUser = null;
  let checking = false;
  let blocked = false;
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'alert');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;background:var(--card-bg,#fff);color:var(--text-primary,#111827);padding:24px;text-align:center;';
  function showAccessMessage(message) {
    overlay.textContent = message;
    if (!overlay.isConnected) document.body.appendChild(overlay);
    document.querySelector('main')?.setAttribute('inert', '');
  }
  function clearAccessMessage() {
    overlay.remove();
    document.querySelector('main')?.removeAttribute('inert');
    document.querySelector('main')?.removeAttribute('aria-busy');
  }
  // Keep the page shell visible; protected controls stay disabled until verified.
  const main = document.querySelector('main');
  main?.setAttribute('inert', '');
  main?.setAttribute('aria-busy', 'true');

  async function checkAccess() {
    if (!currentUser || checking || blocked) return;
    checking = true;
    const user = currentUser;
    try {
      const account = await fetchAccountAccess(user.id);
      if (currentUser !== user) return;
      if (isAccountLocked(account.account_status)) {
        blocked = true;
        showAccessMessage('Your account has been locked by the administrator. Please contact support.');
        try { await signOutLockedAccount(); }
        catch (error) { console.warn('Locked account sign-out failed:', error); }
        window.location.replace(`${dashboardForRole('')}?reason=account_locked`);
        return;
      }
      const actualRole = normalizeRole(account.role);
      if (!roleMatches(requiredRole, actualRole)) {
        window.location.replace(dashboardForRole(actualRole));
        return;
      }
      clearAccessMessage();
    } catch (error) {
      console.error('Account access verification failed:', error);
      showAccessMessage('Unable to verify account access. Retrying shortly. You can also refresh the page.');
    } finally {
      checking = false;
    }
  }

  observeAuth((user) => {
    currentUser = user;
    if (!user) {
      if (blocked) return;
      window.location.href = dashboardForRole('');
      return;
    }
    checkAccess();
  });
  setInterval(checkAccess, 15000);
  window.addEventListener('pageshow', checkAccess);
  window.addEventListener('focus', checkAccess);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkAccess();
  });
})();

/**
 * EasyEarn file note: Handles the admin users page behavior and related user interactions.
 */
import { observeAuth, fetchAllProfiles, updateUserAccountStatus } from './supabase-data.js';

(function () {
  'use strict';

  const listEl = document.getElementById('admin-users-list');
  const statusEl = document.getElementById('admin-users-status');
  const roleFilterEl = document.getElementById('admin-users-role-filter');
  const accountFilterEl = document.getElementById('admin-users-status-filter');
  const searchEl = document.getElementById('admin-users-search');
  const metrics = {
    seeker: {
      value: document.getElementById('admin-users-seeker-count'),
      note: document.getElementById('admin-users-seeker-note')
    },
    employer: {
      value: document.getElementById('admin-users-employer-count'),
      note: document.getElementById('admin-users-employer-note')
    },
    admin: {
      value: document.getElementById('admin-users-admin-count'),
      note: document.getElementById('admin-users-admin-note')
    }
  };
  let currentAdminId = '';
  let cachedProfiles = [];

  // Updates status after the user changes something or data is refreshed.
  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error');
    if (type) statusEl.classList.add(type);
  }

  // Helper function for role label used by this script.
  function roleLabel(role) {
    if (role === 'jobseeker') return 'Job Seeker';
    if (role === 'employer') return 'Employer';
    if (role === 'admin') return 'Admin';
    return 'Job Seeker';
  }

  // Formats or checks role so later code can use a clean value.
  function normalizeRole(role) {
    const value = String(role || '').toLowerCase();
    return value === 'jobseeker' ? 'seeker' : (value || 'seeker');
  }

  // Helper function for account status label used by this script.
  function accountStatusLabel(status) {
    const value = String(status || 'active').toLowerCase();
    if (value === 'suspended') return 'Locked';
    if (value === 'under_review') return 'Under Review';
    return 'Active';
  }

  // Updates metrics after the user changes something or data is refreshed.
  function updateMetrics(profiles) {
    const seekers = profiles.filter((item) => normalizeRole(item.role) === 'seeker').length;
    const employers = profiles.filter((item) => normalizeRole(item.role) === 'employer').length;
    const admins = profiles.filter((item) => normalizeRole(item.role) === 'admin').length;

    metrics.seeker.value.textContent = String(seekers);
    metrics.employer.value.textContent = String(employers);
    metrics.admin.value.textContent = String(admins);

    metrics.seeker.note.textContent = seekers ? `${seekers} job seeker account(s).` : 'No job seeker records yet.';
    metrics.employer.note.textContent = employers ? `${employers} employer account(s).` : 'No employer records yet.';
    metrics.admin.note.textContent = admins ? `${admins} admin account(s).` : 'No admin records yet.';
  }

  // Formats or checks date so later code can use a clean value.
  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Loads filtered profiles data so the page can display current information.
  function getFilteredProfiles() {
    const roleFilter = roleFilterEl?.value || 'all';
    const accountFilter = accountFilterEl?.value || 'all';
    const query = String(searchEl?.value || '').trim().toLowerCase();

    return cachedProfiles.filter((profile) => {
      const matchesRole = roleFilter === 'all' || normalizeRole(profile.role) === roleFilter;
      const matchesAccount = accountFilter === 'all' || String(profile.accountStatus || 'active').toLowerCase() === accountFilter;
      const haystack = [
        profile.name,
        profile.email,
        profile.phone,
        profile.location,
        roleLabel(profile.role),
        accountStatusLabel(profile.accountStatus)
      ].join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesRole && matchesAccount && matchesSearch;
    });
  }

  // Renders list into the HTML so the user can see it.
  function renderList(profiles) {
    if (!listEl) return;

    if (!profiles.length) {
      listEl.innerHTML = `
        <article class="admin-item">
          <strong>No user records loaded yet</strong>
          <p>Connect the users table to populate this directory view later.</p>
          <div class="admin-item-meta"><span>Role: -</span><span>Status: Empty</span><span>Joined: -</span></div>
        </article>
      `;
      return;
    }

    listEl.innerHTML = profiles.map((profile) => `
      <article class="admin-item" data-user-id="${profile.id}">
        <div class="admin-request-head">
          <div>
            <strong>${profile.name || 'Unnamed user'}</strong>
            <p>${profile.email || 'Email not set'}</p>
          </div>
          <span class="admin-status-pill">${roleLabel(profile.role)}</span>
        </div>
        <div class="admin-item-meta">
          <span>Phone: ${profile.phone || '-'}</span>
          <span>Location: ${profile.location || '-'}</span>
          <span>Account: ${accountStatusLabel(profile.accountStatus)}</span>
          <span>Joined: ${formatDate(profile.createdAt)}</span>
        </div>
        ${profile.role !== 'admin' && profile.id !== currentAdminId ? `
          <div class="admin-action-row">
            ${String(profile.accountStatus || 'active').toLowerCase() === 'suspended'
              ? '<button type="button" class="btn-primary admin-user-unlock-btn">Unlock Account</button>'
              : '<button type="button" class="btn-outline admin-user-lock-btn" style="color:#dc2626;border-color:#dc2626;">Lock Account</button>'}
          </div>
        ` : ''}
      </article>
    `).join('');
  }

  listEl?.addEventListener('click', async (event) => {
    const lockBtn = event.target.closest('.admin-user-lock-btn');
    const unlockBtn = event.target.closest('.admin-user-unlock-btn');
    if (!lockBtn && !unlockBtn) return;

    const card = event.target.closest('[data-user-id]');
    const userId = card?.dataset.userId || '';
    if (!userId) return;

    const nextStatus = lockBtn ? 'suspended' : 'active';
    setStatus(lockBtn ? 'Locking account...' : 'Unlocking account...');

    try {
      await updateUserAccountStatus(userId, nextStatus);
      cachedProfiles = await fetchAllProfiles();
      updateMetrics(cachedProfiles);
      renderList(getFilteredProfiles());
      setStatus(lockBtn ? 'Account locked successfully.' : 'Account unlocked successfully.', 'is-success');
    } catch (error) {
      console.error('Failed to update account status:', error);
      setStatus(error?.message || 'Unable to update account status right now.', 'is-error');
    }
  });

  [roleFilterEl, accountFilterEl].forEach((el) => {
    el?.addEventListener('change', () => renderList(getFilteredProfiles()));
  });

  searchEl?.addEventListener('input', () => renderList(getFilteredProfiles()));

  observeAuth(async (user) => {
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }
    currentAdminId = user.id;

    try {
      cachedProfiles = await fetchAllProfiles();
      updateMetrics(cachedProfiles);
      renderList(getFilteredProfiles());
      setStatus('User directory loaded successfully.', 'is-success');
    } catch (error) {
      console.error('Failed to load admin users:', error);
      updateMetrics([]);
      renderList([]);
      setStatus('Unable to load users. Check Supabase select policy for users.', 'is-error');
    }
  });
})();

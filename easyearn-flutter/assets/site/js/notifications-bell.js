/**
 * EasyEarn file note: Handles the notifications bell page behavior and related user interactions.
 */
/**
 * notifications-bell.js
 * Handles the notification bell UI injected into role headers.
 * Polls for unread notifications and shows a dropdown list.
 */
import { observeAuth, fetchNotifications, markNotificationRead, markAllNotificationsRead } from './supabase-data.js?v=20261002a';

(function () {
  'use strict';

  const bellBtn     = document.getElementById('nav-notif-btn');
  const badge       = document.getElementById('nav-notif-badge');
  const dropdown    = document.getElementById('nav-notif-dropdown');

  if (!bellBtn || !dropdown) return;   // header not present on this page

  let currentUserId = null;
  let notifications = [];
  let isOpen = false;
  let pollTimer = null;
  let fetchError = false;
  let hasLoaded = false;

  const mobileDropdownPositionStyles = [
    'position', 'top', 'right', 'left', 'width', 'max-width', 'max-height', 'z-index'
  ];
  const originalDropdownPositionStyles = new Map(mobileDropdownPositionStyles.map((property) => [
    property,
    [dropdown.style.getPropertyValue(property), dropdown.style.getPropertyPriority(property)]
  ]));

  function positionDropdownForViewport() {
    if (window.matchMedia('(max-width: 480px)').matches) {
      const navbar = document.querySelector('.app-navbar');
      const navbarBottom = navbar ? navbar.getBoundingClientRect().bottom : 64;
      dropdown.style.setProperty('position', 'fixed', 'important');
      dropdown.style.setProperty('top', `${Math.ceil(navbarBottom + 8)}px`, 'important');
      dropdown.style.setProperty('right', '12px', 'important');
      dropdown.style.setProperty('left', 'auto', 'important');
      const dropdownWidth = Math.min(320, Math.max(0, window.innerWidth - 24));
      const availableHeight = window.innerHeight - navbarBottom - 16;
      const dropdownHeight = Math.max(160, Math.min(360, availableHeight));
      dropdown.style.setProperty('width', `${dropdownWidth}px`, 'important');
      dropdown.style.setProperty('max-width', `${dropdownWidth}px`, 'important');
      dropdown.style.setProperty('max-height', `${dropdownHeight}px`, 'important');
      dropdown.style.setProperty('z-index', '10010', 'important');
      return;
    }

    originalDropdownPositionStyles.forEach(([value, priority], property) => {
      if (value) dropdown.style.setProperty(property, value, priority);
      else dropdown.style.removeProperty(property);
    });
  }

  window.addEventListener('resize', () => {
    if (isOpen) positionDropdownForViewport();
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  // Helper function for time ago used by this script.
  function timeAgo(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // Helper function for type icon used by this script.
  function typeIcon(type) {
    if (type === 'application_update') return '🔔';
    if (type === 'interview')          return '📅';
    if (type === 'new_message')        return '💬';
    return '📢';
  }

  // Loads chat link data so the page can display current information.
  function getChatLink(n) {
    const isEmployer = window.location.href.includes('/employer/');
    const isAdmin = window.location.href.includes('/admin/');
    // Helper function for base used by this script.
    const base = (window.EASYEARN_BASE_PATH || '../../').replace(/\/$/, '');
    const folder = isAdmin ? 'admin' : isEmployer ? 'employer' : 'jobseeker';
    const params = new URLSearchParams({
      user: n._chatSenderId || '',
      name: n._chatSenderName || '',
      jobId: n._chatJobId || '',
      job: n._chatJobTitle || ''
    });
    return `${base}/pages/${folder}/messages.html?${params.toString()}`;
  }

  // Loads target link data so the page can display current information.
  function getTargetLink(n) {
    const base = (window.EASYEARN_BASE_PATH || '../../').replace(/\/$/, '');
    const isAdmin = window.location.href.includes('/admin/');
    if (n.type === 'new_message') return getChatLink(n);
    if (n.target_table === 'applications' && !isAdmin) {
      const page = window.location.pathname.includes('/employer/')
        ? 'employer/applicants.html' : 'jobseeker/applications.html';
      return `${base}/pages/${page}`;
    }
    if (!isAdmin && n.target_table === 'verifications' && window.location.pathname.includes('/employer/')) {
      return `${base}/pages/employer/verification.html`;
    }
    if (!isAdmin && n.target_table === 'jobs' && window.location.pathname.includes('/employer/')) {
      return `${base}/pages/employer/manage-jobs.html`;
    }
    if (!isAdmin && n.target_table === 'ratings') {
      const page = window.location.pathname.includes('/employer/')
        ? 'employer/ratings.html' : 'jobseeker/work-history.html';
      return `${base}/pages/${page}`;
    }
    if (!isAdmin) return '';
    if (n.target_table === 'reports') return `${base}/pages/admin/reports.html`;
    if (n.target_table === 'verifications') return `${base}/pages/admin/verifications.html`;
    if (n.target_table === 'jobs') return `${base}/pages/admin/jobs.html`;
    return '';
  }

  // ── Render dropdown ────────────────────────────────────────────────────

  // Renders dropdown into the HTML so the user can see it.
  function renderDropdown() {
    if (!notifications.length) {
      dropdown.innerHTML = `
        <div style="padding:1.2rem;text-align:center;color:var(--text-muted,#888);font-size:.875rem;">
          ${fetchError ? 'Unable to load notifications. Please try again.' : hasLoaded ? 'No notifications yet' : 'Loading notifications...'}
        </div>`;
      return;
    }

    const items = notifications.map((n) => `
      <div class="notif-item" data-id="${n.id}" style="
        display:flex;gap:.75rem;align-items:flex-start;
        padding:.75rem 1rem;border-bottom:1px solid var(--border-color,#f0f0f0);
        cursor:pointer;transition:background .15s;
        background:${n.is_read ? 'transparent' : 'var(--notif-unread-bg,#fefce8)'};
      ">
        <span style="font-size:1.2rem;flex-shrink:0;margin-top:.1rem">${typeIcon(n.type)}</span>
        <div style="flex:1;min-width:0;">
          <p style="margin:0;font-size:.875rem;color:var(--text-primary,#1a1a1a);line-height:1.4;
            font-weight:${n.is_read ? '400' : '600'};">${escHtml(n.message || '')}</p>
          <span style="font-size:.75rem;color:var(--text-muted,#888)">${timeAgo(n.created_at)}</span>
        </div>
        ${n.is_read ? '' : '<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;flex-shrink:0;margin-top:.35rem"></span>'}
      </div>`).join('');

    const header = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.7rem 1rem .6rem;border-bottom:1px solid var(--border-color,#e5e7eb);">
        <strong style="font-size:.9rem">Notifications</strong>
        <button id="notif-mark-all" type="button" style="background:none;border:none;font-size:.78rem;color:#16a34a;cursor:pointer;font-weight:600;">
          Mark all read
        </button>
      </div>`;

    dropdown.innerHTML = header + items;

    dropdown.querySelector('#notif-mark-all')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!currentUserId) return;
      try {
        await markAllNotificationsRead(currentUserId);
        await refresh();
      } catch (err) {
        console.warn('Mark all read failed:', err);
      }
    });

    dropdown.querySelectorAll('.notif-item').forEach((el) => {
      // Connects this element event to the handler that should run next.
      el.addEventListener('mouseenter', () => { el.style.background = 'var(--hover-bg,#f9fafb)'; });
      // Connects this element event to the handler that should run next.
      el.addEventListener('mouseleave', () => {
        const n = notifications.find((x) => x.id === el.dataset.id);
        el.style.background = n && !n.is_read ? 'var(--notif-unread-bg,#fefce8)' : 'transparent';
      });
      // Connects this element event to the handler that should run next.
      el.addEventListener('click', async () => {
        const n = notifications.find((x) => x.id === el.dataset.id);
        if (n && !n.is_read) {
          try { await markNotificationRead(n.id); } catch (_) {}
          n.is_read = true;
          updateBadge();
          el.style.fontWeight = '400';
          el.style.background = 'transparent';
          el.querySelector('span[style*="border-radius:50%"]')?.remove();
        }
        const targetLink = n ? getTargetLink(n) : '';
        if (targetLink) {
          window.location.href = targetLink;
        }
      });
    });
  }

  // Helper function for esc HTML used by this script.
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Badge ──────────────────────────────────────────────────────────────

  // Updates badge after the user changes something or data is refreshed.
  function updateBadge() {
    const unread = notifications.filter((n) => !n.is_read).length;
    if (!badge) return;
    if (unread > 0) {
      badge.style.display = 'block';
      badge.textContent = unread > 99 ? '99+' : String(unread);
    } else {
      badge.style.display = 'none';
      badge.textContent = '';
    }
  }

  // ── Fetch + poll ───────────────────────────────────────────────────────

  // Helper function for refresh used by this script.
  async function refresh() {
    if (!currentUserId) return;
    const userId = currentUserId;
    try {
      const result = await fetchNotifications(userId, { limit: 25 });
      if (userId !== currentUserId) return;
      notifications = result;
      fetchError = false;
      hasLoaded = true;
      updateBadge();
      if (isOpen) renderDropdown();
    } catch (err) {
      if (userId !== currentUserId) return;
      fetchError = true;
      if (isOpen) renderDropdown();
      console.warn('Notification fetch failed (non-fatal):', err);
    }
  }

  // Helper function for start polling used by this script.
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(refresh, 30000);   // poll every 30 s
  }

  // ── Toggle dropdown ────────────────────────────────────────────────────

  // Connects this element event to the handler that should run next.
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isOpen = !isOpen;
    dropdown.style.display = isOpen ? 'block' : 'none';
    if (isOpen) {
      positionDropdownForViewport();
      renderDropdown();
      refresh();
    }
  });

  // Waits until the HTML has loaded before running page setup code.
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== bellBtn) {
      isOpen = false;
      dropdown.style.display = 'none';
    }
  });

  // ── Auth ───────────────────────────────────────────────────────────────

  observeAuth(async (user) => {
    clearInterval(pollTimer);
    notifications = [];
    fetchError = false;
    hasLoaded = false;
    currentUserId = user?.id || null;
    updateBadge();
    if (isOpen) renderDropdown();
    if (currentUserId) {
      await refresh();
      startPolling();
    } else {
      notifications = [];
      updateBadge();
      clearInterval(pollTimer);
    }
  });
})();

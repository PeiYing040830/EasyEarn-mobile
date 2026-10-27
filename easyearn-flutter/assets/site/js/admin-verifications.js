import { verificationRequirements, verificationPackageError } from './verification-rules.js?v=20261001b';
/**
 * EasyEarn file note: Handles the admin verifications page behavior and related user interactions.
 */
import { observeAuth, fetchAllProfiles, fetchProfile, updateEmployerVerification } from './supabase-data.js';

(function () {
  'use strict';

  const queueEl = document.getElementById('verification-queue');
  const statusEl = document.getElementById('verification-review-status');
  const filterStatusEl = document.getElementById('verification-status-filter');
  const searchEl = document.getElementById('verification-search');
  const metrics = {
    pending: {
      value: document.getElementById('verification-pending-count'),
      note: document.getElementById('verification-pending-note')
    },
    approved: {
      value: document.getElementById('verification-approved-count'),
      note: document.getElementById('verification-approved-note')
    },
    rejected: {
      value: document.getElementById('verification-rejected-count'),
      note: document.getElementById('verification-rejected-note')
    }
  };

  let currentUser = null;
  let employerProfiles = [];
  let cachedVerificationItems = [];

  // Formats or checks status so later code can use a clean value.
  function normalizeStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'approved') return 'approved';
    if (value === 'rejected') return 'rejected';
    if (value === 'recheck' || value === 'needs recheck') return 'recheck';
    if (value === 'submitted' || value === 'pending review') return 'submitted';
    return 'pending';
  }

  // Updates status after the user changes something or data is refreshed.
  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error');
    if (type) statusEl.classList.add(type);
  }

  // Helper function for status label used by this script.
  function statusLabel(status) {
    const normalized = normalizeStatus(status);
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'recheck') return 'Needs Recheck';
    if (normalized === 'rejected') return 'Rejected';
    if (normalized === 'submitted') return 'Pending Review';
    return 'Pending';
  }

  // Helper function for metric groups used by this script.
  function metricGroups(items) {
    return {
      pending: items.filter((item) => !['approved', 'rejected'].includes(item.normalizedStatus || normalizeStatus(item.payload.status))).length,
      approved: items.filter((item) => (item.normalizedStatus || normalizeStatus(item.payload.status)) === 'approved').length,
      rejected: items.filter((item) => (item.normalizedStatus || normalizeStatus(item.payload.status)) === 'rejected').length
    };
  }

  // Updates metrics after the user changes something or data is refreshed.
  function updateMetrics(items) {
    const groups = metricGroups(items);

    metrics.pending.value.textContent = String(groups.pending);
    metrics.approved.value.textContent = String(groups.approved);
    metrics.rejected.value.textContent = String(groups.rejected);

    metrics.pending.note.textContent = groups.pending ? `${groups.pending} request(s) waiting for review.` : 'No pending requests yet.';
    metrics.approved.note.textContent = groups.approved ? `${groups.approved} request(s) already approved.` : 'No approved requests yet.';
    metrics.rejected.note.textContent = groups.rejected ? `${groups.rejected} request(s) were rejected.` : 'No rejected requests yet.';
  }

  // Runs the employer identity step for this page workflow.
  async function resolveEmployerIdentity(userId) {
    try {
      const remote = await fetchProfile(userId, null);
      return {
        name: remote?.companyName || remote?.businessName || remote?.name || 'Employer',
        email: remote?.email || 'Email not set',
        isVerified: Boolean(remote?.isVerified)
      };
    } catch (error) {
      return {
        name: 'Employer',
        email: 'Email not set',
        isVerified: false
      };
    }
  }

  // Formats or checks doc links so later code can use a clean value.
  function buildDocLinks(payload) {
    const docs = [
      payload.registration ? `<a href="${payload.registration.content}" download="${payload.registration.name}">${verificationRequirements(payload.businessType).registrationLabel}: ${payload.registration.name}</a>` : '',
      payload.contact ? `<a href="${payload.contact.content}" download="${payload.contact.name}">${verificationRequirements(payload.businessType).contactLabel}: ${payload.contact.name}</a>` : ''
    ].filter(Boolean);

    if (!docs.length) return '<p>No uploaded documents found.</p>';
    return docs.map((item) => `<div>${item}</div>`).join('');
  }

  // Formats or checks verification items so later code can use a clean value.
  async function buildVerificationItems() {
    const items = employerProfiles
      .filter((profile) => profile.role === 'employer')
      .map((profile) => ({
        userId: profile.id,
        payload: {
          status: profile.isVerified ? 'approved' : (profile.verificationStatus || 'pending'),
          ssmNumber: profile.ssmNumber || '',
          businessType: profile.businessType || '',
          businessAddress: profile.verificationAddress || profile.location || '',
          registration: profile.registrationDocData
            ? { name: profile.registrationDocName || 'registration-file', content: profile.registrationDocData }
            : null,
          contact: profile.contactDocData
            ? { name: profile.contactDocName || 'contact-proof', content: profile.contactDocData }
            : null
        }
      }));

    if (!items.length) {
      cachedVerificationItems = [];
      return;
    }

    cachedVerificationItems = await Promise.all(items.map(async ({ userId, payload }) => {
      const identity = await resolveEmployerIdentity(userId);
      const documents = [payload.registration, payload.contact].filter(Boolean).length;
      const normalizedStatus = identity.isVerified ? 'approved' : normalizeStatus(payload.status);

      return {
        userId,
        payload,
        identity,
        documents,
        normalizedStatus
      };
    }));
  }

  // Renders queue into the HTML so the user can see it.
  async function renderQueue() {
    if (!queueEl) return;

    if (!cachedVerificationItems.length) {
      updateMetrics([]);
      queueEl.innerHTML = `
        <article class="admin-item">
          <strong>No employer verification requests yet</strong>
          <p>Employer verification requests will appear here once employers submit their verification package.</p>
          <div class="admin-item-meta"><span>Business: -</span><span>Documents: 0</span><span>Status: Empty</span></div>
        </article>
      `;
      return;
    }

    updateMetrics(cachedVerificationItems);

    const statusFilter = filterStatusEl?.value || 'all';
    const query = String(searchEl?.value || '').trim().toLowerCase();
    const filteredItems = cachedVerificationItems.filter(({ payload, identity, normalizedStatus }) => {
      const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
      const haystack = [
        identity.name,
        identity.email,
        payload.ssmNumber,
        payload.businessType,
        payload.businessAddress,
        normalizedStatus,
        statusLabel(normalizedStatus)
      ].join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesStatus && matchesSearch;
    });

    if (!filteredItems.length) {
      queueEl.innerHTML = `
        <article class="admin-item">
          <strong>No matching verification requests</strong>
          <p>Try another status or search keyword.</p>
          <div class="admin-item-meta"><span>Business: -</span><span>Documents: 0</span><span>Status: Empty</span></div>
        </article>
      `;
      return;
    }

    const rendered = filteredItems.map(({ userId, payload, identity, documents, normalizedStatus }) => `
        <article class="admin-item" data-user-id="${userId}">
          <div class="admin-request-head">
            <div>
              <strong>${identity.name}</strong>
              <p>${identity.email}</p>
            </div>
            <span class="admin-status-pill">${statusLabel(normalizedStatus)}</span>
          </div>
          <div class="admin-item-meta">
            <span>Registration: ${verificationRequirements(payload.businessType).individual ? 'Not required for personal hiring' : (payload.ssmNumber || '-')}</span>
            <span>Employer Type: ${verificationRequirements(payload.businessType).employerType || '-'}</span>
            <span>Documents: ${documents}</span>
            <span>Status key: ${normalizedStatus}</span>
          </div>
          <p>${payload.businessAddress || 'Registered address not submitted yet.'}</p>
          <div class="admin-doc-list">${buildDocLinks(payload)}</div>
          <div class="admin-action-row">
            <button type="button" class="btn-primary" data-action="approve" data-user-id="${userId}">Approve</button>
            <button type="button" class="btn-outline" data-action="recheck" data-user-id="${userId}">Request Recheck</button>
            <button type="button" class="btn-outline" data-action="reject" data-user-id="${userId}">Reject</button>
          </div>
        </article>
      `);

    queueEl.innerHTML = rendered.join('');
  }

  // Updates request status after the user changes something or data is refreshed.
  async function updateRequestStatus(userId, nextStatus) {
    try {
      const target = cachedVerificationItems.find((item) => item.userId === userId);
      if (normalizeStatus(nextStatus) === 'approved') {
        const packageError = verificationPackageError(target?.payload || {});
        if (packageError) {
          setStatus(`Cannot approve yet. ${packageError}`, 'is-error');
          return;
        }
      }

      await updateEmployerVerification(userId, {
        verificationStatus: normalizeStatus(nextStatus),
        verificationNotes: normalizeStatus(nextStatus) === 'recheck'
          ? 'Admin requested a recheck. Please update your package and submit again.'
          : normalizeStatus(nextStatus) === 'rejected'
            ? 'Admin rejected this verification package.'
            : '',
        isVerified: normalizeStatus(nextStatus) === 'approved'
      });
      employerProfiles = await fetchAllProfiles();
      await buildVerificationItems();

      setStatus(`Verification request updated to "${statusLabel(nextStatus)}".`, 'is-success');
      await renderQueue();
    } catch (error) {
      console.error('Failed to update verification status:', error);
      setStatus('Unable to update the verification request right now.', 'is-error');
    }
  }

  queueEl?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const { action, userId } = button.dataset;
    if (!action || !userId) return;

    if (action === 'approve') updateRequestStatus(userId, 'approved');
    if (action === 'recheck') updateRequestStatus(userId, 'recheck');
    if (action === 'reject') updateRequestStatus(userId, 'rejected');
  });

  observeAuth(async (user) => {
    currentUser = user;

    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    setStatus('Admin review queue is ready.');
    try {
      employerProfiles = await fetchAllProfiles();
      await buildVerificationItems();
    } catch (error) {
      console.error('Failed to load employer profiles for verification review:', error);
      employerProfiles = [];
      cachedVerificationItems = [];
    }
    await renderQueue();
  });

  filterStatusEl?.addEventListener('change', async () => {
    await renderQueue();
  });

  searchEl?.addEventListener('input', async () => {
    await renderQueue();
  });
})();

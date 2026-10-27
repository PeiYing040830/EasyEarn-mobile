import { escapeHtml } from './html-escape.js';
/**
 * EasyEarn file note: Handles the employer manage jobs page behavior and related user interactions.
 */
import {
  fetchEmployerJobs,
  fetchJobApplicantCounts,
  fetchProfile,
  observeAuth,
  updateJobListingStatus,
  closeExpiredJobs
} from './supabase-data.js';

(function () {
  'use strict';

  const listEl = document.getElementById('manage-jobs-list');
  const statusEl = document.getElementById('manage-jobs-status');

  const countEls = {
    published: document.getElementById('jobs-published-count'),
    draft: document.getElementById('jobs-draft-count'),
    expired: document.getElementById('jobs-expired-count'),
    closed: document.getElementById('jobs-closed-count')
  };

  const noteEls = {
    published: document.getElementById('jobs-published-note'),
    draft: document.getElementById('jobs-draft-note'),
    expired: document.getElementById('jobs-expired-note'),
    closed: document.getElementById('jobs-closed-note')
  };

  // Helper function for notify status used by this script.
  function notifyStatus(message, type = '') {
    const text = String(message || '');
    const shouldShow = type || /\b(saved|published|updated|success|unable|failed|error|cannot)\b/i.test(text);
    if (!shouldShow) return;
    const toastType = type === 'is-error' ? 'error' : type === 'is-success' ? 'success' : /\b(unable|failed|error|cannot)\b/i.test(text) ? 'error' : 'success';
    window.EasyEarnToast?.show(text, toastType);
  }

  // Updates status after the user changes something or data is refreshed.
  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error');
    if (type) statusEl.classList.add(type);
    notifyStatus(message, type);
  }

  // Formats or checks expiry so later code can use a clean value.
  function formatExpiry(dateValue) {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  // Loads counts data so the page can display current information.
  function getCounts(jobs) {
    const counts = {
      published: 0,
      draft: 0,
      expired: 0,
      closed: 0
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    jobs.forEach((job) => {
      const status = String(job.status || '').toLowerCase();
      const expiry = job.expiry_date ? new Date(job.expiry_date) : null;
      const isExpired = expiry && !Number.isNaN(expiry.getTime()) && expiry < today;

      if (status === 'closed' || status === 'removed' || status === 'rejected') {
        counts.closed += 1;
      } else if (status === 'expired' || isExpired) {
        counts.expired += 1;
      } else if (status === 'approved') {
        counts.published += 1;
      } else {
        counts.draft += 1;
      }
    });

    return counts;
  }

  // Updates metrics after the user changes something or data is refreshed.
  function updateMetrics(jobs) {
    const counts = getCounts(jobs);
    if (countEls.published) countEls.published.textContent = String(counts.published);
    if (countEls.draft) countEls.draft.textContent = String(counts.draft);
    if (countEls.expired) countEls.expired.textContent = String(counts.expired);
    if (countEls.closed) countEls.closed.textContent = String(counts.closed);

    if (noteEls.published) noteEls.published.textContent = counts.published ? 'Live listings currently visible.' : 'No live jobs yet.';
    if (noteEls.draft) noteEls.draft.textContent = counts.draft ? 'Drafts and listings awaiting review.' : 'No drafts saved.';
    if (noteEls.expired) noteEls.expired.textContent = counts.expired ? 'These listings need refresh or repost.' : 'No expired jobs.';
    if (noteEls.closed) noteEls.closed.textContent = counts.closed ? 'Closed jobs can be reopened later.' : 'No closed jobs yet.';
  }

  // Creates empty state when the workflow needs a new record or message.
  function createEmptyState() {
    return `
      <article class="employer-item">
        <strong>No job listings yet</strong>
        <p>Use the job form above to create your first listing.</p>
        <div class="employer-item-meta"><span>Status: -</span><span>Applicants: 0</span><span>Expiry: -</span></div>
        <div class="employer-card-actions"><a href="#job-form-section" class="btn-outline">Create first job</a></div>
      </article>
    `;
  }

  // Creates job card when the workflow needs a new record or message.
  function createJobCard(job) {
    const status = String(job.status || 'pending').toLowerCase();
    const actionLabel = status === 'closed' ? 'Request Reopening' : 'Close';
    const nextStatus = status === 'closed' ? 'pending' : 'closed';
    const applicants = Number(job.applicants_count || 0);
    const openings = Number(job.openings_count ?? 1);

    return `
      <article class="employer-item" data-job-id="${escapeHtml(job.id)}">
        <strong>${escapeHtml(job.title || 'Untitled Job')}</strong>
        <p>${escapeHtml(job.description || 'No description added yet.')}</p>
        <div class="employer-item-meta">
          <span>Status: ${escapeHtml(status.charAt(0).toUpperCase() + status.slice(1))}</span>
          <span>Applicants: ${applicants}</span>
          <span>Openings: ${openings}</span>
          <span>Expiry: ${formatExpiry(job.expiry_date)}</span>
        </div>
        <div class="employer-card-actions">
          <a href="manage-jobs.html?edit=${escapeHtml(job.id)}#job-form-section" class="btn-outline">Edit</a>
          <button class="btn-outline manage-job-status-btn" type="button" data-job-id="${escapeHtml(job.id)}" data-next-status="${nextStatus}">${actionLabel}</button>
        </div>
      </article>
    `;
  }

  let currentUserId = '';
  let currentProfile = null;

  // Loads restriction message data so the page can display current information.
  function getRestrictionMessage(profile) {
    const status = String(profile?.accountStatus || 'active').toLowerCase();
    if (status === 'suspended') {
      return 'Your employer account is suspended. Existing job listings are locked and hidden from job seekers.';
    }
    if (status === 'under_review') {
      return 'Your employer account is under review. Job listing changes are temporarily locked.';
    }
    return '';
  }

  // Sets up status buttons when this script is loaded.
  function bindStatusButtons() {
    const restricted = Boolean(getRestrictionMessage(currentProfile));
    listEl?.querySelectorAll('.manage-job-status-btn').forEach((button) => {
      if (restricted) {
        button.disabled = true;
        return;
      }
      // Connects this element event to the handler that should run next.
      button.addEventListener('click', async () => {
        const jobId = button.dataset.jobId;
        const nextStatus = button.dataset.nextStatus;
        if (!jobId || !nextStatus) return;

        const defaultText = button.textContent;
        button.disabled = true;
        button.textContent = nextStatus === 'closed' ? 'Closing...' : 'Reopening...';

        try {
          await updateJobListingStatus(jobId, nextStatus);
          setStatus(`Job status updated to ${nextStatus}.`, 'is-success');
          await loadJobs(currentUserId);
        } catch (error) {
          console.error('Failed to update job status:', error);
          setStatus(error?.message || 'Unable to update this job right now.', 'is-error');
          button.disabled = false;
          button.textContent = defaultText;
        }
      });
    });
  }

  // Loads jobs data so the page can display current information.
  async function loadJobs(userId) {
    currentUserId = userId;
    setStatus('Loading your job listings...');

    try {
      currentProfile = await fetchProfile(userId, null).catch(() => null);
      const restrictionMessage = getRestrictionMessage(currentProfile);
      const jobs = await fetchEmployerJobs(userId);
      const applicantCounts = await fetchJobApplicantCounts(jobs.map((job) => job.id));
      jobs.forEach((job) => { job.applicants_count = applicantCounts[job.id] ?? 0; });
      updateMetrics(jobs);

      if (!jobs.length) {
        if (listEl) listEl.innerHTML = createEmptyState();
        setStatus('No listings yet. Create your first job to start managing it.');
        return;
      }

      if (listEl) {
        listEl.innerHTML = jobs.map(createJobCard).join('');
      }
      bindStatusButtons();
      setStatus(restrictionMessage || 'Your listings are ready to manage.', restrictionMessage ? 'is-error' : 'is-success');
    } catch (error) {
      console.error('Failed to load employer jobs:', error);
      if (listEl) listEl.innerHTML = '<article class="employer-item"><strong>Unable to load job listings or applicant counts.</strong><p>Please refresh to try again.</p></article>';
      setStatus(error?.message || 'Unable to load jobs right now.', 'is-error');
    }
  }

  closeExpiredJobs().catch(() => {});

  observeAuth((user) => {
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    loadJobs(user.id);
  });
})();

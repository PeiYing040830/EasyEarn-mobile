import { escapeHtml } from './html-escape.js';
/**
 * EasyEarn file note: Handles the admin jobs page behavior and related user interactions.
 */
import { observeAuth, fetchJobs, fetchReports, fetchProfilesByIds, updateJobListingStatus } from './supabase-data.js?v=20261002a';

(function () {
  'use strict';

  const queueEl = document.getElementById('admin-jobs-queue');
  const statusEl = document.getElementById('admin-jobs-status');
  const statusFilterEl = document.getElementById('admin-jobs-status-filter');
  const searchEl = document.getElementById('admin-jobs-search');
  const metrics = {
    live: {
      value: document.getElementById('admin-jobs-live-count'),
      note: document.getElementById('admin-jobs-live-note')
    },
    flagged: {
      value: document.getElementById('admin-jobs-flagged-count'),
      note: document.getElementById('admin-jobs-flagged-note')
    },
    removed: {
      value: document.getElementById('admin-jobs-removed-count'),
      note: document.getElementById('admin-jobs-removed-note')
    }
  };

  let currentUser = null;
  let cachedJobs = [];
  let reportCountByJob = new Map();
  let employerNameMap = new Map();
  let activeFilter = 'pending'; // default: show pending review queue

  // Updates status after the user changes something or data is refreshed.
  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error');
    if (type) statusEl.classList.add(type);
  }

  // Helper function for moderation label used by this script.
  function moderationLabel(status) {
    if (status === 'pending' || status === 'open') return 'Pending Review';
    if (status === 'approved') return 'Approved';
    if (status === 'flagged') return 'Flagged';
    if (status === 'removed') return 'Removed';
    if (status === 'closed') return 'Closed';
    if (status === 'expired') return 'Expired';
    return 'Pending Review';
  }

  // ── Filter tabs ───────────────────────────────────────────────────────────

  // Helper function for inject filter tabs used by this script.
  function injectFilterTabs() {
    if (document.getElementById('admin-jobs-filter-tabs')) return;
    const tabs = document.createElement('div');
    tabs.id = 'admin-jobs-filter-tabs';
    tabs.style.cssText = 'display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem;';
    [
      { key: 'pending',  label: 'Pending Review' },
      { key: 'approved', label: 'Approved' },
      { key: 'flagged',  label: 'Flagged' },
      { key: 'removed',  label: 'Removed' },
      { key: 'closed',   label: 'Closed' },
      { key: 'expired',  label: 'Expired' },
      { key: 'all',      label: 'All Jobs' }
    ].forEach(({ key, label }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.filterKey = key;
      btn.className = key === activeFilter ? 'btn-primary' : 'btn-outline';
      btn.style.cssText = 'font-size:.82rem;padding:.35rem .9rem;';
      // Connects this element event to the handler that should run next.
      btn.addEventListener('click', async () => {
        activeFilter = key;
        if (statusFilterEl) statusFilterEl.value = key;
        tabs.querySelectorAll('button').forEach((b) => {
          b.className = b.dataset.filterKey === key ? 'btn-primary' : 'btn-outline';
        });
        await renderQueue();
      });
      tabs.appendChild(btn);
    });
    if (queueEl) queueEl.parentNode?.insertBefore(tabs, queueEl);
  }

  // Formats or checks employer name map so later code can use a clean value.
  async function buildEmployerNameMap(jobs) {
    const employerIds = Array.from(new Set((jobs || []).map((job) => job.employer_id).filter(Boolean)));
    if (!employerIds.length) {
      employerNameMap = new Map();
      return;
    }

    try {
      const profiles = await fetchProfilesByIds(employerIds);
      employerNameMap = new Map(profiles.map((profile) => [
        profile.id,
        profile.companyName || profile.businessName || profile.name || profile.email || 'Employer'
      ]));
    } catch (_error) {
      employerNameMap = new Map();
    }
  }

  async function loadJobReportCounts() {
    const reports = await fetchReports();
    const reportersByJob = new Map();
    for (const report of reports) {
      if (!report.job_id || !report.reporter_id || !['open', 'pending', 'submitted', 'flagged', 'under_review'].includes(String(report.status || '').toLowerCase())) continue;
      if (!reportersByJob.has(report.job_id)) reportersByJob.set(report.job_id, new Set());
      reportersByJob.get(report.job_id).add(report.reporter_id);
    }
    reportCountByJob = new Map(
      Array.from(reportersByJob, ([jobId, reporters]) => [jobId, reporters.size])
    );
  }

  // Updates metrics after the user changes something or data is refreshed.
  function updateMetrics(jobsWithReview) {
    const live = jobsWithReview.filter((item) => item.review.status === 'approved').length;
    const flagged = jobsWithReview.filter((item) => item.review.status === 'flagged').length;
    const removed = jobsWithReview.filter((item) => item.review.status === 'removed').length;
    const pending = jobsWithReview.filter((item) => item.review.status === 'pending').length;
    // 'pending' already includes normalized 'open' jobs (see renderQueue)

    if (metrics.live.value) metrics.live.value.textContent = String(live);
    if (metrics.flagged.value) metrics.flagged.value.textContent = String(flagged);
    if (metrics.removed.value) metrics.removed.value.textContent = String(removed);

    if (metrics.live.note) metrics.live.note.textContent = live ? `${live} job(s) currently approved.` : 'No approved jobs yet.';
    if (metrics.flagged.note) metrics.flagged.note.textContent = flagged ? `${flagged} job(s) marked as suspicious.` : 'No flags yet.';
    if (metrics.removed.note) metrics.removed.note.textContent = removed ? `${removed} job(s) removed from demo view.` : 'No removals yet.';

    setStatus(pending
      ? `${pending} job(s) awaiting review. Total in DB: ${jobsWithReview.length}.`
      : 'No pending jobs right now. All listings have been moderated.');
  }

  // Renders queue into the HTML so the user can see it.
  async function renderQueue() {
    if (!queueEl) return;

    const allWithReview = cachedJobs.filter((job) => String(job.status || '').toLowerCase() !== 'draft').map((job) => {
      let s = String(job.status || 'pending').toLowerCase();
      // DB default is 'open' which means not yet moderated — treat as 'pending'
      if (s === 'open') s = 'pending';
      return { job, review: { status: s } };
    });

    updateMetrics(allWithReview);

    const query = String(searchEl?.value || '').trim().toLowerCase();
    const filtered = allWithReview.filter((item) => {
      const matchesStatus = activeFilter === 'all' || item.review.status === activeFilter;
      const employerName = employerNameMap.get(item.job.employer_id) || 'Employer';
      const haystack = [
        item.job.title,
        item.job.description,
        item.job.category,
        item.job.location,
        item.job.status,
        item.job.pay_rate,
        employerName,
        moderationLabel(item.review.status)
      ].join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesStatus && matchesSearch;
    });

    if (!filtered.length) {
      queueEl.innerHTML = `
        <article class="admin-item">
          <strong>No ${escapeHtml(moderationLabel(activeFilter))} jobs</strong>
          <p>${activeFilter === 'pending'
            ? 'No jobs are waiting for review right now — all postings have been moderated.'
            : `No jobs with status "${escapeHtml(moderationLabel(activeFilter))}" found.`}</p>
          <div class="admin-item-meta"><span>Filter: ${escapeHtml(moderationLabel(activeFilter))}</span></div>
        </article>`;
      return;
    }

    const rendered = await Promise.all(filtered.map(async ({ job, review }) => {
      const employerName = employerNameMap.get(job.employer_id) || 'Employer';
      const pay = job.pay_rate ? `RM${job.pay_rate}` : 'Rate not set';
      const expiry = job.expiry_date || '-';
      const category = job.category || '-';
      const openings = Number(job.openings_count ?? 1);
      const reports = reportCountByJob.get(job.id) || 0;

      return `
        <article class="admin-item" data-job-id="${escapeHtml(job.id)}">
          <div class="admin-request-head">
            <div>
              <strong>${escapeHtml(job.title || 'Untitled job')}</strong>
              <p>${escapeHtml(employerName)}</p>
            </div>
            <span class="admin-status-pill">${escapeHtml(moderationLabel(review.status))}</span>
          </div>
          <div class="admin-item-meta">
            <span>Category: ${escapeHtml(category)}</span>
            <span>Pay: ${escapeHtml(pay)}</span>
            <span>Openings: ${openings}</span>
            <span>Listing: ${escapeHtml(job.status || 'pending')}</span>
            <span>Expiry: ${escapeHtml(expiry)}</span>
            <span>Active reports: ${reports}/5 unique users</span>
          </div>
          <p>${escapeHtml(job.description || 'No job description added yet.')}</p>
          <div class="admin-action-row">
            ${review.status !== 'approved'
              ? `<button type="button" class="btn-primary" data-action="approve" data-job-id="${escapeHtml(job.id)}">Approve</button>`
              : `<button type="button" class="btn-outline" disabled style="opacity:.5;cursor:default;">Approved</button>`}
            ${review.status !== 'flagged'
              ? `<button type="button" class="btn-outline" data-action="flag" data-job-id="${escapeHtml(job.id)}">Flag</button>`
              : `<button type="button" class="btn-outline" disabled style="opacity:.5;cursor:default;">Flagged</button>`}
            ${review.status !== 'removed'
              ? `<button type="button" class="btn-outline" data-action="remove" data-job-id="${escapeHtml(job.id)}">Remove</button>`
              : `<button type="button" class="btn-outline" disabled style="opacity:.5;cursor:default;">Removed</button>`}
          </div>
        </article>`;
    }));

    queueEl.innerHTML = rendered.join('');
  }

  // Handles the action action triggered by the user.
  async function handleAction(jobId, action) {
    const nextStatus = action === 'approve' ? 'approved' : action === 'flag' ? 'flagged' : 'removed';
    try {
      await updateJobListingStatus(jobId, nextStatus);
      cachedJobs = await fetchJobs();
      await buildEmployerNameMap(cachedJobs);
      try {
        await loadJobReportCounts();
      } catch (error) {
        console.warn('Failed to load job report totals:', error);
        reportCountByJob = new Map();
      }
      await renderQueue();
    } catch (error) {
      console.error('Failed to update job moderation:', error);
      setStatus(error?.message || 'Unable to update job moderation right now.', 'is-error');
    }
  }

  queueEl?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    await handleAction(button.dataset.jobId, button.dataset.action);
  });

  observeAuth(async (user) => {
    currentUser = user;
    if (!user) { window.location.href = '../../login.html'; return; }

    injectFilterTabs();
    if (statusFilterEl) statusFilterEl.value = activeFilter;

    try {
      cachedJobs = await fetchJobs();
      await buildEmployerNameMap(cachedJobs);
    } catch (error) {
      console.error('Failed to load admin jobs queue:', error);
      cachedJobs = [];
      setStatus('Unable to load job listings right now. Check Supabase select policy for job_listings.', 'is-error');
    }

    try {
      await loadJobReportCounts();
    } catch (error) {
      console.warn('Failed to load job report totals:', error);
      reportCountByJob = new Map();
    }

    await renderQueue();
  });

  statusFilterEl?.addEventListener('change', async () => {
    activeFilter = statusFilterEl.value || 'pending';
    const tabs = document.getElementById('admin-jobs-filter-tabs');
    tabs?.querySelectorAll('button').forEach((button) => {
      button.className = button.dataset.filterKey === activeFilter ? 'btn-primary' : 'btn-outline';
    });
    await renderQueue();
  });

  searchEl?.addEventListener('input', async () => {
    await renderQueue();
  });
})();

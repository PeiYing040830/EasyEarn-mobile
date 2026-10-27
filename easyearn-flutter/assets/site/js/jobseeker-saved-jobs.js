/**
 * EasyEarn file note: Handles the jobseeker saved jobs page behavior and related user interactions.
 */
import { showApplyModal } from './job-application-modal.js?v=20261007a';
import {
  fetchApplications,
  fetchJobs,
  fetchSavedJobIds,
  removeSavedJob,
  normalizeArray,
  observeAuth
} from './supabase-data.js';

(function () {
  'use strict';

  const listEl   = document.getElementById('saved-jobs-list');
  const totalEl  = document.getElementById('saved-jobs-total');
  const totalNote = document.getElementById('saved-jobs-total-note');
  const liveEl   = document.getElementById('saved-jobs-live');
  const liveNote  = document.getElementById('saved-jobs-live-note');
  const appliedEl = document.getElementById('saved-jobs-applied');
  const appliedNote = document.getElementById('saved-jobs-applied-note');

  let currentUser = null;
  let allJobs     = [];
  let savedJobIds = new Set();
  let applications = [];

  // Formats or checks HTML so later code can use a clean value.
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Formats or checks saved job error so later code can use a clean value.
  function formatSavedJobError(error) {
    const detail = error?.message || error?.details || error?.hint || '';
    return detail
      ? `Unable to update saved jobs right now.\n\nSupabase: ${detail}`
      : 'Unable to update saved jobs right now. Please check Supabase policies for saved_jobs.';
  }

  // Formats or checks job so later code can use a clean value.
  function normalizeJob(job) {
    return {
      id:       job.id,
      title:    job.title || 'Untitled Job',
      company:  job.company || job.company_name || job.employer_name || 'EasyEarn Employer',
      category: job.category || 'General',
      location: job.location || 'Location not specified',
      type:     String(job.job_type || '').toLowerCase() || 'flexible',
      payText:  job.pay_rate != null ? `RM${job.pay_rate}${job.pay_type ? ` / ${job.pay_type}` : ''}` : 'Pay not specified',
      openings: Number(job.openings_count ?? 1),
      description: job.description || 'No description provided.',
      status:   String(job.status || '').toLowerCase(),
      skills:   normalizeArray(job.skill_tags || job.skills)
    };
  }

  // Loads saved jobs data so the page can display current information.
  function getSavedJobs() {
    return allJobs.filter((job) => savedJobIds.has(job.id));
  }

  // Renders stats into the HTML so the user can see it.
  function renderStats(savedJobs) {
    const liveJobs    = savedJobs.filter((j) => j.status === 'approved');
    const appliedJobs = savedJobs.filter((j) => applications.some((a) => a.job_id === j.id));

    if (totalEl)    totalEl.textContent    = String(savedJobs.length);
    if (totalNote)  totalNote.textContent  = savedJobs.length ? `${savedJobs.length} job(s) saved.` : 'No saved jobs yet.';
    if (liveEl)     liveEl.textContent     = String(liveJobs.length);
    if (liveNote)   liveNote.textContent   = liveJobs.length ? `${liveJobs.length} saved job(s) still live.` : 'No live saved jobs right now.';
    if (appliedEl)  appliedEl.textContent  = String(appliedJobs.length);
    if (appliedNote) appliedNote.textContent = appliedJobs.length ? `${appliedJobs.length} already applied.` : 'No saved job applications yet.';
  }

  // Renders saved jobs into the HTML so the user can see it.
  function renderSavedJobs(savedJobs) {
    if (!listEl) return;

    if (!savedJobs.length) {
      listEl.innerHTML = `
        <article class="jobseeker-item saved-job-item">
          <strong>No saved jobs yet</strong>
          <p class="application-company">Save jobs from the Browse Jobs page and they will appear here.</p>
          <div class="jobs-card-actions">
            <button type="button" class="btn-primary interview-action-btn" onclick="document.querySelector('[data-tab=browse]').click()">Browse Jobs</button>
          </div>
        </article>`;
      return;
    }

    listEl.innerHTML = savedJobs.map((job) => {
      const alreadyApplied = applications.some((a) => a.job_id === job.id);
      const isLive = job.status === 'approved';
      const hasOpenings = Number(job.openings || 0) > 0;

      return `
        <article class="jobseeker-item saved-job-item">
          <div class="application-title-row">
            <h3>${escapeHtml(job.title)}</h3>
            <span class="status-pill ${isLive ? 'accepted' : 'reviewed'}">${isLive ? 'Live' : job.status || 'unknown'}</span>
          </div>
          <p class="application-company">${escapeHtml(job.company)}</p>
          <p>${escapeHtml(job.description)}</p>
          <div class="application-meta">
            <span>${escapeHtml(job.location)}</span>
            <span>${escapeHtml(job.payText)}</span>
            <span>${escapeHtml(job.type)}</span>
            <span>${job.openings} opening${job.openings > 1 ? 's' : ''}</span>
          </div>
          <div class="jobs-card-actions saved-jobs-actions">
            <button type="button" class="btn-outline interview-action-btn saved-job-remove-btn" data-job-id="${escapeHtml(job.id)}">Remove</button>
            <button type="button" class="btn-primary interview-action-btn saved-job-apply-btn" data-job-id="${escapeHtml(job.id)}" ${(!isLive || alreadyApplied || !hasOpenings) ? 'disabled' : ''}>
              ${alreadyApplied ? 'Applied ✓' : !isLive ? 'Unavailable' : hasOpenings ? 'Apply' : 'Full'}
            </button>
          </div>
        </article>`;
    }).join('');
  }

  // Helper function for refresh used by this script.
  function refresh() {
    const saved = getSavedJobs();
    renderStats(saved);
    renderSavedJobs(saved);
  }

  listEl?.addEventListener('click', async (event) => {
    const removeBtn = event.target.closest('.saved-job-remove-btn');
    const applyBtn  = event.target.closest('.saved-job-apply-btn');

    if (removeBtn && currentUser) {
      const jobId = removeBtn.dataset.jobId;
      if (!jobId) return;
      removeBtn.disabled = true;
      removeBtn.textContent = 'Removing...';
      try {
        await removeSavedJob(currentUser.id, jobId);
        savedJobIds.delete(jobId);
        refresh();
      } catch (err) {
        console.error('Remove saved job failed:', err);
        removeBtn.disabled = false;
        removeBtn.textContent = 'Remove';
        alert(formatSavedJobError(err));
      }
      return;
    }

    if (applyBtn && currentUser && !applyBtn.disabled) {
      const jobId = applyBtn.dataset.jobId;
      if (!jobId) return;
      showApplyModal({ jobId, userId: currentUser.id, triggerBtn: applyBtn });
    }
  });

  observeAuth(async (user) => {
    currentUser = user;
    if (!user) { window.location.href = '../../login.html'; return; }

    try {
      const [jobsResult, savedIdsResult, appsResult] = await Promise.allSettled([
        fetchJobs(),
        fetchSavedJobIds(user.id),
        fetchApplications(user.id)
      ]);

      allJobs      = (jobsResult.status === 'fulfilled' ? (jobsResult.value || []) : []).map(normalizeJob);
      savedJobIds  = new Set(savedIdsResult.status === 'fulfilled' ? (savedIdsResult.value || []) : []);
      applications = appsResult.status === 'fulfilled' ? (appsResult.value || []) : [];

      refresh();
    } catch (err) {
      console.error('Failed to load saved jobs page:', err);
      if (listEl) listEl.innerHTML = `
        <article class="jobseeker-item saved-job-item">
          <strong>Unable to load saved jobs</strong>
          <p>${escapeHtml(String(err?.message || 'Unknown error'))}</p>
        </article>`;
    }
  });
})();

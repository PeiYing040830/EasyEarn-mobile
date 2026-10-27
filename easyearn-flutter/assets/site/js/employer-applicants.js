/**
 * EasyEarn file note: Handles the employer applicants page behavior and related user interactions.
 */
import {
  fetchEmployerApplications,
  fetchRatingsForReviewees,
  updateApplicationStatus,
  updateInterviewSchedule,
  normalizeArray,
  observeAuth,
  upsertRating,
  fetchRatingsByReviewer,
  markEmployerPaid,
  fetchPaymentByApplication
} from './supabase-data.js';

(function () {
  'use strict';

  // ── Element refs (IDs match applicants.html) ───────────────────────────────
  const listEl        = document.getElementById('employer-applicants-list');
  const interviewModal = document.getElementById('interview-modal');
  const interviewApplicantNameEl = document.getElementById('int-applicant-name');
  const interviewJobTitleEl = document.getElementById('int-job-title');
  const interviewApplicationIdEl = document.getElementById('int-application-id');
  const interviewDateEl = document.getElementById('int-date');
  const interviewLocationEl = document.getElementById('int-location');
  const interviewNotesEl = document.getElementById('int-notes');
  const interviewStatusEl = document.getElementById('int-modal-status');
  const interviewCancelBtn = document.getElementById('int-cancel-btn');
  const interviewSaveBtn = document.getElementById('int-save-btn');

  const stats = {
    applied:  { value: document.getElementById('employer-applicants-applied-count'),  note: document.getElementById('employer-applicants-applied-note'),  share: document.getElementById('employer-applicants-applied-share') },
    reviewed: { value: document.getElementById('employer-applicants-reviewed-count'), note: document.getElementById('employer-applicants-reviewed-note'), share: document.getElementById('employer-applicants-reviewed-share') },
    accepted: { value: document.getElementById('employer-applicants-accepted-count'), note: document.getElementById('employer-applicants-accepted-note'), share: document.getElementById('employer-applicants-accepted-share') },
    rejected: { value: document.getElementById('employer-applicants-rejected-count'), note: document.getElementById('employer-applicants-rejected-note'), share: document.getElementById('employer-applicants-rejected-share') }
  };

  let currentUser = null;
  let applications = [];
  let ratedApplicationIds = new Set(); // track which seekers employer already rated
  let paidApplicationIds  = new Set(); // track which jobs employer has marked paid
  let paymentStatusMap = {};
  let seekerRatingsById = new Map();

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Formats or checks HTML so later code can use a clean value.
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Formats or checks status so later code can use a clean value.
  function normalizeStatus(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('completion') && raw.includes('pend')) return 'completion_pending';
    if (raw.includes('interview')) return 'interview';
    if (raw.includes('complete')) return 'completed';
    if (raw.includes('accept')) return 'accepted';
    if (raw.includes('reject')) return 'rejected';
    if (raw.includes('review')) return 'reviewed';
    return 'pending';
  }

  // Formats or checks status label so later code can use a clean value.
  function formatStatusLabel(status) {
    const map = {
      pending: 'Applied',
      reviewed: 'Reviewed',
      interview: 'Interview',
      accepted: 'Accepted',
      completion_pending: 'Awaiting Confirmation',
      completed: 'Completed',
      rejected: 'Rejected'
    };
    return map[normalizeStatus(status)] || status;
  }

  // Helper function for open interview modal used by this script.
  function openInterviewModal(payload) {
    if (!interviewModal) return;
    if (interviewApplicantNameEl) interviewApplicantNameEl.textContent = payload.seekerName || 'Applicant';
    if (interviewJobTitleEl) interviewJobTitleEl.textContent = payload.jobTitle || 'Job';
    if (interviewApplicationIdEl) interviewApplicationIdEl.value = payload.applicationId || '';
    if (interviewDateEl) interviewDateEl.value = '';
    if (interviewLocationEl) interviewLocationEl.value = '';
    if (interviewNotesEl) interviewNotesEl.value = '';
    if (interviewStatusEl) interviewStatusEl.textContent = '';
    interviewModal.style.display = 'flex';
  }

  // Runs the interview modal step for this page workflow.
  function closeInterviewModal() {
    if (!interviewModal) return;
    interviewModal.style.display = 'none';
    if (interviewStatusEl) interviewStatusEl.textContent = '';
  }

  // Helper function for to utc iso string from local input used by this script.
  function toUtcISOStringFromLocalInput(value) {
    if (!value) return '';
    const localDate = new Date(value);
    if (Number.isNaN(localDate.getTime())) return value;
    return localDate.toISOString();
  }

  // Loads seeker rating summary data so the page can display current information.
  function getSeekerRatingSummary(seekerId) {
    const summary = seekerRatingsById.get(seekerId) || null;
    if (!summary || !summary.count) {
      return {
        badge: 'New seeker',
        details: 'No ratings yet'
      };
    }

    const averageText = Number(summary.average).toFixed(1);
    const reviewLabel = summary.count === 1 ? 'review' : 'reviews';
    return {
      badge: `★ ${averageText}`,
      details: `${summary.count} ${reviewLabel}`
    };
  }

  // ── Charts (Chart.js) ─────────────────────────────────────────────────────

  let lineChart = null;
  let donutChart = null;

  // Helper function for apply line used by this script.
  function applyLine(trend) {
    const canvas = document.getElementById('employer-applicants-line-canvas');
    if (!canvas) return;
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(months[d.getMonth()]);
    }
    const datasets = [
      { label: 'Applied',  data: trend.applied,  borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.12)',  tension: 0.4, pointBackgroundColor: '#f59e0b', pointRadius: 4, pointStyle: 'circle', fill: false },
      { label: 'Reviewed', data: trend.reviewed, borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.12)',  tension: 0.4, pointBackgroundColor: '#d97706', pointRadius: 4, pointStyle: 'circle', fill: false },
      { label: 'Accepted', data: trend.accepted, borderColor: '#8a7068', backgroundColor: 'rgba(138,112,104,0.12)',  tension: 0.4, pointBackgroundColor: '#8a7068', pointRadius: 4, pointStyle: 'circle', fill: false },
      { label: 'Rejected', data: trend.rejected, borderColor: '#7a4f38', backgroundColor: 'rgba(122,79,56,0.12)', tension: 0.4, pointBackgroundColor: '#7a4f38', pointRadius: 4, pointStyle: 'circle', fill: false }
    ];
    if (lineChart) {
      datasets.forEach((ds, i) => { lineChart.data.datasets[i].data = ds.data; });
      lineChart.update();
      return;
    }
    lineChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { usePointStyle: true, font: { size: 11 }, padding: 16 }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  // Updates share after the user changes something or data is refreshed.
  function setShare(el, value, total) {
    if (el) el.textContent = `${total ? Math.round((value / total) * 100) : 0}%`;
  }

  // Helper function for apply pie used by this script.
  function applyPie(values) {
    const canvas = document.getElementById('employer-applicants-donut-canvas');
    if (!canvas) return;
    const colors = ['#f59e0b', '#d97706', '#8a7068', '#7a4f38'];
    const labels = ['Applied', 'Reviewed', 'Accepted', 'Rejected'];
    if (donutChart) {
      donutChart.data.datasets[0].data = values;
      donutChart.update();
      return;
    }
    donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
      options: { responsive: true, cutout: '70%', plugins: { legend: { display: false } } }
    });
  }

  // Formats or checks monthly trend so later code can use a clean value.
  function buildMonthlyTrend(appsList) {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), applied: 0, reviewed: 0, accepted: 0, rejected: 0 });
    }
    appsList.forEach((a) => {
      const date = new Date(a.applied_at || a.created_at || 0);
      const idx = months.findIndex((m) => m.year === date.getFullYear() && m.month === date.getMonth());
      if (idx === -1) return;
      const s = String(a.status || '').toLowerCase();
      if (s.includes('accept') || s.includes('complet')) months[idx].accepted++;
      else if (s.includes('reject'))                     months[idx].rejected++;
      else if (s.includes('review') || s.includes('interview')) months[idx].reviewed++;
      else                                               months[idx].applied++;
    });
    return {
      applied:   months.map((m) => m.applied),
      reviewed:  months.map((m) => m.reviewed),
      accepted:  months.map((m) => m.accepted),
      rejected:  months.map((m) => m.rejected)
    };
  }

  // ── Render Stats ───────────────────────────────────────────────────────────

  // Renders stats into the HTML so the user can see it.
  function renderStats(counts) {
    const total = counts.applied + counts.reviewed + counts.accepted + counts.rejected;
    Object.entries(stats).forEach(([key, g]) => {
      if (g.value) g.value.textContent = String(counts[key] ?? 0);
      setShare(g.share, counts[key] ?? 0, total);
    });
    if (stats.applied.note)   stats.applied.note.textContent   = counts.applied   ? `${counts.applied} total applicants.`   : 'No applicants yet.';
    if (stats.reviewed.note)  stats.reviewed.note.textContent  = counts.reviewed  ? `${counts.reviewed} reviewed or in interview.` : 'No reviewed applicants yet.';
    if (stats.accepted.note)  stats.accepted.note.textContent  = counts.accepted  ? `${counts.accepted} accepted for work.`        : 'No accepted candidates yet.';
    if (stats.rejected.note)  stats.rejected.note.textContent  = counts.rejected  ? `${counts.rejected} rejected.`          : 'No rejected candidates yet.';

    applyPie([counts.applied, counts.reviewed, counts.accepted, counts.rejected]);
    applyLine(buildMonthlyTrend(applications));
  }

  // ── Build Applicant Card ───────────────────────────────────────────────────
  // Each application has _job and _applicant enriched by fetchEmployerApplications

  // Formats or checks applicant card so later code can use a clean value.
  function buildApplicantCard(app) {
    const status       = normalizeStatus(app.status);
    const job          = app._job || {};
    const applicant    = app._applicant || {};
    const seekerName   = applicant.name || applicant.full_name || 'Applicant';
    const seekerEmail  = applicant.email || '';
    const jobTitle     = job.title || 'Untitled Job';
    const appliedAt    = app.applied_at
      ? new Date(app.applied_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Date not available';
    const seekerId     = app.seeker_id || '';
    const ratingSummary = getSeekerRatingSummary(seekerId);

    // ── Action buttons per status ──────────────────────────────────────────
    let actionBtns = '';

    if (status === 'pending') {
      actionBtns = `
        <button type="button" class="btn-primary employer-action-btn review-btn"
          data-application-id="${escapeHtml(app.id)}">
          Mark Reviewed
        </button>
        <button type="button" class="btn-outline employer-action-btn reject-btn"
          data-application-id="${escapeHtml(app.id)}">
          Reject
        </button>`;

    } else if (status === 'reviewed') {
      actionBtns = `
        <button type="button" class="btn-primary employer-action-btn schedule-interview-btn"
          data-application-id="${escapeHtml(app.id)}"
          data-seeker-name="${escapeHtml(seekerName)}"
          data-job-title="${escapeHtml(jobTitle)}">
          Schedule Interview
        </button>
        <button type="button" class="btn-outline employer-action-btn reject-btn"
          data-application-id="${escapeHtml(app.id)}">
          Reject
        </button>`;

    } else if (status === 'interview') {
      actionBtns = `
        <button type="button" class="btn-outline employer-action-btn schedule-interview-btn"
          data-application-id="${escapeHtml(app.id)}"
          data-seeker-name="${escapeHtml(seekerName)}"
          data-job-title="${escapeHtml(jobTitle)}">
          Schedule / Update Interview
        </button>
        <button type="button" class="btn-primary employer-action-btn accept-btn"
          data-application-id="${escapeHtml(app.id)}">
          Accept After Interview
        </button>
        <button type="button" class="btn-outline employer-action-btn reject-btn"
          data-application-id="${escapeHtml(app.id)}">
          Reject
        </button>`;

    } else if (status === 'accepted') {
      actionBtns = `
        <button type="button" class="btn-primary employer-action-btn confirm-complete-btn"
          data-application-id="${escapeHtml(app.id)}"
          data-seeker-id="${escapeHtml(seekerId)}"
          data-seeker-name="${escapeHtml(seekerName)}"
          data-job-title="${escapeHtml(jobTitle)}"
          data-job-id="${escapeHtml(app.job_id || '')}"
          data-employer-name="${escapeHtml(job.company_name || job.employer_name || '')}">
          Confirm Work / Payment
        </button>
        <button type="button" class="btn-outline employer-action-btn dispute-complete-btn"
          data-application-id="${escapeHtml(app.id)}">
          Cancel Confirmation
        </button>`;

    } else if (status === 'completion_pending') {
      actionBtns = `
        <button type="button" class="btn-outline employer-action-btn" disabled>
          Awaiting Job Seeker Payment Confirmation
        </button>`;

    } else if (status === 'completed') {
      const alreadyRated = ratedApplicationIds.has(app.id);
      const alreadyPaid  = paidApplicationIds.has(app.id);
      const payment      = paymentStatusMap[app.id] || null;
      const hasDispute   = payment?.status === 'disputed' || !!payment?.dispute_desc;
      actionBtns = `
        ${alreadyPaid
          ? `<span class="btn-outline employer-action-btn" style="opacity:.7;cursor:default;background:#f0fdf4;color:#16a34a;border-color:#86efac;">💸 Paid</span>`
          : `<button type="button" class="btn-primary employer-action-btn mark-paid-btn"
              data-application-id="${escapeHtml(app.id)}"
              data-seeker-id="${escapeHtml(seekerId)}">
              💸 Mark as Paid
            </button>`
        }
        ${hasDispute
          ? `<span class="btn-outline employer-action-btn" style="opacity:.95;cursor:default;background:#fef2f2;color:#b91c1c;border-color:#fca5a5;">Payment Disputed</span>`
          : ''
        }
        ${alreadyRated
          ? `<button type="button" class="btn-outline employer-action-btn rate-seeker-btn" disabled
              data-application-id="${escapeHtml(app.id)}"
              style="background:#f0fdf4;color:#16a34a;border-color:#86efac;cursor:default;">✅ Rated</button>`
          : `<button type="button" class="btn-outline employer-action-btn rate-seeker-btn"
              data-application-id="${escapeHtml(app.id)}"
              data-seeker-id="${escapeHtml(seekerId)}"
              data-seeker-name="${escapeHtml(seekerName)}">⭐ Rate Seeker</button>`
        }`;
    }

    // Message button stays available once the applicant reaches interview onward.
    const messageBtn = ['interview', 'accepted', 'completion_pending', 'completed'].includes(status) && seekerId
      ? `<button type="button" class="btn-outline employer-action-btn message-btn"
          data-seeker-id="${escapeHtml(seekerId)}"
          data-seeker-name="${escapeHtml(seekerName)}"
          data-job-title="${escapeHtml(jobTitle)}">
          💬 Message
        </button>`
      : '';

    return `
      <article class="employer-item applicant-card">
        <div class="applicant-main">
          <div class="applicant-title-row" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
            <h3 style="margin:0;">${escapeHtml(seekerName)}</h3>
            <span class="status-pill ${escapeHtml(status)}">${escapeHtml(formatStatusLabel(status))}</span>
          </div>
          <p style="margin:2px 0;color:#64748b;font-size:.9rem;">Applied for: <strong>${escapeHtml(jobTitle)}</strong></p>
          ${seekerEmail ? `<p style="margin:2px 0;color:#94a3b8;font-size:.85rem;">${escapeHtml(seekerEmail)}</p>` : ''}
          <div class="employer-rating-row">
            <span class="employer-rating-badge">${escapeHtml(ratingSummary.badge)}</span>
            <span class="employer-rating-copy">${escapeHtml(ratingSummary.details)}</span>
          </div>
          ${status === 'completed' && paymentStatusMap[app.id]?.dispute_desc
            ? `<p style="margin:6px 0;font-size:.9rem;color:#b91c1c;">Payment dispute: ${escapeHtml(paymentStatusMap[app.id].dispute_desc)}</p>`
            : ''
          }
          <p style="margin:4px 0;color:#94a3b8;font-size:.85rem;">Applied on ${escapeHtml(appliedAt)}</p>
          ${app.resume_url ? `<a href="${escapeHtml(app.resume_url)}" target="_blank" download style="display:inline-block;margin-top:6px;font-size:.85rem;color:#6d28d9;font-weight:600;text-decoration:none;">📄 View Resume</a>` : '<p style="margin:4px 0;font-size:.82rem;color:#94a3b8;">No resume attached</p>'}
        </div>
        <div class="jobs-card-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
          ${messageBtn}
          ${actionBtns}
        </div>
      </article>`;
  }

  // ── Render List ────────────────────────────────────────────────────────────

  // Renders applications into the HTML so the user can see it.
  function renderApplications() {
    if (!listEl) return;

    // Show all non-deleted apps; completed ones stay visible so employer can rate
    const visible = applications.filter((a) => !a.deleted_at);

    if (!visible.length) {
      listEl.innerHTML = `
        <article class="employer-item">
          <strong>No applicants yet.</strong>
          <p>Once job seekers apply to your listings, they will appear here.</p>
        </article>`;
      return;
    }

    listEl.innerHTML = visible.map(buildApplicantCard).join('');
  }

  // ── Full Refresh ───────────────────────────────────────────────────────────

  // Helper function for refresh view used by this script.
  async function refreshView() {
    if (!currentUser) return;
    applications = await fetchEmployerApplications(currentUser.id);

    // Reload which applications have already been rated by this employer
    try {
      const existingRatings = await fetchRatingsByReviewer(currentUser.id);
      ratedApplicationIds = new Set(
        (existingRatings || [])
          .filter(r => r.reviewer_role === 'employer' && r.application_id)
          .map(r => r.application_id)
      );
    } catch (e) {
      // keep existing set on error
    }

    // Reload which completed jobs employer has already marked as paid
    try {
      const completedApps = applications.filter(a => normalizeStatus(a.status) === 'completed');
      const paymentChecks = await Promise.all(
        completedApps.map(a => fetchPaymentByApplication(a.id).catch(() => null))
      );
      paymentStatusMap = {};
      completedApps.forEach((app, index) => {
        paymentStatusMap[app.id] = paymentChecks[index] || null;
      });
      paidApplicationIds = new Set(
        paymentChecks
          .filter(p => p && (p.status === 'employer_paid' || p.status === 'confirmed' || p.employer_paid_at))
          .map(p => p.application_id)
      );
    } catch (e) {
      paymentStatusMap = {};
      // keep existing set on error
    }

    const counts = {
    applied:  applications.filter((a) => normalizeStatus(a.status) === 'pending').length,
    reviewed: applications.filter((a) => ['reviewed', 'interview'].includes(normalizeStatus(a.status))).length,
    accepted: applications.filter((a) => ['accepted', 'completion_pending', 'completed'].includes(normalizeStatus(a.status))).length,
    rejected: applications.filter((a) => normalizeStatus(a.status) === 'rejected').length
  };

    renderStats(counts);
    renderApplications();
  }

  // ── Complete Modal ─────────────────────────────────────────────────────────

  const completeModal      = document.getElementById('complete-modal');
  const completeCancelBtn  = document.getElementById('complete-cancel-btn');
  const completeSaveBtn    = document.getElementById('complete-save-btn');
  const completeStatusEl   = document.getElementById('complete-modal-status');

  // Helper function for open complete modal used by this script.
  function openCompleteModal(btn) {
    document.getElementById('complete-application-id').value = btn.dataset.applicationId || '';
    document.getElementById('complete-seeker-id').value      = btn.dataset.seekerId || '';
    document.getElementById('complete-job-id').value         = btn.dataset.jobId || '';
    document.getElementById('complete-applicant-name').textContent = btn.dataset.seekerName || 'Applicant';
    document.getElementById('complete-job-title').textContent      = btn.dataset.jobTitle || 'Job';
    document.getElementById('complete-date').value    = new Date().toISOString().split('T')[0];
    document.getElementById('complete-earnings').value = '';
    if (completeStatusEl) completeStatusEl.textContent = '';
    if (completeSaveBtn) {
      completeSaveBtn.disabled = false;
      completeSaveBtn.textContent = 'Confirm Work / Payment';
    }
    completeModal.style.display = 'flex';
  }

  // Runs the complete modal step for this page workflow.
  function closeCompleteModal() {
    completeModal.style.display = 'none';
  }

  completeCancelBtn?.addEventListener('click', closeCompleteModal);
  completeModal?.addEventListener('click', (e) => { if (e.target === completeModal) closeCompleteModal(); });

  completeSaveBtn?.addEventListener('click', async () => {
    const applicationId = document.getElementById('complete-application-id').value;
    const seekerId      = document.getElementById('complete-seeker-id').value;
    const jobId         = document.getElementById('complete-job-id').value;
    const endDate       = document.getElementById('complete-date').value;
    const earnings      = parseFloat(document.getElementById('complete-earnings').value);

    if (!applicationId) { if (completeStatusEl) completeStatusEl.textContent = 'Application ID missing.'; return; }
    if (!Number.isFinite(earnings) || earnings <= 0) {
      if (completeStatusEl) completeStatusEl.textContent = 'Please enter final earnings greater than RM 0.';
      return;
    }

    completeSaveBtn.disabled = true;
    completeSaveBtn.textContent = 'Confirming…';
    if (completeStatusEl) completeStatusEl.textContent = '';

    try {
      await markEmployerPaid(applicationId, seekerId, earnings);
      await updateApplicationStatus(applicationId, 'completion_pending');

      closeCompleteModal();
      await refreshView();

    } catch (err) {
      console.error('Failed to confirm completion:', err);
      if (completeStatusEl) completeStatusEl.textContent = `Error: ${err.message || err}`;
      completeSaveBtn.disabled = false;
      completeSaveBtn.textContent = 'Confirm Work / Payment';
    }
  });

  // ── Rate Seeker Modal (created dynamically) ────────────────────────────────

  // Helper function for open rate seeker modal used by this script.
  function openRateSeekerModal({ applicationId, seekerId, seekerName }) {
    const MODAL_ID = 'rate-seeker-modal';

    if (!document.getElementById(MODAL_ID)) {
      const el = document.createElement('div');
      el.id = MODAL_ID;
      el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;align-items:center;justify-content:center;';
      el.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:32px;max-width:460px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2);">
          <h2 style="margin-bottom:6px;">⭐ Rate Seeker</h2>
          <p id="rsm-desc" style="color:#64748b;margin-bottom:20px;"></p>
          <div id="rsm-stars-row" style="display:flex;gap:.5rem;margin-bottom:16px;">
            ${[1,2,3,4,5].map((n) => `<button type="button" class="rsm-star-btn" data-star="${n}"
              style="font-size:2rem;background:none;border:none;cursor:pointer;color:#d1d5db;transition:color .15s;"
              aria-label="${n} star">★</button>`).join('')}
          </div>
          <input type="hidden" id="rsm-star-value" value="5">
          <textarea id="rsm-review-text" rows="3"
            placeholder="How was working with this seeker? (optional)"
            style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:.625rem;resize:vertical;font-family:inherit;margin-bottom:12px;"></textarea>
          <p id="rsm-status" style="font-size:.85rem;color:#ef4444;min-height:18px;margin-bottom:12px;"></p>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" id="rsm-skip-btn" class="btn-outline">Skip</button>
            <button type="button" id="rsm-submit-btn" class="btn-primary">Submit Rating</button>
          </div>
        </div>`;
      document.body.appendChild(el);

      // Star hover / click
      const starsRow = el.querySelector('#rsm-stars-row');
      const starInput = el.querySelector('#rsm-star-value');
      // Connects this element event to the handler that should run next.
      starsRow.addEventListener('mouseover', (e) => {
        const b = e.target.closest('.rsm-star-btn');
        if (!b) return;
        const v = Number(b.dataset.star);
        starsRow.querySelectorAll('.rsm-star-btn').forEach((s) => {
          s.style.color = Number(s.dataset.star) <= v ? '#f59e0b' : '#d1d5db';
        });
      });
      // Connects this element event to the handler that should run next.
      starsRow.addEventListener('mouseleave', () => {
        const v = Number(starInput.value);
        starsRow.querySelectorAll('.rsm-star-btn').forEach((s) => {
          s.style.color = Number(s.dataset.star) <= v ? '#f59e0b' : '#d1d5db';
        });
      });
      // Connects this element event to the handler that should run next.
      starsRow.addEventListener('click', (e) => {
        const b = e.target.closest('.rsm-star-btn');
        if (!b) return;
        starInput.value = b.dataset.star;
        starsRow.querySelectorAll('.rsm-star-btn').forEach((s) => {
          s.style.color = Number(s.dataset.star) <= Number(b.dataset.star) ? '#f59e0b' : '#d1d5db';
        });
      });
      // Default: 5 stars lit
      starsRow.querySelectorAll('.rsm-star-btn').forEach((s) => { s.style.color = '#f59e0b'; });

      el.querySelector('#rsm-skip-btn').addEventListener('click', () => { el.style.display = 'none'; });
      // Connects this element event to the handler that should run next.
      el.addEventListener('click', (e) => { if (e.target === el) el.style.display = 'none'; });
    }

    const modal = document.getElementById(MODAL_ID);
    modal.querySelector('#rsm-desc').textContent = `How was your experience with ${seekerName}?`;
    modal.querySelector('#rsm-review-text').value = '';
    modal.querySelector('#rsm-status').textContent = '';
    modal.querySelector('#rsm-star-value').value = '5';
    modal.querySelectorAll('.rsm-star-btn').forEach((s) => { s.style.color = '#f59e0b'; });
    modal.style.display = 'flex';

    const submitBtn = modal.querySelector('#rsm-submit-btn');
    submitBtn.onclick = async () => {
      const stars  = Number(modal.querySelector('#rsm-star-value').value) || 5;
      const review = modal.querySelector('#rsm-review-text').value.trim();
      const statusEl = modal.querySelector('#rsm-status');

      if (!currentUser) { statusEl.textContent = 'Not logged in.'; return; }
      if (!seekerId)    { statusEl.textContent = 'Seeker info missing.'; return; }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      statusEl.textContent = '';

      try {
        await upsertRating({
          reviewer_id:    currentUser.id,
          reviewee_id:    seekerId,
          application_id: applicationId,
          stars,
          review,
          reviewer_role:  'employer'
        });
        ratedApplicationIds.add(applicationId);
        modal.style.display = 'none';
        // Re-render the card so the button becomes locked
        renderApplications();
      } catch (err) {
        statusEl.textContent = 'Failed to submit: ' + (err.message || err);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Rating';
      }
    };
  }

  // ── Event Delegation ───────────────────────────────────────────────────────

  listEl?.addEventListener('click', async (event) => {

    // Confirm work and payment
    const confirmBtn = event.target.closest('.confirm-complete-btn');
    if (confirmBtn) {
      openCompleteModal(confirmBtn);
      return;
    }

    const disputeBtn = event.target.closest('.dispute-complete-btn');
    if (disputeBtn) {
      const appId = disputeBtn.dataset.applicationId;
      if (!appId) return;
      if (!confirm('Cancel this confirmation and move the application back to reviewed status?')) return;
      disputeBtn.disabled = true;
      disputeBtn.textContent = 'Saving...';
      try {
        await updateApplicationStatus(appId, 'reviewed');
        await refreshView();
      } catch (err) {
        disputeBtn.disabled = false;
        alert('Failed to save. Please try again.');
      }
      return;
    }

    // Mark as Paid
    const paidBtn = event.target.closest('.mark-paid-btn');
    if (paidBtn) {
      alert('Please use Confirm Work / Payment and enter the final earnings amount.');
      return;
    }

    // Rate Seeker (from completed card)
    const rateBtn = event.target.closest('.rate-seeker-btn');
    if (rateBtn) {
      openRateSeekerModal({
        applicationId: rateBtn.dataset.applicationId,
        seekerId:      rateBtn.dataset.seekerId,
        seekerName:    rateBtn.dataset.seekerName || 'Seeker'
      });
      return;
    }

    const scheduleInterviewBtn = event.target.closest('.schedule-interview-btn');
    if (scheduleInterviewBtn && !scheduleInterviewBtn.disabled) {
      openInterviewModal({
        applicationId: scheduleInterviewBtn.dataset.applicationId,
        seekerName: scheduleInterviewBtn.dataset.seekerName || 'Applicant',
        jobTitle: scheduleInterviewBtn.dataset.jobTitle || 'Job'
      });
      return;
    }

    // Mark Reviewed
    const reviewBtn = event.target.closest('.review-btn');
    if (reviewBtn && !reviewBtn.disabled) {
      reviewBtn.disabled = true;
      try {
        await updateApplicationStatus(reviewBtn.dataset.applicationId, 'reviewed');
        await refreshView();
      } catch (err) {
        alert('Failed to update: ' + err.message);
        reviewBtn.disabled = false;
      }
      return;
    }

    // Accept
    const acceptBtn = event.target.closest('.accept-btn');
    if (acceptBtn && !acceptBtn.disabled) {
      acceptBtn.disabled = true;
      try {
        await updateApplicationStatus(acceptBtn.dataset.applicationId, 'accepted');
        await refreshView();
      } catch (err) {
        alert('Failed to accept: ' + err.message);
        acceptBtn.disabled = false;
      }
      return;
    }

    // Reject
    const rejectBtn = event.target.closest('.reject-btn');
    if (rejectBtn && !rejectBtn.disabled) {
      if (!confirm('Reject this applicant?')) return;
      rejectBtn.disabled = true;
      try {
        await updateApplicationStatus(rejectBtn.dataset.applicationId, 'rejected');
        await refreshView();
      } catch (err) {
        alert('Failed to reject: ' + err.message);
        rejectBtn.disabled = false;
      }
      return;
    }

    // Message seeker
    const messageBtn = event.target.closest('.message-btn');
    if (messageBtn) {
      const params = new URLSearchParams({
        user: messageBtn.dataset.seekerId,
        name: messageBtn.dataset.seekerName || 'Seeker',
        job:  messageBtn.dataset.jobTitle || 'Job conversation'
      });
window.location.href = `messages.html?${params.toString()}`;
    }
  });

  interviewCancelBtn?.addEventListener('click', closeInterviewModal);
  interviewModal?.addEventListener('click', (event) => {
    if (event.target === interviewModal) closeInterviewModal();
  });

  interviewSaveBtn?.addEventListener('click', async () => {
    const applicationId = interviewApplicationIdEl?.value || '';
    const interviewDate = interviewDateEl?.value || '';
    const interviewLocation = interviewLocationEl?.value.trim() || '';
    const interviewNotes = interviewNotesEl?.value.trim() || '';

    if (!applicationId) return;
    if (!interviewDate) {
      if (interviewStatusEl) interviewStatusEl.textContent = 'Please choose the interview date and time.';
      return;
    }
    if (!interviewLocation) {
      if (interviewStatusEl) interviewStatusEl.textContent = 'Please enter the interview location or platform.';
      return;
    }

    interviewSaveBtn.disabled = true;
    if (interviewStatusEl) interviewStatusEl.textContent = 'Saving interview...';

    try {
      await updateInterviewSchedule(applicationId, {
        interview_date: toUtcISOStringFromLocalInput(interviewDate),
        interview_location: interviewLocation,
        interview_notes: interviewNotes
      });
      await updateApplicationStatus(applicationId, 'interview');
      closeInterviewModal();
      await refreshView();
    } catch (err) {
      if (interviewStatusEl) interviewStatusEl.textContent = `Failed to save interview: ${err.message}`;
    } finally {
      interviewSaveBtn.disabled = false;
    }
  });

  // ── Auth / Init ────────────────────────────────────────────────────────────

  observeAuth(async (user) => {
    currentUser = user;
    if (!user) { window.location.href = '../../login.html'; return; }

    try {
      applications = await fetchEmployerApplications(user.id);

      // Load which applications this employer has already rated
      try {
        const existingRatings = await fetchRatingsByReviewer(user.id);
        ratedApplicationIds = new Set(
          (existingRatings || [])
            .filter(r => r.reviewer_role === 'employer' && r.application_id)
            .map(r => r.application_id)
        );
      } catch (e) {
        ratedApplicationIds = new Set();
      }

      // Load which completed jobs employer has already marked as paid
      try {
        const completedApps = applications.filter(a => normalizeStatus(a.status) === 'completed');
        const paymentChecks = await Promise.all(
          completedApps.map(a => fetchPaymentByApplication(a.id).catch(() => null))
        );
        paymentStatusMap = {};
        completedApps.forEach((app, index) => {
          paymentStatusMap[app.id] = paymentChecks[index] || null;
        });
        paidApplicationIds = new Set(
          paymentChecks
            .filter(p => p && (p.status === 'employer_paid' || p.status === 'confirmed' || p.employer_paid_at))
            .map(p => p.application_id)
        );
      } catch (e) {
        paymentStatusMap = {};
        paidApplicationIds = new Set();
      }

      try {
        const seekerIds = Array.from(new Set(applications.map((item) => item.seeker_id).filter(Boolean)));
        const ratings = await fetchRatingsForReviewees(seekerIds);
        seekerRatingsById = ratings.reduce((map, rating) => {
          const key = rating.reviewee_id;
          if (!key) return map;
          const current = map.get(key) || { totalStars: 0, count: 0, average: 0 };
          current.totalStars += Number(rating.stars || 0);
          current.count += 1;
          current.average = current.count ? current.totalStars / current.count : 0;
          map.set(key, current);
          return map;
        }, new Map());
      } catch (e) {
        seekerRatingsById = new Map();
      }

    const counts = {
      applied:  applications.filter((a) => normalizeStatus(a.status) === 'pending').length,
      reviewed: applications.filter((a) => ['reviewed', 'interview'].includes(normalizeStatus(a.status))).length,
      accepted: applications.filter((a) => ['accepted', 'completion_pending', 'completed'].includes(normalizeStatus(a.status))).length,
      rejected: applications.filter((a) => normalizeStatus(a.status) === 'rejected').length
    };

      renderStats(counts);
      renderApplications();
    } catch (err) {
      console.error('Failed to load employer applicants page:', err);
      if (listEl) listEl.innerHTML = `
        <article class="employer-item">
          <strong>Unable to load applicants.</strong>
          <p>${escapeHtml(String(err?.message || 'Unknown error'))}</p>
        </article>`;
    }
  });

})();

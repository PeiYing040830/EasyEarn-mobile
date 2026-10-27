/**
 * EasyEarn file note: Handles the jobseeker applications page behavior and related user interactions.
 */
import {
  fetchApplications,
  localCalendarDate,
  fetchJobListing,
  updateApplicationStatus,
  deleteApplication,
  observeAuth,
  upsertRating,
  fetchRatingsByReviewer,
  fetchPaymentByApplication,
  confirmPaymentReceived,
  raisePaymentDisputeAndCreateReportByApplication,
  createReport,
  insertWorkHistory
} from './supabase-data.js?v=20261002a';
import { getReportReason, reportReasonOptions } from './report-reasons.js';

(function () {
  'use strict';

  // ── Element refs — IDs match applications.html ─────────────────────────────
  let lineChart = null;
  let donutChart = null;
  const listEl    = document.getElementById('applications-live-list');
  const completedListEl = document.getElementById('completed-jobs-list');

  const stats = {
    inreview:  { value: document.getElementById('applications-inreview-count'),  note: document.getElementById('applications-inreview-note'),  share: document.getElementById('applications-pending-share') },
    active:    { value: document.getElementById('applications-active-count'),    note: document.getElementById('applications-active-note'),    share: document.getElementById('applications-reviewed-share') },
    completed: { value: document.getElementById('applications-completed-count'), note: document.getElementById('applications-completed-note'), share: document.getElementById('applications-completed-share') },
    rejected:  { value: document.getElementById('applications-rejected-count'),  note: document.getElementById('applications-rejected-note'),  share: document.getElementById('applications-rejected-share') }
  };


  let currentUser = null;
  let applications = [];      // enriched with _job
  let ratedBySeeker = new Set();
  let paymentStatusMap = {};  // appId → payment row (or null)
  let activeFilter = 'all';

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
      pending:            'Pending',
      reviewed:           'Reviewed',
      interview:          'Interview',
      accepted:           'Accepted',
      completion_pending: 'Completion Pending',
      completed:          'Completed',
      rejected:           'Rejected'
    };
    return map[status] || status;
  }

  // Loads status group data so the page can display current information.
  function getStatusGroup(status) {
    const normalized = normalizeStatus(status);
    if (['pending', 'reviewed'].includes(normalized)) return 'inreview';
    if (['interview', 'accepted', 'completion_pending'].includes(normalized)) return 'active';
    if (normalized === 'completed') return 'completed';
    if (normalized === 'rejected') return 'rejected';
    return 'inreview';
  }

  // Formats or checks status timeline so later code can use a clean value.
  function buildStatusTimeline(status, appliedAt) {
    const normalized = normalizeStatus(status);
    const isRejected = normalized === 'rejected';
    const indexMap = {
      pending: 0,
      reviewed: 1,
      interview: 2,
      accepted: 3,
      completion_pending: 4,
      completed: 5,
      rejected: 5
    };
    const currentIndex = indexMap[normalized] ?? 0;
    const appliedLabel = appliedAt === 'Date not available' ? 'Submitted' : appliedAt;
    const steps = [
      { label: 'Applied', note: appliedLabel },
      { label: 'Reviewed', note: 'Employer review' },
      { label: 'Interview', note: 'Interview scheduled' },
      { label: 'Accepted', note: 'Employer decision' },
      { label: 'Completion Pending', note: 'Confirm payment received' },
      { label: isRejected ? 'Rejected' : 'Completed', note: isRejected ? 'Application closed' : 'Work history ready' }
    ];

    return `
      <div class="application-status-timeline" aria-label="Application status timeline">
        ${steps.map((step, index) => {
          const classes = ['application-status-step'];
          if (index < currentIndex && !isRejected) classes.push('is-done');
          if (index === currentIndex) classes.push(isRejected ? 'is-rejected' : 'is-current');
          if (isRejected && index === 0) classes.push('is-done');
          return `
            <div class="${classes.join(' ')}">
              <span class="application-status-dot"></span>
              <strong>${escapeHtml(step.label)}</strong>
              <small>${escapeHtml(step.note)}</small>
            </div>`;
        }).join('')}
      </div>
    `;
  }

  // ── Charts ─────────────────────────────────────────────────────────────────

  // Helper function for apply line used by this script.
  function applyLine(trend) {
    const canvas = document.getElementById('applications-line-canvas');
    if (!canvas) return;
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(months[d.getMonth()]);
    }
    const datasets = [
      { label: 'In Review', data: trend.inreview,  borderColor: '#93c5fd', backgroundColor: 'rgba(147,197,253,0.12)', tension: 0.4, pointBackgroundColor: '#93c5fd', pointRadius: 4, pointStyle: 'circle', fill: false },
      { label: 'Active',    data: trend.active,    borderColor: '#86efac', backgroundColor: 'rgba(134,239,172,0.12)',  tension: 0.4, pointBackgroundColor: '#86efac', pointRadius: 4, pointStyle: 'circle', fill: false },
      { label: 'Completed', data: trend.completed, borderColor: '#a5b4fc', backgroundColor: 'rgba(165,180,252,0.12)',tension: 0.4, pointBackgroundColor: '#a5b4fc', pointRadius: 4, pointStyle: 'circle', fill: false },
      { label: 'Rejected',  data: trend.rejected,  borderColor: '#fca5a5', backgroundColor: 'rgba(252,165,165,0.12)',tension: 0.4, pointBackgroundColor: '#fca5a5', pointRadius: 4, pointStyle: 'circle', fill: false }
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
  function applyPie(counts) {
    const canvas = document.getElementById('applications-donut-canvas');
    if (!canvas) return;
    const colors = ['#93c5fd', '#86efac', '#a5b4fc', '#fca5a5'];
    const labels = ['In Review', 'Active', 'Completed', 'Rejected'];
    const values = [counts.inreview, counts.active, counts.completed, counts.rejected];
    if (donutChart) {
      donutChart.data.datasets[0].data = values;
      donutChart.update();
      return;
    }
    donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
    });
  }

  // Formats or checks monthly trend so later code can use a clean value.
  function buildMonthlyTrend(appsList) {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), inreview: 0, active: 0, completed: 0, rejected: 0 });
    }
    appsList.forEach((a) => {
      const date = new Date(a.applied_at || a.created_at || 0);
      const idx = months.findIndex((m) => m.year === date.getFullYear() && m.month === date.getMonth());
      if (idx === -1) return;
      const s = normalizeStatus(a.status);
      months[idx][getStatusGroup(s)]++;
    });
    return {
      inreview:  months.map((m) => m.inreview),
      active:    months.map((m) => m.active),
      completed: months.map((m) => m.completed),
      rejected:  months.map((m) => m.rejected)
    };
  }

  // ── Render Stats ───────────────────────────────────────────────────────────

  // Helper function for count applications used by this script.
  function countApplications() {
    const c = { inreview: 0, active: 0, rejected: 0, completed: 0 };
    applications.forEach((a) => {
      const s = normalizeStatus(a.status);
      c[getStatusGroup(s)]++;
    });
    return c;
  }

  // Renders stats into the HTML so the user can see it.
  function renderStats() {
    const c = countApplications();
    const total = Object.values(c).reduce((s, v) => s + v, 0);

    const notes = {
      inreview:  c.inreview  ? `${c.inreview} application(s) pending or reviewed.` : 'No applications under review yet.',
      active:    c.active    ? `${c.active} interview, accepted, or payment confirmation job(s).`        : 'No active jobs yet.',
      completed: c.completed ? `${c.completed} completed jobs.`                          : 'No completed jobs yet.',
      rejected:  c.rejected  ? `${c.rejected} rejected.`                                : 'No rejected applications yet.'
    };

    Object.entries(stats).forEach(([key, g]) => {
      if (g.value) g.value.textContent = String(c[key]);
      if (g.note)  g.note.textContent  = notes[key];
      setShare(g.share, c[key], total);
    });

    applyPie(c);
    applyLine(buildMonthlyTrend(applications));
  }

  // ── Build Application Card ─────────────────────────────────────────────────

  // Formats or checks application card so later code can use a clean value.
  function buildApplicationCard(app) {
    const status    = normalizeStatus(app.status);
    const job       = app._job || {};
    const jobTitle  = job.title || 'Untitled Job';
    const company   = job.company_name || job.employer_name || 'Employer';
    const location  = job.location || '';
    const appliedAt = app.applied_at
      ? new Date(app.applied_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Date not available';

    const alreadyRated = ratedBySeeker.has(app.id);

    let actionBtns = '';

    if (status === 'interview') {
      actionBtns = `
        <a href="interviews.html" class="btn-primary seeker-action-btn" style="text-decoration:none;text-align:center;">
          View Interview Details
        </a>
        <button type="button" class="btn-outline seeker-action-btn cancel-application-btn"
          data-application-id="${escapeHtml(app.id)}"
          data-job-title="${escapeHtml(jobTitle)}">
          Cancel Application
        </button>`;

    } else if (status === 'pending' || status === 'reviewed') {
      actionBtns = `
        <button type="button" class="btn-outline seeker-action-btn cancel-application-btn"
          data-application-id="${escapeHtml(app.id)}"
          data-job-title="${escapeHtml(jobTitle)}">
          Cancel Application
        </button>`;

    } else if (status === 'accepted') {
      actionBtns = `
        <button type="button" class="btn-outline seeker-action-btn" disabled>
          Waiting for Employer Completion / Payment
        </button>`;

    } else if (status === 'completion_pending') {
      const payment = paymentStatusMap[app.id];
      const employerPaid = !!(payment?.employer_paid_at || payment?.status === 'employer_paid' || payment?.status === 'confirmed');
      actionBtns = `
        <button type="button" class="btn-primary seeker-action-btn confirm-payment-btn"
          data-application-id="${escapeHtml(app.id)}"
          data-employer-paid="${employerPaid ? 'true' : 'false'}"
          title="Confirm you received payment to complete this job and save it to Work History.">
          Confirm Payment Received
        </button>`;

    } else if (status === 'completed') {
      if (alreadyRated) {
        actionBtns = `<button type="button" class="btn-outline seeker-action-btn" disabled style="opacity:.6;cursor:default;">Rated</button>`;
      } else {
        actionBtns = `
          <button type="button" class="btn-outline seeker-action-btn rate-employer-btn"
            data-application-id="${escapeHtml(app.id)}"
            data-employer-id="${escapeHtml(job.employer_id || '')}"
            data-employer-name="${escapeHtml(company)}">
            Rate Employer
          </button>`;
      }
    }

    const employerId = job.employer_id || '';
    const reportBtn = `
      <button type="button" class="report-employer-btn"
        data-application-id="${escapeHtml(app.id)}"
        data-job-id="${escapeHtml(job.id || app.job_id || '')}"
        data-employer-id="${escapeHtml(employerId)}"
        data-employer-name="${escapeHtml(company)}"
        data-job-title="${escapeHtml(jobTitle)}"
        style="background:none;border:none;cursor:pointer;font-size:.8rem;color:#94a3b8;padding:4px 8px;border-radius:6px;"
        title="Report this employer">
        🚩 Report
      </button>`;

    return `
      <article class="jobseeker-item application-item">
        <div class="application-main">
          <div class="application-title-row">
            <h3>${escapeHtml(jobTitle)}</h3>
            <span class="status-pill ${escapeHtml(status)}">${escapeHtml(formatStatusLabel(status))}</span>
          </div>
          <div class="application-summary">
            <p class="application-company">${escapeHtml(company)}${location ? ` · ${escapeHtml(location)}` : ''}</p>
            <p style="color:#94a3b8;font-size:.85rem;">Applied on ${escapeHtml(appliedAt)}</p>
          </div>
          ${buildStatusTimeline(status, appliedAt)}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:${actionBtns ? '10px' : '6px'};">
          ${actionBtns ? `<div class="jobs-card-actions" style="display:flex;gap:8px;flex-wrap:wrap;">${actionBtns}</div>` : '<div></div>'}
          ${reportBtn}
        </div>
      </article>`;
  }

  // ── Render Lists ───────────────────────────────────────────────────────────

  // Loads filtered apps data so the page can display current information.
  function getFilteredApps() {
    const all = applications.filter((a) => !a.deleted_at);
    if (activeFilter === 'all') return all;
    if (activeFilter === 'active') return all.filter((a) => ['pending', 'reviewed', 'interview', 'accepted', 'completion_pending'].includes(normalizeStatus(a.status)));
    if (activeFilter === 'rejected') return all.filter((a) => normalizeStatus(a.status) === 'rejected');
    return all;
  }

  // Renders applications into the HTML so the user can see it.
  function renderApplications() {
    if (!listEl) return;

    const visible = getFilteredApps().filter((a) => normalizeStatus(a.status) !== 'completed');

    if (!visible.length) {
      listEl.innerHTML = `
        <article class="jobseeker-item application-item">
          <div class="application-main">
            <div class="application-title-row">
              <h3>No applications found</h3>
              <span class="status-pill pending">Empty</span>
            </div>
            <div class="application-summary">
              <p>No applications match this filter yet.</p>
            </div>
          </div>
        </article>`;
      return;
    }

    listEl.innerHTML = visible.map(buildApplicationCard).join('');
  }

  // Renders completed jobs into the HTML so the user can see it.
  function renderCompletedJobs() {
    if (!completedListEl) return;

    const completed = applications.filter((a) => !a.deleted_at && normalizeStatus(a.status) === 'completed');

    if (!completed.length) {
      completedListEl.innerHTML = `
        <article class="jobseeker-item application-item">
          <div class="application-main">
            <div class="application-title-row">
              <h3>No completed jobs yet</h3>
              <span class="status-pill accepted">Empty</span>
            </div>
            <div class="application-summary">
              <p>Once an accepted job is marked complete and confirmed, it will appear here and be saved to your Work History.</p>
            </div>
          </div>
        </article>`;
      return;
    }

    completedListEl.innerHTML = completed.map(buildApplicationCard).join('');
  }

  // Renders all into the HTML so the user can see it.
  function renderAll() {
    renderStats();
    renderApplications();
    renderCompletedJobs();
  }

  // ── Filter Buttons ─────────────────────────────────────────────────────────

  ['filter-all', 'filter-active', 'filter-rejected'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      activeFilter = id.replace('filter-', '');
      document.querySelectorAll('#filter-all,#filter-active,#filter-rejected').forEach((btn) => {
        btn.className = btn.id === id ? 'btn-primary' : 'btn-outline';
      });
      renderApplications();
    });
  });

  // ── Enrich applications with job data ─────────────────────────────────────

  // Helper function for enrich with jobs used by this script.
  async function enrichWithJobs(appsList) {
    const jobIds = [...new Set(appsList.map((a) => a.job_id).filter(Boolean))];
    const jobMap = new Map();
    await Promise.all(jobIds.map(async (id) => {
      try {
        const job = await fetchJobListing(id);
        if (job) jobMap.set(id, job);
      } catch (_) {}
    }));
    return appsList.map((a) => ({ ...a, _job: jobMap.get(a.job_id) || null }));
  }

  // ── Full Refresh ───────────────────────────────────────────────────────────

  // Helper function for refresh view used by this script.
  async function refreshView() {
    if (!currentUser) return;
    const raw = await fetchApplications(currentUser.id);
    applications = await enrichWithJobs(raw);

    try {
      const myRatings = await fetchRatingsByReviewer(currentUser.id);
      ratedBySeeker = new Set(
        (myRatings || [])
          .filter((r) => r.reviewer_role === 'seeker' && r.application_id)
          .map((r) => r.application_id)
      );
    } catch (_) {
      ratedBySeeker = new Set();
    }

    // Fetch payment status for applications that can show payment actions.
    try {
      const completedApps = applications.filter(a => ['completion_pending', 'completed'].includes(normalizeStatus(a.status)));
      const payments = await Promise.all(
        completedApps.map(a => fetchPaymentByApplication(a.id).catch(() => null))
      );
      paymentStatusMap = {};
      completedApps.forEach((a, i) => { paymentStatusMap[a.id] = payments[i] || null; });
    } catch (_) {
      paymentStatusMap = {};
    }

    renderAll();
  }

  // ── Work History Modal ─────────────────────────────────────────────────────

  const whModal     = document.getElementById('work-history-modal');
  const whCancelBtn = document.getElementById('wh-cancel-btn');
  const whSaveBtn   = document.getElementById('wh-save-btn');
  const whStatus    = document.getElementById('wh-modal-status');

  // Helper function for open wh modal used by this script.
  function openWhModal(app) {
    const job = app._job || {};
    document.getElementById('wh-application-id').value = app.id || '';
    document.getElementById('wh-employer-id').value    = job.employer_id || '';
    document.getElementById('wh-job-title').value      = job.title || '';
    document.getElementById('wh-employer-name').value  = job.company_name || job.employer_name || '';
    document.getElementById('wh-category').value       = job.category || '';
    document.getElementById('wh-start-date').value     = '';
    document.getElementById('wh-end-date').value       = localCalendarDate();
    if (whStatus) whStatus.textContent = '';
    whModal.style.display = 'flex';
  }

  // Runs the wh modal step for this page workflow.
  function closeWhModal() { whModal.style.display = 'none'; }

  whCancelBtn?.addEventListener('click', closeWhModal);
  whModal?.addEventListener('click', (e) => { if (e.target === whModal) closeWhModal(); });

  whSaveBtn?.addEventListener('click', () => {
    if (whStatus) whStatus.textContent = 'Please use Confirm Payment Received after employer confirmation.';
  });


  // ── Report Employer Modal ─────────────────────────────────────────────────

  // Helper function for open report employer modal used by this script.
  function openReportEmployerModal({ applicationId, jobId, employerId, employerName, jobTitle }) {
    const MODAL_ID = 'report-employer-modal';

    if (!document.getElementById(MODAL_ID)) {
      const el = document.createElement('div');
      el.id = MODAL_ID;
      el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;align-items:center;justify-content:center;';
      el.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:32px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto;">
          <h2 style="margin-bottom:6px;">🚩 Report Employer</h2>
          <p id="rem2-desc" style="color:#64748b;margin-bottom:20px;"></p>

          <label style="display:block;margin-bottom:8px;font-weight:600;font-size:.9rem;">Reason</label>
          <select id="rem2-reason" style="width:100%;padding:.625rem;border:1px solid #d1d5db;border-radius:8px;font-family:inherit;font-size:.9rem;margin-bottom:16px;box-sizing:border-box;">
            ${reportReasonOptions()}
          </select>

          <label style="display:block;margin-bottom:8px;font-weight:600;font-size:.9rem;">Details <span id="rem2-details-hint" style="font-weight:400;color:#94a3b8;">(optional)</span></label>
          <textarea id="rem2-desc-input" rows="4"
            placeholder="Describe what happened..."
            style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:.625rem;resize:vertical;font-family:inherit;margin-bottom:12px;"></textarea>

          <p id="rem2-status" style="font-size:.85rem;color:#ef4444;min-height:18px;margin-bottom:12px;"></p>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" id="rem2-cancel-btn" class="btn-outline">Cancel</button>
            <button type="button" id="rem2-submit-btn" style="padding:.5rem 1.25rem;background:#dc2626;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Submit Report</button>
          </div>
        </div>`;
      document.body.appendChild(el);

      el.querySelector('#rem2-reason').addEventListener('change', (event) => {
        const required = event.target.value === 'other';
        el.querySelector('#rem2-desc-input').required = required;
        el.querySelector('#rem2-details-hint').textContent = required ? '(required)' : '(optional)';
      });
      el.querySelector('#rem2-cancel-btn').addEventListener('click', () => { el.style.display = 'none'; });
      // Connects this element event to the handler that should run next.
      el.addEventListener('click', (e) => { if (e.target === el) el.style.display = 'none'; });
    }

    const modal = document.getElementById(MODAL_ID);
    modal.querySelector('#rem2-desc').textContent = `Reporting ${employerName}${jobTitle ? ' for "' + jobTitle + '"' : ''}.`;
    modal.querySelector('#rem2-reason').value = '';
    modal.querySelector('#rem2-desc-input').value = '';
    modal.querySelector('#rem2-desc-input').required = false;
    modal.querySelector('#rem2-details-hint').textContent = '(optional)';
    modal.querySelector('#rem2-status').textContent = '';
    modal.style.display = 'flex';

    const submitBtn = modal.querySelector('#rem2-submit-btn');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Report';
    submitBtn.style.background = '#dc2626';
    modal.querySelector('#rem2-status').style.color = '#ef4444';
    submitBtn.onclick = async () => {
      const reason      = getReportReason(modal.querySelector('#rem2-reason').value);
      const description = modal.querySelector('#rem2-desc-input').value.trim();
      const statusEl    = modal.querySelector('#rem2-status');

      if (!reason) { statusEl.textContent = 'Please select a reason.'; return; }
      if (reason.id === 'other' && !description) { statusEl.textContent = 'Please describe the issue when selecting Other.'; return; }
      if (!currentUser) { statusEl.textContent = 'Not logged in.'; return; }
      // employerId may be null for old listings — report still submitted without reported_user

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      statusEl.textContent = '';

      try {
        if (reason.id === 'payment') {
          const application = applications.find(item => item.id === applicationId);
          if (!application || !['accepted', 'completion_pending', 'completed'].includes(application.status)) {
            throw new Error('Payment issues can be reported after you have been hired.');
          }
          await raisePaymentDisputeAndCreateReportByApplication(
            applicationId,
            `${reason.label}${description ? ': ' + description : ''}`,
            currentUser.id
          );
        } else {
          await createReport({
            reporter_id:   currentUser.id,
            reported_user: employerId,
            job_id:        jobId,
            report_type:   reason.type,
            description:   `Reason: ${reason.label}\nJob: ${jobTitle || 'unknown'}${description ? `\n\n${description}` : ''}`,
            status:        'open',
            admin_notes:   `application_id:${applicationId}`
          });
        }
        statusEl.style.color = '#16a34a';
        statusEl.textContent = 'Report submitted. Our team will review it shortly.';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Reported';
        submitBtn.style.background = '#6b7280';
        setTimeout(() => { modal.style.display = 'none'; }, 2000);
      } catch (err) {
        statusEl.style.color = '#ef4444';
        statusEl.textContent = 'Failed to submit: ' + (err.message || err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Report';
      }
    };
  }

  // ── Rate Employer Modal ────────────────────────────────────────────────────

  // Helper function for open rate employer modal used by this script.
  function openRateEmployerModal({ applicationId, employerId, employerName }) {
    const MODAL_ID = 'rate-employer-modal';

    if (!document.getElementById(MODAL_ID)) {
      const el = document.createElement('div');
      el.id = MODAL_ID;
      el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;align-items:center;justify-content:center;';
      el.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:32px;max-width:460px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2);">
          <h2 style="margin-bottom:6px;">⭐ Rate Employer</h2>
          <p id="rem-desc" style="color:#64748b;margin-bottom:20px;"></p>
          <div id="rem-stars-row" style="display:flex;gap:.5rem;margin-bottom:16px;">
            ${[1,2,3,4,5].map((n) => `<button type="button" class="rem-star-btn" data-star="${n}"
              style="font-size:2rem;background:none;border:none;cursor:pointer;color:#d1d5db;transition:color .15s;"
              aria-label="${n} star">★</button>`).join('')}
          </div>
          <input type="hidden" id="rem-star-value" value="5">
          <textarea id="rem-review-text" rows="3"
            placeholder="How was working with this employer? (optional)"
            style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:.625rem;resize:vertical;font-family:inherit;margin-bottom:12px;"></textarea>
          <p id="rem-status" style="font-size:.85rem;color:#ef4444;min-height:18px;margin-bottom:12px;"></p>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" id="rem-skip-btn" class="btn-outline">Skip</button>
            <button type="button" id="rem-submit-btn" class="btn-primary">Submit Rating</button>
          </div>
        </div>`;
      document.body.appendChild(el);

      const starsRow = el.querySelector('#rem-stars-row');
      const starInput = el.querySelector('#rem-star-value');
      // Connects this element event to the handler that should run next.
      starsRow.addEventListener('mouseover', (e) => {
        const b = e.target.closest('.rem-star-btn'); if (!b) return;
        const v = Number(b.dataset.star);
        starsRow.querySelectorAll('.rem-star-btn').forEach((s) => { s.style.color = Number(s.dataset.star) <= v ? '#f59e0b' : '#d1d5db'; });
      });
      // Connects this element event to the handler that should run next.
      starsRow.addEventListener('mouseleave', () => {
        const v = Number(starInput.value);
        starsRow.querySelectorAll('.rem-star-btn').forEach((s) => { s.style.color = Number(s.dataset.star) <= v ? '#f59e0b' : '#d1d5db'; });
      });
      // Connects this element event to the handler that should run next.
      starsRow.addEventListener('click', (e) => {
        const b = e.target.closest('.rem-star-btn'); if (!b) return;
        starInput.value = b.dataset.star;
        starsRow.querySelectorAll('.rem-star-btn').forEach((s) => { s.style.color = Number(s.dataset.star) <= Number(b.dataset.star) ? '#f59e0b' : '#d1d5db'; });
      });
      starsRow.querySelectorAll('.rem-star-btn').forEach((s) => { s.style.color = '#f59e0b'; });
      el.querySelector('#rem-skip-btn').addEventListener('click', () => { el.style.display = 'none'; });
      // Connects this element event to the handler that should run next.
      el.addEventListener('click', (e) => { if (e.target === el) el.style.display = 'none'; });
    }

    const modal = document.getElementById(MODAL_ID);
    modal.querySelector('#rem-desc').textContent = `How was your experience with ${employerName}?`;
    modal.querySelector('#rem-review-text').value = '';
    modal.querySelector('#rem-status').textContent = '';
    modal.querySelector('#rem-star-value').value = '5';
    modal.querySelectorAll('.rem-star-btn').forEach((s) => { s.style.color = '#f59e0b'; });
    modal.style.display = 'flex';

    const submitBtn = modal.querySelector('#rem-submit-btn');
    submitBtn.onclick = async () => {
      const stars    = Number(modal.querySelector('#rem-star-value').value) || 5;
      const review   = modal.querySelector('#rem-review-text').value.trim();
      const statusEl = modal.querySelector('#rem-status');

      if (!currentUser) { statusEl.textContent = 'Not logged in.'; return; }
      if (!employerId)  { statusEl.textContent = 'Employer info missing.'; return; }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      statusEl.textContent = '';

      try {
        await upsertRating({
          reviewer_id:    currentUser.id,
          reviewee_id:    employerId,
          application_id: applicationId,
          stars,
          review,
          reviewer_role: 'seeker'
        });
        ratedBySeeker.add(applicationId);
        modal.style.display = 'none';
        renderAll();
      } catch (err) {
        statusEl.textContent = 'Failed: ' + (err.message || err);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Rating';
      }
    };
  }

  // ── Event Delegation ───────────────────────────────────────────────────────

  // Handles the list click action triggered by the user.
  async function handleListClick(event) {
    // Cancel Application
    const cancelApplicationBtn = event.target.closest('.cancel-application-btn');
    if (cancelApplicationBtn) {
      const appId = cancelApplicationBtn.dataset.applicationId;
      const jobTitle = cancelApplicationBtn.dataset.jobTitle || 'this job';
      if (!appId || !currentUser) return;
      if (!confirm(`Cancel your application for "${jobTitle}"?`)) return;

      cancelApplicationBtn.disabled = true;
      cancelApplicationBtn.textContent = 'Cancelling...';

      try {
        await deleteApplication(appId, currentUser.id);
        applications = applications.filter((app) => app.id !== appId);
        renderAll();
      } catch (err) {
        console.error('Failed to cancel application:', err);
        cancelApplicationBtn.disabled = false;
        cancelApplicationBtn.textContent = 'Cancel Application';
        alert('Something went wrong. Please refresh the page or try again later.');
      }
      return;
    }

    // Legacy completion request button; kept for older cached markup.
    const completeBtn = event.target.closest('.request-complete-btn');
    if (completeBtn) {
      alert('Please wait for the employer to confirm work and payment before confirming receipt.');
      return;
    }

    // Confirm Payment Received, complete the application, and save Work History.
    const confirmPayBtn = event.target.closest('.confirm-payment-btn');
    if (confirmPayBtn) {
      const appId = confirmPayBtn.dataset.applicationId;
      if (!appId) return;
      const employerPaid = confirmPayBtn.dataset.employerPaid === 'true';
      const confirmText = employerPaid
        ? 'Confirm that you have received payment for this job?'
        : 'The employer has not marked this payment as paid yet. Confirm only if you already received the money. Continue?';
      if (!confirm(confirmText)) return;
      confirmPayBtn.disabled = true;
      confirmPayBtn.textContent = 'Confirming…';
      try {
        const confirmedPayment = await confirmPaymentReceived(appId);
        const app = applications.find((item) => item.id === appId);
        if (app) {
          const job = app._job || {};
          await insertWorkHistory({
            seeker_id: currentUser?.id,
            application_id: appId,
            job_title: job.title || 'Completed Job',
            employer_name: job.company_name || job.employer_name || 'Employer',
            category: job.category || null,
            start_date: null,
            end_date: localCalendarDate(),
            earnings: confirmedPayment.amount
          });
        }
        if (paymentStatusMap[appId]) {
          paymentStatusMap[appId].seeker_confirmed_at = new Date().toISOString();
          paymentStatusMap[appId].status = 'confirmed';
        } else {
          paymentStatusMap[appId] = { seeker_confirmed_at: new Date().toISOString(), status: 'confirmed' };
        }
        await refreshView();
      } catch (err) {
        console.error('Failed to confirm payment:', err);
        confirmPayBtn.disabled = false;
        confirmPayBtn.textContent = 'Confirm Payment Received';
        alert('Failed to save. Please try again.');
      }
      return;
    }

    // Rate Employer
    const rateBtn = event.target.closest('.rate-employer-btn');
    if (rateBtn) {
      openRateEmployerModal({
        applicationId: rateBtn.dataset.applicationId,
        employerId:    rateBtn.dataset.employerId,
        employerName:  rateBtn.dataset.employerName || 'Employer'
      });
    }

    // Report Employer
    const reportBtn2 = event.target.closest('.report-employer-btn');
    if (reportBtn2) {
      openReportEmployerModal({
        applicationId: reportBtn2.dataset.applicationId,
        jobId:         reportBtn2.dataset.jobId,
        employerId:    reportBtn2.dataset.employerId,
        employerName:  reportBtn2.dataset.employerName || 'Employer',
        jobTitle:      reportBtn2.dataset.jobTitle || ''
      });
    }
  }

  listEl?.addEventListener('click', handleListClick);
  completedListEl?.addEventListener('click', handleListClick);

  // ── Auth / Init ────────────────────────────────────────────────────────────

  observeAuth(async (user) => {
    currentUser = user;
    if (!user) { window.location.href = '../../login.html'; return; }

    try {
      await refreshView();
    } catch (err) {
      console.error('Failed to load applications page:', err);
      if (listEl) listEl.innerHTML = `
        <article class="jobseeker-item application-item">
          <div class="application-main">
            <div class="application-title-row">
              <h3>Unable to load applications</h3>
            </div>
            <div class="application-summary">
              <p>${escapeHtml(String(err?.message || 'Unknown error'))}</p>
            </div>
          </div>
        </article>`;
    }
  });

})();

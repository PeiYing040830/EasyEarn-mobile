import { downloadReportEvidence } from './report-evidence.js';
/**
 * EasyEarn file note: Handles the admin reports page behavior and related user interactions.
 */
import {
  observeAuth,
  fetchReports,
  updateReport,
  fetchPaymentDisputes,
  resolvePaymentDispute,
  fetchAllApplications,
  fetchJobs,
  fetchProfilesByIds,
  updateUserAccountStatus,
  updateEmployerJobsStatus
} from './supabase-data.js';

(function () {
  'use strict';

  const listEl = document.getElementById('admin-reports-list');
  const statusEl = document.getElementById('admin-reports-status');
  const filterStatusEl = document.getElementById('admin-reports-filter-status');
  const filterKindEl = document.getElementById('admin-reports-filter-kind');
  const searchEl = document.getElementById('admin-reports-search');
  const metrics = {
    open: {
      value: document.getElementById('admin-reports-open-count'),
      note: document.getElementById('admin-reports-open-note')
    },
    escalated: {
      value: document.getElementById('admin-reports-escalated-count'),
      note: document.getElementById('admin-reports-escalated-note')
    },
    resolved: {
      value: document.getElementById('admin-reports-resolved-count'),
      note: document.getElementById('admin-reports-resolved-note')
    }
  };

  let cachedReports = [];
  let cachedPaymentDisputes = [];
  let paymentApplicationMap = new Map();
  let paymentJobMap = new Map();
  let paymentProfileMap = new Map();
  let currentAdmin = null;

  // Updates status after the user changes something or data is refreshed.
  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error');
    if (type) statusEl.classList.add(type);
  }

  // Formats or checks error message so later code can use a clean value.
  function formatErrorMessage(error, fallback) {
    const message = String(error?.message || error?.details || error?.hint || '').trim();
    return message ? `${fallback} ${message}` : fallback;
  }

  // Loads report state data so the page can display current information.
  function getReportState(_reportId, dbStatus) {
    if (dbStatus === 'resolved') return { status: 'resolved' };
    if (dbStatus === 'escalated') return { status: 'escalated' };
    return { status: 'open' };
  }

  // Helper function for pretty status used by this script.
  function prettyStatus(status) {
    if (status === 'resolved') return 'Resolved';
    if (status === 'escalated') return 'Escalated';
    return 'Open';
  }

  // Formats or checks HTML so later code can use a clean value.
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Loads payment context data so the page can display current information.
  function getPaymentContext(payment) {
    const application = paymentApplicationMap.get(payment.application_id) || null;
    const job = application?.job_id ? (paymentJobMap.get(application.job_id) || null) : null;
    const seeker = application?.seeker_id ? (paymentProfileMap.get(application.seeker_id) || null) : null;
    const employer = job?.employer_id ? (paymentProfileMap.get(job.employer_id) || null) : null;
    return { application, job, seeker, employer };
  }

  // Loads payment report marker data so the page can display current information.
  function getPaymentReportMarker(report) {
    const marker = String(report?.admin_notes || '').trim();
    return marker.startsWith('payment_dispute:') ? marker.slice('payment_dispute:'.length) : '';
  }

  // Helper function for looks like payment mirror report used by this script.
  function looksLikePaymentMirrorReport(report) {
    const description = String(report?.description || '').trim().toLowerCase();
    return !!getPaymentReportMarker(report)
      || description.startsWith('payment dispute for "')
      || description.startsWith('escalated payment dispute for "');
  }

  // Helper function for has matching payment dispute used by this script.
  function hasMatchingPaymentDispute(report) {
    const paymentId = getPaymentReportMarker(report);
    if (paymentId) {
      return cachedPaymentDisputes.some((payment) => String(payment.id) === String(paymentId));
    }

    return cachedPaymentDisputes.some((payment) => {
      const context = getPaymentContext(payment);
      const seekerId = context?.seeker?.id || context?.application?.seeker_id || payment.payee_id || '';
      const employerId = context?.employer?.id || context?.job?.employer_id || '';
      const sameSeeker = seekerId && String(report.reporter_id || '') === String(seekerId);
      const sameEmployer = employerId && String(report.reported_user || '') === String(employerId);
      return sameSeeker && sameEmployer;
    });
  }

  // Helper function for dedupe reports used by this script.
  function dedupeReports(reports) {
    const seen = new Set();
    return (reports || []).filter((report) => {
      if (looksLikePaymentMirrorReport(report) && hasMatchingPaymentDispute(report)) return false;
      const paymentId = getPaymentReportMarker(report);
      const key = paymentId || `${report.reported_user || ''}|${report.description || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Helper function for refresh payment context used by this script.
  async function refreshPaymentContext() {
    const applications = await fetchAllApplications().catch(() => []);
    paymentApplicationMap = new Map(applications.map((item) => [item.id, item]));

    const jobs = await fetchJobs().catch(() => []);
    paymentJobMap = new Map(jobs.map((item) => [item.id, item]));

    const profileIds = Array.from(new Set([
      ...applications.map((item) => item.seeker_id),
      ...jobs.map((item) => item.employer_id)
    ].filter(Boolean)));

    const profiles = await fetchProfilesByIds(profileIds).catch(() => []);
    paymentProfileMap = new Map(profiles.map((item) => [item.id, item]));
  }

  // Updates metrics after the user changes something or data is refreshed.
  function updateMetrics(items) {
    const open = items.filter((item) => item.state.status === 'open').length;
    const escalated = items.filter((item) => item.state.status === 'escalated').length;
    const resolved = items.filter((item) => item.state.status === 'resolved').length;
    if (metrics.open.value) metrics.open.value.textContent = String(open);
    if (metrics.escalated.value) metrics.escalated.value.textContent = String(escalated);
    if (metrics.resolved.value) metrics.resolved.value.textContent = String(resolved);

    if (metrics.open.note) metrics.open.note.textContent = open ? `${open} report(s) still open.` : 'No open reports.';
    if (metrics.escalated.note) metrics.escalated.note.textContent = escalated ? `${escalated} report(s) escalated.` : 'No escalated reports yet.';
    if (metrics.resolved.note) metrics.resolved.note.textContent = resolved ? `${resolved} report(s) resolved.` : 'No resolved reports yet.';
  }

  // Renders list into the HTML so the user can see it.
  function renderList() {
    if (!listEl) return;

    const reportItems = dedupeReports(cachedReports).map((report) => ({
      kind: 'report',
      id: report.id,
      report,
      state: getReportState(report.id, report.status)
    }));
    const paymentItems = cachedPaymentDisputes.map((payment) => ({
      kind: 'payment',
      id: payment.id,
      report: payment,
      context: getPaymentContext(payment),
      state: payment.status === 'resolved'
        ? { status: 'resolved' }
        : payment.status === 'escalated'
          ? { status: 'escalated' }
          : { status: 'open' }
    }));
    const items = [...paymentItems, ...reportItems].sort((a, b) => {
      const aTime = new Date(a.report.disputed_at || a.report.created_at || 0).getTime();
      const bTime = new Date(b.report.disputed_at || b.report.created_at || 0).getTime();
      return bTime - aTime;
    });

    updateMetrics(items);

    const statusFilter = filterStatusEl?.value || 'all';
    const kindFilter = filterKindEl?.value || 'all';
    const query = String(searchEl?.value || '').trim().toLowerCase();
    const filteredItems = items.filter(({ kind, report, state, context }) => {
      const matchesStatus = statusFilter === 'all' || state.status === statusFilter;
      const matchesKind = kindFilter === 'all' || kind === kindFilter;
      const haystack = [
        kind,
        report.report_type,
        report.description,
        report.dispute_desc,
        report.status,
        report.admin_resolution,
        context?.job?.title,
        context?.seeker?.name,
        context?.seeker?.email,
        context?.employer?.name,
        context?.employer?.email,
        report.reporter_id,
        report.reported_user,
        prettyStatus(state.status)
      ].join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesStatus && matchesKind && matchesSearch;
    });

    if (!filteredItems.length) {
      listEl.innerHTML = `
        <article class="admin-item">
          <strong>No matching reports</strong>
          <p>Try another status, source, or search keyword.</p>
          <div class="admin-item-meta"><span>Type: -</span><span>Priority: -</span><span>Status: Empty</span></div>
        </article>
      `;
      return;
    }

    listEl.innerHTML = filteredItems.map(({ kind, report, state, context }) => `
      <article class="admin-item" data-report-id="${report.id}" data-kind="${kind}">
        <div class="admin-request-head">
          <div>
            <strong>${kind === 'payment' ? 'Payment dispute' : (report.report_type || 'Report case')}</strong>
            <p>${kind === 'payment' ? (report.dispute_desc || 'No dispute details provided.') : escapeHtml(report.description || 'No description provided.')}</p>
          </div>
          <span class="admin-status-pill">${prettyStatus(state.status)}</span>
        </div>
        <div class="admin-item-meta">
          <span>Reporter: ${kind === 'payment' ? (context?.seeker?.name || context?.seeker?.email || report.payee_id || '-') : (report.reporter_id || '-')}</span>
          <span>${kind === 'payment' ? `Employer: ${context?.employer?.name || context?.employer?.email || '-'}` : `Reported user: ${paymentProfileMap.get(report.reported_user)?.name || paymentProfileMap.get(report.reported_user)?.email || report.reported_user || '-'}`}</span>
          <span>DB status: ${report.status || 'pending'}</span>
          <span>Source: ${kind === 'payment' ? 'Payment dispute' : 'Supabase report'}</span>
          ${kind === 'payment' ? `<span>Reported on: ${report.disputed_at ? new Date(report.disputed_at).toLocaleString('en-MY') : '-'}</span>` : ''}
        </div>
        ${kind === 'payment' ? `<p style="margin:.6rem 0 0;color:#475569;">Job: ${escapeHtml(context?.job?.title || 'Unknown job')}</p>` : ''}
        ${kind === 'payment' && report.evidence_url ? `<p style="margin:.6rem 0 0;color:#475569;">Evidence: <a href="${report.evidence_url}" target="_blank" rel="noopener noreferrer">${report.evidence_url}</a></p>` : ''}
        ${kind === 'payment' && report.admin_resolution ? `<p style="margin:.6rem 0 0;color:#475569;">Resolution: ${report.admin_resolution}</p>` : ''}
        ${kind === 'report' && report.evidence ? `<p>Evidence: ${escapeHtml(report.evidence.name)} <button type="button" class="btn-outline" data-action="download-evidence" data-report-id="${report.id}">Download evidence</button></p>` : ''}
        <div class="admin-action-row">
          ${kind === 'payment'
            ? `${report.status === 'resolved'
                ? `<button type="button" class="btn-outline" disabled style="opacity:.65;cursor:default;">Payment Resolved</button>`
                : `<button type="button" class="btn-primary" data-action="resolve-payment" data-report-id="${report.id}">Mark Payment Resolved</button>`}
               <button type="button" class="btn-outline" data-action="message-employer" data-report-id="${report.id}">Message Employer</button>
               <button type="button" class="btn-outline" data-action="warn-employer" data-report-id="${report.id}">Send Warning to Employer</button>
               ${String(context?.employer?.accountStatus || 'active').toLowerCase() === 'suspended'
                 ? `<button type="button" class="btn-primary" data-action="unlock-employer" data-report-id="${report.id}" style="background:#16a34a;border-color:#16a34a;">Unlock Employer</button>`
                 : `<button type="button" class="btn-outline" data-action="lock-employer" data-report-id="${report.id}" style="color:#dc2626;border-color:#dc2626;">Lock Employer</button>`
               }`
            : `${report.reported_user ? `<button type="button" class="btn-outline" data-action="message-reported-user" data-report-id="${report.id}">Message Employer</button>` : ''}
               ${state.status === 'resolved'
                ? `<button type="button" class="btn-outline" disabled style="opacity:.65;cursor:default;">Resolved</button>`
                : `<button type="button" class="btn-outline" data-action="resolve" data-report-id="${report.id}">Resolve</button>
                   <button type="button" class="btn-outline" data-action="escalate" data-report-id="${report.id}">Escalate</button>`}`}
        </div>
      </article>
    `).join('');
  }

  listEl?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, reportId } = button.dataset;
    if (!action || !reportId) return;
    if (action === 'download-evidence') {
      try {
        const report = cachedReports.find(item => item.id === reportId);
        if (!report?.evidence) throw new Error('Evidence attachment is unavailable.');
        downloadReportEvidence(report.evidence);
      } catch (error) { setStatus(error.message); }
      return;
    }
    setStatus(`Processing ${action}...`);

    if (action === 'warn-employer') {
      const payment = cachedPaymentDisputes.find((item) => item.id === reportId);
      const context = payment ? getPaymentContext(payment) : null;
      const employerEmail = context?.employer?.email || '';
      const employerName = context?.employer?.name || 'Employer';
      const jobTitle = context?.job?.title || 'your job listing';
      const seekerName = context?.seeker?.name || context?.seeker?.email || 'the job seeker';

      if (!employerEmail) {
        setStatus('Employer email not found for this dispute.', 'is-error');
        return;
      }

      const subject = encodeURIComponent(`[EasyEarn] Warning: Unresolved Payment Dispute – ${jobTitle}`);
      const body = encodeURIComponent(
`Dear ${employerName},

We are writing to inform you that a payment dispute has been raised by ${seekerName} regarding the job "${jobTitle}" on EasyEarn.

As per our platform's payment policy, all workers must be paid within the agreed timeframe after the completion of their shift. Failure to resolve outstanding payments may result in further action, including account suspension.

Please resolve this matter as soon as possible and update your payment status on the platform.

If you believe this is an error or require assistance, please reply to this email or contact us through the platform.

Regards,
EasyEarn Admin Team`
      );

      window.location.href = `mailto:${employerEmail}?subject=${subject}&body=${body}`;
      setStatus('Opening email client with warning template...', 'is-success');
      return;
    }

    if (action === 'message-employer') {
      const payment = cachedPaymentDisputes.find((item) => item.id === reportId);
      const context = payment ? getPaymentContext(payment) : null;
      const employerId = context?.employer?.id || context?.job?.employer_id || '';
      if (!payment || !employerId) {
        setStatus('Employer details are missing for this payment dispute.', 'is-error');
        return;
      }

      const params = new URLSearchParams({
        user: employerId,
        name: context?.employer?.name || context?.employer?.email || 'Employer',
        jobId: context?.job?.id || context?.application?.job_id || '',
        job: context?.job?.title || 'Payment dispute follow-up'
      });
      setStatus('Opening employer conversation...', 'is-success');
      window.location.href = `messages.html?${params.toString()}`;
      return;
    }

    if (action === 'message-reported-user') {
      const report = cachedReports.find((item) => item.id === reportId);
      const reportedUserId = report?.reported_user || '';
      if (!report || !reportedUserId) {
        setStatus('Reported user details are missing for this report.', 'is-error');
        return;
      }

      const reportedProfile = paymentProfileMap.get(reportedUserId) || null;
      const params = new URLSearchParams({
        user: reportedUserId,
        name: reportedProfile?.name || reportedProfile?.email || 'Employer',
        job: report.report_type ? `Report follow-up: ${report.report_type}` : 'Report follow-up'
      });
      setStatus('Opening employer conversation...', 'is-success');
      window.location.href = `messages.html?${params.toString()}`;
      return;
    }


    if (action === 'resolve-payment') {
      try {
        await resolvePaymentDispute(reportId, `Resolved by admin on ${new Date().toLocaleString('en-MY')}`);
        cachedPaymentDisputes = await fetchPaymentDisputes();
        await refreshPaymentContext();
        setStatus('Payment dispute marked as resolved.', 'is-success');
        renderList();
      } catch (error) {
        console.error('Failed to resolve payment dispute:', error);
        setStatus(error?.message || 'Unable to resolve payment dispute right now.', 'is-error');
      }
      return;
    }

    if (action === 'lock-employer' || action === 'unlock-employer') {
      const payment = cachedPaymentDisputes.find((item) => item.id === reportId);
      const context = payment ? getPaymentContext(payment) : null;
      const employerId = context?.employer?.id || context?.job?.employer_id || '';
      if (!employerId) {
        setStatus('Employer details are missing for this dispute.', 'is-error');
        return;
      }
      const nextAccountStatus = action === 'lock-employer' ? 'suspended' : 'active';
      setStatus(action === 'lock-employer' ? 'Locking employer account...' : 'Unlocking employer account...');
      try {
        await updateUserAccountStatus(employerId, nextAccountStatus);
        if (nextAccountStatus === 'suspended') {
          await updateEmployerJobsStatus(employerId, 'flagged');
        }
        const updatedProfiles = await fetchProfilesByIds([employerId]).catch(() => []);
        updatedProfiles.forEach((p) => paymentProfileMap.set(p.id, p));
        setStatus(
          nextAccountStatus === 'suspended'
            ? 'Employer account locked and job listings flagged.'
            : 'Employer account unlocked successfully.',
          'is-success'
        );
        renderList();
      } catch (error) {
        console.error('Failed to update employer account status:', error);
        setStatus(error?.message || 'Unable to update employer account status right now.', 'is-error');
      }
      return;
    }

    const nextStatus = action === 'resolve' ? 'resolved' : 'escalated';
    try {
      await updateReport(reportId, {
        status: nextStatus,
        admin_notes: `Updated by admin on ${new Date().toLocaleString('en-MY')}`
      });
      cachedReports = await fetchReports();
      cachedPaymentDisputes = await fetchPaymentDisputes().catch(() => cachedPaymentDisputes);
      setStatus(`Report updated to "${prettyStatus(nextStatus)}".`, 'is-success');
      renderList();
    } catch (error) {
      console.error('Failed to update report:', error);
      setStatus(error?.message || 'Unable to update report status right now.', 'is-error');
    }
  });

  [filterStatusEl, filterKindEl].forEach((el) => {
    el?.addEventListener('change', () => renderList());
  });

  searchEl?.addEventListener('input', () => renderList());

  observeAuth(async (user) => {
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }
    currentAdmin = user;

    let reportsError = null;
    let disputesError = null;

    try {
      cachedReports = await fetchReports();
    } catch (error) {
      console.error('Failed to load reports:', error);
      cachedReports = [];
      reportsError = error;
    }

    try {
      cachedPaymentDisputes = await fetchPaymentDisputes();
    } catch (error) {
      console.error('Failed to load payment disputes:', error);
      cachedPaymentDisputes = [];
      disputesError = error;
    }

    await refreshPaymentContext().catch((error) => {
      console.error('Failed to enrich payment disputes:', error);
    });

    if (reportsError && disputesError) {
      setStatus(
        `${formatErrorMessage(reportsError, 'Reports failed:')} ${formatErrorMessage(disputesError, 'Payment disputes failed:')}`,
        'is-error'
      );
    } else if (reportsError) {
      setStatus(formatErrorMessage(reportsError, 'Regular reports failed:'), 'is-error');
    } else if (disputesError) {
      setStatus(formatErrorMessage(disputesError, 'Payment disputes failed:'), 'is-error');
    } else {
      setStatus('Report queue loaded successfully.', 'is-success');
    }

    renderList();
  });
})();

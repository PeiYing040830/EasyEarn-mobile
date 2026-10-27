/**
 * EasyEarn file note: Handles the admin analytics page behavior and related user interactions.
 */
import {
  observeAuth,
  fetchAllProfiles,
  fetchProfilesByIds,
  fetchJobs,
  fetchReports,
  fetchPaymentDisputes,
  saveAnalyticsSnapshot
} from './supabase-data.js';

(function () {
  'use strict';

  let lineChart = null;
  const compactChartLayout = window.matchMedia('(max-width: 480px)');
  compactChartLayout.addEventListener('change', () => {
    if (!lineChart) return;
    lineChart.options.maintainAspectRatio = !compactChartLayout.matches;
    lineChart.resize();
    lineChart.update('none');
  });
  let donutChart = null;
  let analyticsRows = [];

  const metrics = {
    users: {
      value: document.getElementById('admin-analytics-users-count'),
      note: document.getElementById('admin-analytics-users-note'),
      share: document.getElementById('admin-analytics-users-share')
    },
    jobs: {
      value: document.getElementById('admin-analytics-jobs-count'),
      note: document.getElementById('admin-analytics-jobs-note'),
      share: document.getElementById('admin-analytics-jobs-share')
    },
    reports: {
      value: document.getElementById('admin-analytics-reports-count'),
      note: document.getElementById('admin-analytics-reports-note'),
      share: document.getElementById('admin-analytics-reports-share')
    },
    verifications: {
      share: document.getElementById('admin-analytics-verifications-share')
    }
  };

  const tableEls = {
    typeFilter: document.getElementById('admin-analytics-type-filter'),
    statusFilter: document.getElementById('admin-analytics-status-filter'),
    search: document.getElementById('admin-analytics-search'),
    summary: document.getElementById('admin-analytics-table-summary'),
    body: document.getElementById('admin-analytics-table-body')
  };

  // Formats or checks HTML so later code can use a clean value.
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Helper function for title case used by this script.
  function titleCase(value) {
    const text = String(value || '').replace(/[_-]+/g, ' ').trim();
    if (!text) return '-';
    return text.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  // Formats or checks date so later code can use a clean value.
  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-MY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Helper function for join details used by this script.
  function joinDetails(parts = []) {
    return parts.filter(Boolean).join(' | ') || '-';
  }

  // Loads last6 month buckets data so the page can display current information.
  function getLast6MonthBuckets() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const buckets = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: months[date.getMonth()]
      });
    }

    return buckets;
  }

  // Helper function for to month key used by this script.
  function toMonthKey(dateVal) {
    const date = new Date(dateVal);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  // Helper function for count items by recent month used by this script.
  function countItemsByRecentMonth(items, dateFields = ['created_at']) {
    const buckets = getLast6MonthBuckets();
    const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));

    (items || []).forEach((item) => {
      const rawDate = dateFields.map((field) => item?.[field]).find(Boolean);
      if (!rawDate) return;

      const key = toMonthKey(rawDate);
      if (counts.has(key)) {
        counts.set(key, counts.get(key) + 1);
      }
    });

    return buckets.map((bucket) => counts.get(bucket.key) || 0);
  }

  // Updates share after the user changes something or data is refreshed.
  function setShare(el, value, total) {
    if (!el) return;
    const percentage = total ? Math.round((value / total) * 100) : 0;
    el.textContent = `${percentage}%`;
  }

  // Updates pie ring after the user changes something or data is refreshed.
  function setPieRing(values) {
    const canvas = document.getElementById('admin-analytics-donut-canvas');
    if (!canvas) return;

    const colors = ['#6d28d9', '#312e81', '#7c3aed', '#be185d'];
    const labels = ['User Growth', 'Job Volume', 'Report Load', 'Verification Load'];

    if (donutChart) {
      donutChart.data.datasets[0].data = values;
      donutChart.update();
      return;
    }

    donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: { legend: { display: false } }
      }
    });
  }

  // Helper function for apply line used by this script.
  function applyLine(values, labels) {
    const canvas = document.getElementById('admin-analytics-line-canvas');
    if (!canvas) return;

    const chartLabels = labels || getLast6MonthBuckets().map((bucket) => bucket.label);

    const datasets = [
      {
        label: 'Users',
        data: values.users || values,
        borderColor: '#6d28d9',
        backgroundColor: 'rgba(0,0,0,0)',
        tension: 0.4,
        pointBackgroundColor: '#6d28d9',
        pointRadius: 4, pointStyle: 'circle',
        fill: false
      },
      {
        label: 'Jobs',
        data: values.jobs || [],
        borderColor: '#312e81',
        backgroundColor: 'rgba(0,0,0,0)',
        tension: 0.4,
        pointBackgroundColor: '#312e81',
        pointRadius: 4, pointStyle: 'circle',
        fill: false
      },
      {
        label: 'Reports',
        data: values.reports || [],
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(0,0,0,0)',
        tension: 0.4,
        pointBackgroundColor: '#7c3aed',
        pointRadius: 4, pointStyle: 'circle',
        fill: false
      },
      {
        label: 'Verifications',
        data: values.verifications || [],
        borderColor: '#be185d',
        backgroundColor: 'rgba(0,0,0,0)',
        tension: 0.4,
        pointBackgroundColor: '#be185d',
        pointRadius: 4, pointStyle: 'circle',
        fill: false
      }
    ];

    if (lineChart) {
      lineChart.data.labels = chartLabels;
      lineChart.data.datasets.forEach((ds, i) => {
        ds.data = datasets[i].data;
      });
      lineChart.update();
      return;
    }

    lineChart = new Chart(canvas, {
      type: 'line',
      data: { labels: chartLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: !compactChartLayout.matches,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8,
              font: { size: 11 },
              padding: 16
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  // Formats or checks user role so later code can use a clean value.
  function normalizeUserRole(role) {
    const value = String(role || '').toLowerCase().trim();
    if (['jobseeker', 'job seeker', 'seeker'].includes(value)) return 'jobseeker';
    if (value === 'employer') return 'employer';
    if (['admin', 'administrator'].includes(value)) return 'admin';
    return value || 'user';
  }

  // Formats or checks status so later code can use a clean value.
  function normalizeStatus(type, rawStatus) {
    const status = String(rawStatus || '').toLowerCase().trim();

    if (type === 'user') {
      if (['suspended', 'locked'].includes(status)) return 'locked';
      return normalizeUserRole(rawStatus);
    }

    if (type === 'job') {
      if (['approved'].includes(status)) return 'approved';
      if (['flagged'].includes(status)) return 'flagged';
      if (['removed', 'closed', 'expired'].includes(status)) return 'rejected';
      if (['pending', 'open'].includes(status)) return 'pending';
      return status || 'pending';
    }

    if (type === 'report') {
      if (['resolved'].includes(status)) return 'resolved';
      if (['escalated'].includes(status)) return 'escalated';
      if (['reviewed', 'pending'].includes(status)) return 'pending';
      if (['disputed'].includes(status)) return 'pending';
      return status || 'pending';
    }

    if (type === 'application') {
      if (['completed'].includes(status)) return 'completed';
      if (['accepted'].includes(status)) return 'approved';
      if (['rejected'].includes(status)) return 'rejected';
      if (['pending', 'reviewed', 'completion_pending'].includes(status)) return 'pending';
      return status || 'pending';
    }

    if (type === 'verification') {
      if (['approved'].includes(status)) return 'approved';
      if (['rejected'].includes(status)) return 'rejected';
      if (['recheck'].includes(status)) return 'recheck';
      if (['pending', 'submitted', 'recheck'].includes(status)) return 'pending';
      return status || 'pending';
    }

    return status || 'recorded';
  }

  // Loads status palette class data so the page can display current information.
  function getStatusPaletteClass(status) {
    const normalized = String(status || '').toLowerCase();
    if (['approved', 'completed', 'resolved'].includes(normalized)) return normalized;
    if (['pending', 'flagged', 'escalated', 'recheck'].includes(normalized)) return normalized;
    if (['rejected', 'locked'].includes(normalized)) return normalized;
    if (['jobseeker', 'employer', 'admin'].includes(normalized)) return 'user-role';
    return '';
  }

  // Loads base statuses for type data so the page can display current information.
  function getBaseStatusesForType(type, rows) {
    if (type === 'user') return ['jobseeker', 'employer', 'admin', 'locked'];
    if (type === 'job') return ['pending', 'approved', 'flagged', 'rejected'];
    if (type === 'report') return ['pending', 'escalated', 'resolved'];
    if (type === 'verification') return ['pending', 'recheck', 'approved', 'rejected'];

    return Array.from(new Set((rows || []).map((row) => String(row.status || '').trim()).filter(Boolean))).sort();
  }

  // Formats or checks analytics rows so later code can use a clean value.
  function buildAnalyticsRows({
    users = [],
    jobs = [],
    reports = [],
    paymentDisputes = [],
    profilesById = new Map()
  }) {
    const userRows = users.map((user) => ({
      type: 'user',
      title: user.name || user.email || 'Unknown user',
      subtitle: user.email || '-',
      status: String(user.accountStatus || '').toLowerCase() === 'suspended'
        ? 'locked'
        : normalizeStatus('user', user.role),
      date: user.createdAt || user.created_at || '',
      details: joinDetails([
        user.location,
        user.phone,
        user.headline,
        user.companyName || user.businessName,
        user.website
      ])
    }));

    const verificationRows = users
      .filter((user) => normalizeUserRole(user.role) === 'employer')
      .map((user) => ({
        type: 'verification',
        title: user.companyName || user.businessName || user.name || user.email || 'Employer verification',
        subtitle: user.email || '-',
        status: normalizeStatus('verification', user.verificationStatus || (user.isVerified ? 'approved' : 'pending')),
        date: user.updatedAt || user.createdAt || user.updated_at || user.created_at || '',
        details: joinDetails([
          user.businessType,
          user.ssmNumber,
          user.verificationAddress,
          user.verificationNotes
        ])
      }));

    const jobRows = jobs.map((job) => ({
      type: 'job',
      title: job.title || job.job_title || 'Untitled job',
      subtitle: job.category || job.job_category || '-',
      status: normalizeStatus('job', job.status),
      date: job.approved_at || job.created_at || '',
      details: joinDetails([
        job.location || job.city,
        job.job_type || job.schedule || job.employment_type,
        job.pay_rate ? `RM${job.pay_rate}/${job.pay_type || 'day'}` : (job.salary || job.pay || job.rate || job.salary_range),
        job.description
      ])
    }));

    const reportRows = reports.map((report) => {
      const reporter = profilesById.get(report.reporter_id) || null;
      const reported = profilesById.get(report.reported_user) || null;
      return {
        type: 'report',
        title: titleCase(report.report_type || 'report'),
        subtitle: reported?.name || reported?.email || report.reported_user || 'Reported entity not set',
        status: normalizeStatus('report', report.status),
        date: report.created_at || '',
        details: joinDetails([
          reporter ? `Reporter: ${reporter.name || reporter.email}` : '',
          report.description,
          report.admin_notes
        ])
      };
    });

    const paymentDisputeRows = paymentDisputes.map((payment) => {
      const seeker = profilesById.get(payment.payee_id) || null;
      const employer = profilesById.get(payment.payer_id) || null;
      return {
        type: 'report',
        title: 'Payment Dispute',
        subtitle: seeker?.name || seeker?.email || payment.application_id || 'Application dispute',
        status: normalizeStatus('report', payment.status),
        date: payment.disputed_at || payment.created_at || '',
        details: joinDetails([
          employer ? `Employer: ${employer.name || employer.email}` : '',
          payment.dispute_desc,
          payment.evidence_url ? `Evidence: ${payment.evidence_url}` : '',
          payment.admin_resolution
        ])
      };
    });

    return [
      ...userRows,
      ...verificationRows,
      ...jobRows,
      ...reportRows,
      ...paymentDisputeRows
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  // Loads rows for selected type data so the page can display current information.
  function getRowsForSelectedType() {
    const typeValue = tableEls.typeFilter?.value || 'all';
    return analyticsRows.filter((row) => typeValue === 'all' || row.type === typeValue);
  }

  // Helper function for populate status options used by this script.
  function populateStatusOptions(rows) {
    if (!tableEls.statusFilter) return;

    const current = tableEls.statusFilter.value || 'all';
    const selectedType = tableEls.typeFilter?.value || 'all';
    const statuses = getBaseStatusesForType(selectedType, rows);
    const counts = new Map(statuses.map((status) => [status, 0]));

    rows.forEach((row) => {
      const status = String(row.status || '').trim().toLowerCase();
      if (counts.has(status)) {
        counts.set(status, counts.get(status) + 1);
      }
    });

    tableEls.statusFilter.innerHTML = ['<option value="all">All statuses</option>']
      .concat(statuses.map((status) => {
        const count = counts.get(status) || 0;
        return `<option value="${escapeHtml(status)}">${escapeHtml(`${titleCase(status)} (${count})`)}</option>`;
      }))
      .join('');
    tableEls.statusFilter.value = statuses.includes(current) ? current : 'all';
  }

  // Renders analytics table into the HTML so the user can see it.
  function renderAnalyticsTable() {
    if (!tableEls.body) return;

    const typeValue = tableEls.typeFilter?.value || 'all';
    const statusValue = tableEls.statusFilter?.value || 'all';
    // Helper function for search value used by this script.
    const searchValue = (tableEls.search?.value || '').trim().toLowerCase();

    const filtered = analyticsRows.filter((row) => {
      const typeMatch = typeValue === 'all' || row.type === typeValue;
      const statusMatch = statusValue === 'all' || String(row.status || '') === statusValue;
      const searchCorpus = [row.title, row.subtitle, row.status, row.details, row.type].join(' ').toLowerCase();
      const searchMatch = !searchValue || searchCorpus.includes(searchValue);
      return typeMatch && statusMatch && searchMatch;
    });

    if (tableEls.summary) {
      tableEls.summary.textContent = `${filtered.length} record(s) shown out of ${analyticsRows.length}.`;
    }

    if (!filtered.length) {
      tableEls.body.innerHTML = '<tr><td colspan="5">No records match the selected filters.</td></tr>';
      return;
    }

    tableEls.body.innerHTML = filtered.map((row) => {
      const paletteClass = getStatusPaletteClass(row.status);
      return `
        <tr>
          <td><span class="admin-table-type">${escapeHtml(titleCase(row.type))}</span></td>
          <td>
            <div class="admin-table-title">${escapeHtml(row.title)}</div>
            <div class="admin-table-subtitle">${escapeHtml(row.subtitle || '-')}</div>
          </td>
          <td><span class="admin-table-status${paletteClass ? ` is-${escapeHtml(paletteClass)}` : ''}">${escapeHtml(titleCase(row.status))}</span></td>
          <td>${escapeHtml(formatDate(row.date))}</td>
          <td><div class="admin-table-details">${escapeHtml(row.details || '-')}</div></td>
        </tr>
      `;
    }).join('');
  }

  // Sets up table controls when this script is loaded.
  function initTableControls() {
    tableEls.typeFilter?.addEventListener('change', () => {
      populateStatusOptions(getRowsForSelectedType());
      renderAnalyticsTable();
    });
    tableEls.statusFilter?.addEventListener('change', renderAnalyticsTable);
    tableEls.search?.addEventListener('input', renderAnalyticsTable);
  }

  observeAuth(async (user) => {
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    let users = [];
    let jobs = [];
    let reports = [];
    let paymentDisputes = [];
    let profilesById = new Map();
    let usersBlocked = false;
    let jobsBlocked = false;
    let reportsBlocked = false;
    let paymentsBlocked = false;

    try {
      users = await fetchAllProfiles();
      profilesById = new Map(users.map((profile) => [profile.id, profile]));
    } catch (error) {
      console.error('Analytics users load failed:', error);
      usersBlocked = true;
    }

    try {
      jobs = await fetchJobs();
    } catch (error) {
      console.error('Analytics jobs load failed:', error);
      jobsBlocked = true;
    }

    try {
      reports = await fetchReports();
    } catch (error) {
      console.error('Analytics reports load failed:', error);
      reportsBlocked = true;
    }

    try {
      paymentDisputes = await fetchPaymentDisputes();
    } catch (error) {
      console.error('Analytics payment disputes load failed:', error);
      paymentsBlocked = true;
    }

    try {
      const missingUserIds = Array.from(new Set([
        ...reports.flatMap((item) => [item.reporter_id, item.reported_user])
      ].filter(Boolean))).filter((id) => !profilesById.has(id));

      if (missingUserIds.length) {
        const extraProfiles = await fetchProfilesByIds(missingUserIds);
        extraProfiles.forEach((profile) => profilesById.set(profile.id, profile));
      }
    } catch (error) {
      console.warn('Analytics profile enrichment failed:', error);
    }

    const combinedReports = [
      ...reports,
      ...paymentDisputes
    ];

    const verifications = users.filter((row) => normalizeStatus('verification', row.verificationStatus || (row.isVerified ? 'approved' : 'pending')) === 'approved').length;
    const total = users.length + jobs.length + combinedReports.length + verifications;

    metrics.users.value.textContent = String(users.length);
    metrics.jobs.value.textContent = String(jobs.length);
    metrics.reports.value.textContent = String(combinedReports.length);

    metrics.users.note.textContent = usersBlocked
      ? 'Admin cannot read users yet. Check Supabase select policy for users.'
      : users.length ? `${users.length} user account(s) tracked.` : 'No analytics data yet.';
    metrics.jobs.note.textContent = jobsBlocked
      ? 'Admin cannot read job_listings yet. Check Supabase select policy for job_listings.'
      : jobs.length ? `${jobs.length} job listing(s) tracked.` : 'No analytics data yet.';
    metrics.reports.note.textContent = (reportsBlocked && paymentsBlocked)
      ? 'Admin cannot read reports yet. Check Supabase select policy for reports.'
      : combinedReports.length ? `${combinedReports.length} report/dispute case(s) tracked.` : 'No analytics data yet.';

    setShare(metrics.users.share, users.length, total);
    setShare(metrics.jobs.share, jobs.length, total);
    setShare(metrics.reports.share, combinedReports.length, total);
    setShare(metrics.verifications.share, verifications, total);
    setPieRing([users.length, jobs.length, combinedReports.length, verifications]);

    const usersByMonth = countItemsByRecentMonth(users, ['createdAt', 'created_at']);
    const jobsByMonth = countItemsByRecentMonth(jobs, ['created_at']);
    const reportsByMonth = countItemsByRecentMonth(combinedReports, ['disputed_at', 'created_at']);
    const verificationsByMonth = countItemsByRecentMonth(
      users.filter((row) => ['submitted', 'approved', 'recheck', 'rejected', 'pending'].includes(String(row.verificationStatus || '').toLowerCase())),
      ['updatedAt', 'updated_at', 'createdAt', 'created_at']
    );

    applyLine(
      { users: usersByMonth, jobs: jobsByMonth, reports: reportsByMonth, verifications: verificationsByMonth },
      getLast6MonthBuckets().map((bucket) => bucket.label)
    );

    // Persist today's snapshot into the analytics table (Table 3.20)
    const totalSeekers = users.filter((u) => normalizeUserRole(u.role) === 'jobseeker').length;
    const totalEmployers = users.filter((u) => normalizeUserRole(u.role) === 'employer').length;
    const activeListings = jobs.filter((j) => ['open', 'approved'].includes(String(j.status || '').toLowerCase())).length;
    const successfulMatches = jobs.filter((j) => String(j.status || '').toLowerCase() === 'completed').length;

    await saveAnalyticsSnapshot({
      totalUsers: users.length,
      totalSeekers,
      totalEmployers,
      activeListings,
      totalApps: 0,
      successfulMatches
    });

    analyticsRows = buildAnalyticsRows({
      users,
      jobs,
      reports,
      paymentDisputes,
      profilesById
    });

    populateStatusOptions(getRowsForSelectedType());
    renderAnalyticsTable();
  });

  initTableControls();
})();

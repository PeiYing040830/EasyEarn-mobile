/**
 * EasyEarn file note: Handles the admin dashboard page behavior and related user interactions.
 */
import { observeAuth, fetchAllProfiles, fetchJobs, fetchReports, fetchPaymentDisputes, fetchProfile } from './supabase-data.js';

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
  const metrics = {
    users: {
      value: document.getElementById('admin-dashboard-users-count'),
      note: document.getElementById('admin-dashboard-users-note'),
      share: document.getElementById('admin-dashboard-users-share')
    },
    reports: {
      value: document.getElementById('admin-dashboard-reports-count'),
      note: document.getElementById('admin-dashboard-reports-note'),
      share: document.getElementById('admin-dashboard-reports-share')
    },
    verifications: {
      value: document.getElementById('admin-dashboard-verifications-count'),
      note: document.getElementById('admin-dashboard-verifications-note'),
      share: document.getElementById('admin-dashboard-verifications-share')
    },
    flaggedJobs: {
      value: document.getElementById('admin-dashboard-flagged-jobs-count'),
      note: document.getElementById('admin-dashboard-flagged-jobs-note'),
      share: document.getElementById('admin-dashboard-jobs-share')
    }
  };
  const moderationPills = {
    reportSummary: document.getElementById('admin-dashboard-report-summary'),
    reportPriority: document.getElementById('admin-dashboard-report-priority-pill'),
    reportStatus: document.getElementById('admin-dashboard-report-status-pill'),
    verificationPending: document.getElementById('admin-dashboard-verification-pending-pill'),
    verificationApproved: document.getElementById('admin-dashboard-verification-approved-pill')
  };
  const welcomeNameEl = document.getElementById('admin-dashboard-welcome-name');

  // Formats or checks month buckets so later code can use a clean value.
  function buildMonthBuckets() {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

  // Helper function for count items by recent month used by this script.
  function countItemsByRecentMonth(items, dateFields = ['created_at', 'createdAt']) {
    const buckets = buildMonthBuckets();
    const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));

    (items || []).forEach((item) => {
      const rawDate = dateFields
        .map((field) => item?.[field])
        .find(Boolean);
      if (!rawDate) return;

      const parsed = new Date(rawDate);
      if (Number.isNaN(parsed.getTime())) return;

      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      if (counts.has(key)) {
        counts.set(key, counts.get(key) + 1);
      }
    });

    return {
      labels: buckets.map((bucket) => bucket.label),
      values: buckets.map((bucket) => counts.get(bucket.key) || 0)
    };
  }

  // Updates report queue state after the user changes something or data is refreshed.
  function setReportQueueState(reports) {
    const pendingStatuses = ['pending', 'open', 'submitted', 'flagged', 'under_review'];
    // Helper function for active reports used by this script.
    const activeReports = (reports || []).filter((report) => {
      const status = String(report?.status || '').toLowerCase();
      return pendingStatuses.includes(status);
    });
    const nextReport = activeReports[0] || reports?.[0] || null;

    if (!nextReport) {
      if (moderationPills.reportSummary) {
        moderationPills.reportSummary.textContent = 'No active cases right now. New reports will appear here for review.';
      }
      if (moderationPills.reportPriority) {
        moderationPills.reportPriority.textContent = 'Priority: -';
      }
      if (moderationPills.reportStatus) {
        moderationPills.reportStatus.textContent = 'Status: Empty';
      }
      return;
    }

    const type = String(nextReport.report_type || nextReport.type || 'general issue')
      .replace(/[_-]+/g, ' ')
      .trim();
    const status = String(nextReport.status || 'pending')
      .replace(/[_-]+/g, ' ')
      .trim();
    const description = String(nextReport.description || nextReport.dispute_desc || '').trim();
    const summary = description
      ? `${type.charAt(0).toUpperCase()}${type.slice(1)}: ${description}`
      : `Latest case involves ${type}. Review and assign follow-up action.`;

    if (moderationPills.reportSummary) {
      moderationPills.reportSummary.textContent = summary;
    }
    if (moderationPills.reportPriority) {
      moderationPills.reportPriority.textContent = `Priority: ${activeReports.length ? 'Active' : 'Queued'}`;
    }
    if (moderationPills.reportStatus) {
      moderationPills.reportStatus.textContent = `Status: ${status.charAt(0).toUpperCase()}${status.slice(1)}`;
    }
  }

  // Updates share after the user changes something or data is refreshed.
  function setShare(el, value, total) {
    if (!el) return;
    const percentage = total ? Math.round((value / total) * 100) : 0;
    el.textContent = `${percentage}%`;
  }

  // Updates pie ring after the user changes something or data is refreshed.
  function setPieRing(values) {
    const canvas = document.getElementById('admin-dashboard-donut-canvas');
    if (!canvas) return;
    const colors = ['#6d28d9', '#7c3aed', '#be185d', '#312e81'];
    const labels = ['Users', 'Reports', 'Verifications', 'Jobs'];
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

  // Helper function for apply line used by this script.
  function applyLine({ labels, userValues, reportValues, verificationValues, jobValues }) {
    const canvas = document.getElementById('admin-dashboard-line-canvas');
    if (!canvas) return;

    const datasets = [
      {
        label: 'Users',
        data: userValues,
        borderColor: '#6d28d9',
        backgroundColor: 'rgba(109,40,217,0.0)',
        tension: 0.4,
        pointBackgroundColor: '#6d28d9',
        pointRadius: 4, pointStyle: 'circle',
        fill: false
      },
      {
        label: 'Reports',
        data: reportValues,
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124,58,237,0.0)',
        tension: 0.4,
        pointBackgroundColor: '#7c3aed',
        pointRadius: 4, pointStyle: 'circle',
        fill: false
      },
      {
        label: 'Verifications',
        data: verificationValues,
        borderColor: '#be185d',
        backgroundColor: 'rgba(190,24,93,0.0)',
        tension: 0.4,
        pointBackgroundColor: '#be185d',
        pointRadius: 4, pointStyle: 'circle',
        fill: false
      },
      {
        label: 'Jobs',
        data: jobValues,
        borderColor: '#312e81',
        backgroundColor: 'rgba(49,46,129,0.0)',
        tension: 0.4,
        pointBackgroundColor: '#312e81',
        pointRadius: 4, pointStyle: 'circle',
        fill: false
      }
    ];

    if (lineChart) {
      lineChart.data.labels = labels;
      lineChart.data.datasets.forEach((ds, i) => {
        ds.data = datasets[i].data;
      });
      lineChart.update();
      return;
    }

    lineChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
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

  observeAuth(async (user) => {
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    let users = [];
    let reports = [];
    let paymentDisputes = [];

    try {
      const profile = await fetchProfile(user.id, user);
      const displayName = profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Admin';
      if (welcomeNameEl) welcomeNameEl.textContent = displayName;
    } catch (error) {
      const fallbackName = user.user_metadata?.name || user.email?.split('@')[0] || 'Admin';
      if (welcomeNameEl) welcomeNameEl.textContent = fallbackName;
    }

    try {
      users = await fetchAllProfiles();
    } catch (error) {
      console.error('Admin dashboard users load failed:', error);
    }

    try {
      reports = await fetchReports();
    } catch (error) {
      console.error('Admin dashboard reports load failed:', error);
    }

    try {
      paymentDisputes = await fetchPaymentDisputes();
    } catch (error) {
      console.error('Admin dashboard payment disputes load failed:', error);
    }

    let jobs = [];

    try {
      jobs = await fetchJobs();
    } catch (error) {
      console.error('Admin dashboard jobs load failed:', error);
    }

    const openPaymentDisputes = paymentDisputes.filter((item) => String(item.status || '').toLowerCase() !== 'resolved');
    const combinedReports = [
      ...openPaymentDisputes.map((item) => ({
        ...item,
        report_type: 'payment_dispute',
        type: 'payment dispute',
        description: item.dispute_desc || 'Payment issue reported by seeker.'
      })),
      ...reports
    ];

    const verificationsPending = users.filter((userItem) => {
      if (userItem.role !== 'employer') return false;
      const status = String(userItem.verificationStatus || '').toLowerCase();
      return ['submitted', 'recheck'].includes(status) && !userItem.isVerified;
    }).length;
    const approvedVerifications = users.filter((userItem) => userItem.role === 'employer' && userItem.isVerified).length;
    const totalVerifications = users.filter((userItem) => userItem.role === 'employer').length;
    const flaggedJobs = jobs.filter((job) => String(job.status || '').toLowerCase() === 'flagged').length;
    const totalJobs = jobs.length;
    // Use totals for pie chart so segments are visible even with no flags/reports
    const total = users.length + combinedReports.length + totalVerifications + totalJobs;

    metrics.users.value.textContent = String(users.length);
    metrics.reports.value.textContent = String(combinedReports.length);
    metrics.verifications.value.textContent = String(verificationsPending);
    metrics.flaggedJobs.value.textContent = String(totalJobs);

    metrics.users.note.textContent = users.length ? `${users.length} user account(s) in the platform.` : 'No metrics connected yet.';
    metrics.reports.note.textContent = combinedReports.length ? `${combinedReports.length} open report/dispute case(s).` : 'No active reports yet.';
    metrics.verifications.note.textContent = verificationsPending ? `${verificationsPending} employer verification request(s) waiting for review.` : 'No pending employer checks yet.';
    metrics.flaggedJobs.note.textContent = flaggedJobs ? `${flaggedJobs} job(s) currently flagged.` : `${totalJobs} total job(s) on platform.`;

    if (moderationPills.verificationPending) {
      moderationPills.verificationPending.textContent = `Pending: ${verificationsPending}`;
    }
    if (moderationPills.verificationApproved) {
      moderationPills.verificationApproved.textContent = `Approved: ${approvedVerifications}`;
    }
    setReportQueueState(combinedReports);

    setShare(metrics.users.share, users.length, total);
    setShare(metrics.reports.share, combinedReports.length, total);
    setShare(metrics.verifications.share, totalVerifications, total);
    setShare(metrics.flaggedJobs.share, totalJobs, total);
    setPieRing([users.length, combinedReports.length, totalVerifications, totalJobs]);

    const monthBuckets = buildMonthBuckets();
    const usersByMonth = countItemsByRecentMonth(users, ['createdAt', 'created_at']).values;
    const reportsByMonth = countItemsByRecentMonth(combinedReports, ['disputed_at', 'created_at', 'createdAt']).values;
    const verificationsByMonth = countItemsByRecentMonth(
      users.filter((userItem) => userItem.role === 'employer' && userItem.verificationStatus),
      ['updatedAt', 'updated_at', 'createdAt', 'created_at']
    ).values;
    const jobsByMonth = countItemsByRecentMonth(jobs, ['created_at', 'createdAt']).values;

    applyLine({
      labels: monthBuckets.map((bucket) => bucket.label),
      userValues: usersByMonth,
      reportValues: reportsByMonth,
      verificationValues: verificationsByMonth,
      jobValues: jobsByMonth
    });
  });
})();

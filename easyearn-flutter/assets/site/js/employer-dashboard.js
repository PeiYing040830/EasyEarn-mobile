/**
 * EasyEarn file note: Handles the employer dashboard page behavior and related user interactions.
 */
import { fetchEmployerApplications, fetchEmployerJobs, fetchProfile, observeAuth } from './supabase-data.js';

(function () {
  'use strict';

  let lineChart = null;
  let donutChart = null;
  const shares = {
    posted: document.getElementById('employer-dashboard-posted-share'),
    reviewed: document.getElementById('employer-dashboard-reviewed-share'),
    interviewed: document.getElementById('employer-dashboard-interviewed-share'),
    completed: document.getElementById('employer-dashboard-completed-share')
  };
  const metrics = {
    activeJobs: document.getElementById('employer-dashboard-active-jobs'),
    activeJobsNote: document.getElementById('employer-dashboard-active-jobs-note'),
    applicants: document.getElementById('employer-dashboard-applicants'),
    applicantsNote: document.getElementById('employer-dashboard-applicants-note'),
    pendingJobs: document.getElementById('employer-dashboard-pending-jobs'),
    pendingJobsNote: document.getElementById('employer-dashboard-pending-jobs-note'),
    verification: document.getElementById('employer-dashboard-verification'),
    verificationNote: document.getElementById('employer-dashboard-verification-note')
  };
  const welcomeNameEl = document.getElementById('employer-dashboard-welcome-name');

  // Formats or checks status so later code can use a clean value.
  function normalizeStatus(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('accept')) return 'accepted';
    if (raw.includes('reject')) return 'rejected';
    if (raw.includes('review')) return 'reviewed';
    return 'pending';
  }

  // Helper function for apply line used by this script.
  function applyLine(labels, trend) {
    const canvas = document.getElementById('employer-dashboard-line-canvas');
    if (!canvas) return;
    const datasets = [
      { label: 'Applied',  data: trend.applied,  borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.12)',  tension: 0.4, pointBackgroundColor: '#f59e0b', pointRadius: 4, pointStyle: 'circle', fill: false },
      { label: 'Reviewed', data: trend.reviewed, borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.12)',  tension: 0.4, pointBackgroundColor: '#d97706', pointRadius: 4, pointStyle: 'circle', fill: false },
      { label: 'Accepted', data: trend.accepted, borderColor: '#8a7068', backgroundColor: 'rgba(138,112,104,0.12)',  tension: 0.4, pointBackgroundColor: '#8a7068', pointRadius: 4, pointStyle: 'circle', fill: false },
      { label: 'Rejected', data: trend.rejected, borderColor: '#7a4f38', backgroundColor: 'rgba(122,79,56,0.12)', tension: 0.4, pointBackgroundColor: '#7a4f38', pointRadius: 4, pointStyle: 'circle', fill: false }
    ];
    if (lineChart) {
      lineChart.data.labels = labels;
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
    if (!el) return;
    el.textContent = `${total ? Math.round((value / total) * 100) : 0}%`;
  }

  // Helper function for apply pie used by this script.
  function applyPie(values) {
    const canvas = document.getElementById('employer-dashboard-donut-canvas');
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

  observeAuth(async (user) => {
    if (!user) return;

    let jobs = [];
    let applications = [];
    let profile = null;

    try {
      [jobs, applications, profile] = await Promise.all([
        fetchEmployerJobs(user.id),
        fetchEmployerApplications(user.id),
        fetchProfile(user.id, user)
      ]);
    } catch (error) {
      console.error('Failed to load employer dashboard data:', error);
    }

    if (welcomeNameEl) {
      welcomeNameEl.textContent =
        profile?.companyName ||
        profile?.businessName ||
        profile?.name ||
        user.user_metadata?.companyName ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Employer';
    }

    const postedJobs = jobs.filter((job) => {
      const status = String(job.status || '').toLowerCase();
      return !['removed', 'closed', 'expired'].includes(status);
    }).length;
    const approvedJobs = jobs.filter((job) => String(job.status || '').toLowerCase() === 'approved').length;
    const pendingJobs = jobs.filter((job) => String(job.status || '').toLowerCase() === 'pending').length;
    const reviewed = applications.filter((item) => normalizeStatus(item.status) === 'reviewed').length;
    const accepted = applications.filter((item) => normalizeStatus(item.status) === 'accepted').length;
    const rejected = applications.filter((item) => normalizeStatus(item.status) === 'rejected').length;
    const applied = applications.length;
    const total = applied + reviewed + accepted + rejected;

    metrics.activeJobs.textContent = String(approvedJobs);
    metrics.activeJobsNote.textContent = approvedJobs
      ? `${approvedJobs} job(s) are already approved and visible to job seekers.`
      : 'No active jobs yet.';

    const totalApplicants = applications.length;
    metrics.applicants.textContent = String(totalApplicants);
    metrics.applicantsNote.textContent = totalApplicants ? `${totalApplicants} application(s) received across your jobs.` : 'No applicants yet.';

    metrics.pendingJobs.textContent = String(pendingJobs);
    metrics.pendingJobsNote.textContent = pendingJobs ? `${pendingJobs} job(s) still waiting for admin review.` : 'No jobs waiting for admin review.';

    const verificationStatus = String(profile?.verificationStatus || 'pending');
    metrics.verification.textContent = profile?.isVerified ? 'Approved' : verificationStatus.charAt(0).toUpperCase() + verificationStatus.slice(1);
    metrics.verificationNote.textContent = profile?.isVerified
      ? 'Your company is verified and ready for trust badges.'
      : 'Submit company verification to unlock trust badges.';

    setShare(shares.posted, applied, total);
    setShare(shares.reviewed, reviewed, total);
    setShare(shares.interviewed, accepted, total);
    setShare(shares.completed, rejected, total);
    applyPie([applied, reviewed, accepted, rejected]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const recentMonths = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setDate(1);
      monthDate.setMonth(monthDate.getMonth() - i);
      monthDate.setHours(0, 0, 0, 0);
      recentMonths.push({
        year: monthDate.getFullYear(),
        month: monthDate.getMonth(),
        label: monthNames[monthDate.getMonth()]
      });
    }

    const monthlyTrend = {
      applied:  recentMonths.map((bucket) => applications.filter((a) => {
        const s = String(a.status || '').toLowerCase();
        const d = new Date(a.applied_at || a.created_at || 0);
        return d.getFullYear() === bucket.year && d.getMonth() === bucket.month
          && !s.includes('accept') && !s.includes('reject') && !s.includes('review') && !s.includes('interview');
      }).length),
      reviewed: recentMonths.map((bucket) => applications.filter((a) => {
        const s = String(a.status || '').toLowerCase();
        const d = new Date(a.applied_at || a.created_at || 0);
        return d.getFullYear() === bucket.year && d.getMonth() === bucket.month
          && (s.includes('review') || s.includes('interview'));
      }).length),
      accepted: recentMonths.map((bucket) => applications.filter((a) => {
        const s = String(a.status || '').toLowerCase();
        const d = new Date(a.applied_at || a.created_at || 0);
        return d.getFullYear() === bucket.year && d.getMonth() === bucket.month
          && (s.includes('accept') || s.includes('complet'));
      }).length),
      rejected: recentMonths.map((bucket) => applications.filter((a) => {
        const s = String(a.status || '').toLowerCase();
        const d = new Date(a.applied_at || a.created_at || 0);
        return d.getFullYear() === bucket.year && d.getMonth() === bucket.month && s.includes('reject');
      }).length)
    };

    applyLine(recentMonths.map((bucket) => bucket.label), monthlyTrend);
  });
})();

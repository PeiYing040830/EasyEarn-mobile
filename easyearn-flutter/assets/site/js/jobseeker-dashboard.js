/**
 * EasyEarn file note: Handles the jobseeker dashboard page behavior and related user interactions.
 */
import {
  fetchApplications,
  fetchJobs,
  fetchProfile,
  fetchSavedJobsCount,
  getInitials,
  normalizeArray,
  observeAuth,
  signOutUser
} from './supabase-data.js';

(function () {
  'use strict';

  const nameEl = document.getElementById('welcome-name');
  const subtitleEl = document.getElementById('welcome-subtitle');
  const logoutBtn = document.getElementById('logout-btn');
  let logoutName = 'Job Seeker';
  let logoutPhoto = '';

  const statsEls = {
    applicationsTotal: document.getElementById('applications-total'),
    applicationsSummary: document.getElementById('applications-summary'),
    interviewsTotal: document.getElementById('interviews-total'),
    interviewsSummary: document.getElementById('interviews-summary'),
    savedJobsTotal: document.getElementById('saved-jobs-total'),
    savedJobsSummary: document.getElementById('saved-jobs-summary'),
    pendingReviewTotal: document.getElementById('pending-review-total'),
    pendingReviewSummary: document.getElementById('pending-review-summary')
  };

  const pipelineEls = {
    pending: document.getElementById('pipeline-pending'),
    reviewed: document.getElementById('pipeline-reviewed'),
    accepted: document.getElementById('pipeline-accepted'),
    rejected: document.getElementById('pipeline-rejected')
  };

  const profileEls = {
    value: document.getElementById('profile-completeness-value'),
    bar: document.getElementById('profile-completeness-bar'),
    list: document.getElementById('profile-completeness-list')
  };

  const recommendedGrid = document.getElementById('recommended-jobs-grid');

  // Formats or checks HTML so later code can use a clean value.
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Updates welcome name after the user changes something or data is refreshed.
  function setWelcomeName(name, photoSrc = '') {
    const safeName = name || 'Job Seeker';
    if (nameEl) nameEl.textContent = safeName;
    if (subtitleEl) {
      subtitleEl.textContent = `Welcome back, ${safeName}. Track approved jobs, applications, and profile progress from one place.`;
    }

    const navName = document.getElementById('nav-user-name');
    const navBadge = document.getElementById('nav-user-badge');
    if (navName) navName.textContent = safeName;
    if (!navBadge) return;

    if (photoSrc) {
      navBadge.classList.add('has-image');
      navBadge.style.backgroundImage = `url("${photoSrc}")`;
      navBadge.textContent = '';
      return;
    }

    navBadge.classList.remove('has-image');
    navBadge.style.backgroundImage = '';
    navBadge.textContent = getInitials(safeName, 'JS');
  }

  // Formats or checks status so later code can use a clean value.
  function normalizeStatus(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('completion') && raw.includes('pend')) return 'accepted';
    if (raw.includes('complete')) return 'accepted';
    if (raw.includes('accept')) return 'accepted';
    if (raw.includes('reject')) return 'rejected';
    if (raw.includes('review')) return 'reviewed';
    return 'pending';
  }

  // Helper function for application has interview used by this script.
  function applicationHasInterview(application) {
    const status = String(application?.status || '').toLowerCase();
    return Boolean(
      application?.interview_date ||
      application?.interviewDate ||
      application?.interview_at ||
      application?.interviewAt ||
      application?.interview_scheduled ||
      application?.interviewScheduled ||
      status.includes('interview')
    );
  }

  // Formats or checks calculate profile completeness so later code can use a clean value.
  function calculateProfileCompleteness(profile) {
    const checks = [
      { label: 'Complete basic info', done: Boolean(profile?.name && profile?.email) },
      { label: 'Add skills', done: normalizeArray(profile?.skills).length > 0 },
      { label: 'Add work history', done: Boolean(profile?.experienceYears || normalizeArray(profile?.preferredCategories).length) }
    ];

    const percentage = Math.round((checks.filter((item) => item.done).length / checks.length) * 100);
    return { checks, percentage };
  }

  // Renders profile completeness into the HTML so the user can see it.
  function renderProfileCompleteness(profile) {
    const { checks, percentage } = calculateProfileCompleteness(profile);
    if (profileEls.value) profileEls.value.textContent = `${percentage}%`;
    if (profileEls.bar) profileEls.bar.style.width = `${percentage}%`;
    if (profileEls.list) {
      profileEls.list.innerHTML = checks
        .map((item) => `<li class="${item.done ? 'done' : ''}">${escapeHtml(item.label)}</li>`)
        .join('');
    }
  }

  // Renders stats into the HTML so the user can see it.
  function renderStats(applications, savedJobsCount, matchedJobsCount, interviewsCount) {
    const totals = {
      applications: applications.length,
      pending: applications.filter((item) => normalizeStatus(item.status) === 'pending').length,
      reviewed: applications.filter((item) => normalizeStatus(item.status) === 'reviewed').length,
      accepted: applications.filter((item) => normalizeStatus(item.status) === 'accepted').length,
      rejected: applications.filter((item) => normalizeStatus(item.status) === 'rejected').length
    };

    if (statsEls.applicationsTotal) statsEls.applicationsTotal.textContent = String(totals.applications);
    if (statsEls.applicationsSummary) statsEls.applicationsSummary.textContent = totals.applications ? `${totals.reviewed + totals.accepted} moved beyond pending` : 'No applications yet';
    if (statsEls.interviewsTotal) statsEls.interviewsTotal.textContent = String(interviewsCount);
    if (statsEls.interviewsSummary) statsEls.interviewsSummary.textContent = interviewsCount ? `${interviewsCount} interview${interviewsCount === 1 ? '' : 's'} scheduled` : 'No interviews scheduled';
    if (statsEls.savedJobsTotal) statsEls.savedJobsTotal.textContent = String(savedJobsCount);
    if (statsEls.savedJobsSummary) statsEls.savedJobsSummary.textContent = savedJobsCount ? `${savedJobsCount} saved for later` : 'No saved jobs yet';
    if (statsEls.pendingReviewTotal) statsEls.pendingReviewTotal.textContent = String(totals.pending);
    if (statsEls.pendingReviewSummary) statsEls.pendingReviewSummary.textContent = totals.pending ? `${matchedJobsCount} jobs match your skills` : 'Waiting for activity';

    Object.entries(pipelineEls).forEach(([key, el]) => {
      if (el) el.textContent = String(totals[key] || 0);
    });
  }

  // Formats or checks job so later code can use a clean value.
  function normalizeJob(job) {
    const payRate = job.pay_rate != null ? `RM${job.pay_rate}${job.pay_type ? ` / ${job.pay_type}` : ''}` : null;
    return {
      id: job.id,
      title: job.title || job.job_title || job.jobTitle || job.role || 'Untitled Job',
      company: job.company || job.company_name || job.companyName || job.employer_name || job.employerName || 'EasyEarn Employer',
      location: job.location || job.city || job.area || 'Location not specified',
      pay: payRate || job.salary || job.pay || job.rate || job.salary_range || job.salaryRange || 'Pay not specified',
      schedule: job.job_type || job.schedule || job.type || job.employment_type || job.employmentType || 'Flexible',
      category: job.category || job.job_category || job.jobCategory || 'General',
      verified: Boolean(job.verified || job.is_verified || job.isVerified || job.employer_verified || job.employerVerified),
      tags: normalizeArray(job.tags),
      jobSkills: normalizeArray(job.skills || job.skill_tags || job.skillTags)
    };
  }

  // Formats or checks calculate match score so later code can use a clean value.
  function calculateMatchScore(job, userSkills) {
    if (!userSkills.length) return 0;
    const haystack = [
      job.title,
      job.company,
      job.location,
      job.category,
      ...job.tags,
      ...job.jobSkills
    ].join(' ').toLowerCase();

    return userSkills.reduce((score, skill) => haystack.includes(String(skill).toLowerCase()) ? score + 1 : score, 0);
  }

  // Formats or checks match badge so later code can use a clean value.
  function formatMatchBadge(job, userSkills) {
    if (!userSkills.length) return 'New';
    if (!job.matchScore) return '—';

    const matchPercent = Math.min(99, Math.round((job.matchScore / userSkills.length) * 100));
    return `${matchPercent}% Match`;
  }

  // Renders recommended jobs into the HTML so the user can see it.
  function renderRecommendedJobs(jobs, userSkills) {
    if (!recommendedGrid) return 0;

    if (!jobs.length) {
      recommendedGrid.innerHTML = `
        <article class="dashboard-card dashboard-empty-card">
          <h3>No approved jobs yet</h3>
          <p>Employer listings will appear here after they are posted and approved.</p>
        </article>
      `;
      return 0;
    }

    const ranked = jobs
      .map((job) => ({ ...job, matchScore: calculateMatchScore(job, userSkills) }))
      .sort((a, b) => b.matchScore - a.matchScore);

    const recommended = ranked.slice(0, 3);

    recommendedGrid.innerHTML = recommended.map((job) => {
      const matchBadge = formatMatchBadge(job, userSkills);
      const badge = job.verified ? 'Verified Employer' : job.category;
      const tags = [job.category, ...job.tags].filter(Boolean).slice(0, 3);

      return `
        <article class="dashboard-card job-card">
          <div class="job-meta-row">
            <span class="pill-match">${escapeHtml(matchBadge)}</span>
            <span class="pill-verified">${escapeHtml(badge)}</span>
          </div>
          <h3>${escapeHtml(job.title)}</h3>
          <p class="job-company">${escapeHtml(job.company)}</p>
          <div class="job-detail-stack">
            <p>${escapeHtml(job.location)}</p>
            <p>${escapeHtml(job.pay)}</p>
            <p>${escapeHtml(job.schedule)}</p>
          </div>
          <div class="job-tags">
            ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
          </div>
          <div class="card-actions">
            <a href="jobs.html" class="btn-primary">Apply</a>
            <a href="jobs.html" class="btn-outline">View Details</a>
          </div>
        </article>
      `;
    }).join('');

    return ranked.filter((job) => job.matchScore > 0).length;
  }

  // Loads dashboard data data so the page can display current information.
  async function loadDashboardData(user) {
    const [profile, applicationsRaw, jobsRaw, savedJobsCount] = await Promise.all([
      fetchProfile(user.id, user),
      fetchApplications(user.id).catch(() => []),
      fetchJobs().catch(() => []),
      fetchSavedJobsCount(user.id).catch(() => 0)
    ]);

    const profileName = profile.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Job Seeker';
    const userPhoto = profile.photoData || profile.photoUrl || '';
    logoutName = profileName;
    logoutPhoto = userPhoto;
    const userSkills = normalizeArray(profile.skills);
    const applications = applicationsRaw || [];
    // Helper function for jobs used by this script.
    const jobs = (jobsRaw || [])
      .filter((job) => String(job.status || '').toLowerCase() === 'approved')
      .map(normalizeJob);
    const interviewsCount = applications.filter(applicationHasInterview).length;
    const matchedJobsCount = renderRecommendedJobs(jobs, userSkills);
    setWelcomeName(profileName, userPhoto);
    renderProfileCompleteness(profile);
    renderStats(applications, savedJobsCount, matchedJobsCount, interviewsCount);
  }

  // Handles the logout action triggered by the user.
  async function handleLogout() {
    try {
      sessionStorage.setItem('ee_logout_name', logoutName || 'Job Seeker');
      sessionStorage.setItem('ee_logout_photo', logoutPhoto || '');
    } catch (error) {
      console.warn('Unable to cache logout profile snapshot:', error);
    }

    await signOutUser();
    window.location.href = '../../logout.html';
  }

  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  // Waits until the HTML has loaded before running page setup code.
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('#nav-logout-btn');
    if (btn) handleLogout();
  });

  observeAuth(async (user) => {
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    try {
      await loadDashboardData(user);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setWelcomeName(user.user_metadata?.name || user.email?.split('@')[0] || 'Job Seeker');
      renderProfileCompleteness({});
      renderStats([], 0, 0, 0);
      if (recommendedGrid) {
        recommendedGrid.innerHTML = `
          <article class="dashboard-card dashboard-empty-card">
            <h3>Something went wrong</h3>
            <p>Please refresh the page or try again later.</p>
          </article>
        `;
      }
    }
  });
})();

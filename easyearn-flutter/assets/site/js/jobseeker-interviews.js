/**
 * EasyEarn file note: Handles the jobseeker interviews page behavior and related user interactions.
 */
import {
  confirmInterviewAttendance,
  fetchApplicationsWithInterview,
  fetchJobs,
  observeAuth
} from './supabase-data.js';

(function () {
  'use strict';

  const upcomingListEl = document.getElementById('int-upcoming-list');
  const pastListEl     = document.getElementById('int-past-list');
  const emptySection   = document.getElementById('int-empty-section');
  const scheduledEl    = document.getElementById('int-scheduled-count');
  const scheduledNote  = document.getElementById('int-scheduled-note');
  const upcomingEl     = document.getElementById('int-upcoming-count');
  const upcomingNote   = document.getElementById('int-upcoming-note');
  const pastEl         = document.getElementById('int-past-count');
  const pastNote       = document.getElementById('int-past-note');

  // Formats or checks HTML so later code can use a clean value.
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Formats or checks date so later code can use a clean value.
  function formatDate(value) {
    if (!value) return 'Date not set';
    return new Date(value).toLocaleString('en-MY', {
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  // Formats or checks date short so later code can use a clean value.
  function formatDateShort(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-MY', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  // Formats or checks attendance confirmed so later code can use a clean value.
  function isAttendanceConfirmed(application) {
    return Boolean(application?.attendance_confirmed_at);
  }

  // Loads days until data so the page can display current information.
  function getDaysUntil(dateStr) {
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // Formats or checks card so later code can use a clean value.
  function buildCard(application, job, isPast) {
    const title    = job?.title    || 'Job Interview';
    const company  = job?.company  || job?.employer_name || 'EasyEarn Employer';
    const employerId = job?.employer_id || '';
    const location = application.interview_location || 'Location not specified';
    const notes    = application.interview_notes    || '';
    const dateStr  = formatDate(application.interview_date);
    const daysLeft = getDaysUntil(application.interview_date);
    const attendanceConfirmed = isAttendanceConfirmed(application);
    const messageHref = employerId
      ? `messages.html?${new URLSearchParams({
          user: employerId,
          name: company,
          jobId: application.job_id || '',
          job: title
        }).toString()}`
      : 'messages.html';

    let badge = '';
    if (!isPast) {
      if (daysLeft === 0) badge = `<span class="status-pill accepted">Today!</span>`;
      else if (daysLeft === 1) badge = `<span class="status-pill accepted">Tomorrow</span>`;
      else if (daysLeft <= 3) badge = `<span class="status-pill reviewed">In ${daysLeft} days</span>`;
      else badge = `<span class="status-pill pending">In ${daysLeft} days</span>`;
    } else {
      badge = `<span class="status-pill reviewed">Completed</span>`;
    }

    return `
      <article class="jobseeker-item application-item">
        <div class="application-main">
          <div class="application-title-row">
            <h3>${escapeHtml(title)}</h3>
            ${badge}
          </div>
          <div class="application-summary">
            <p class="application-company">${escapeHtml(company)}</p>
            <p>📅 <strong>${escapeHtml(dateStr)}</strong></p>
            <p>📍 ${escapeHtml(location)}</p>
            ${notes ? `<p>📝 ${escapeHtml(notes)}</p>` : ''}
          </div>
          <div class="application-meta">
            <span>Application status: ${escapeHtml(application.status || 'accepted')}</span>
            ${!isPast && attendanceConfirmed ? '<span>Attendance confirmed</span>' : ''}
          </div>
        </div>
        <div class="jobs-card-actions interview-card-actions">
          ${
            !isPast
              ? (
                  attendanceConfirmed
                    ? '<button type="button" class="btn-outline interview-action-btn btn-disabled" disabled>Attendance Confirmed</button>'
                    : `<button type="button" class="btn-primary interview-action-btn confirm-attendance-btn" data-application-id="${escapeHtml(application.id)}" data-interview-date="${escapeHtml(formatDateShort(application.interview_date))}">Confirm Attendance</button>`
                )
              : ''
          }
          <a href="applications.html" class="btn-outline interview-action-btn">View Application</a>
          <a href="${escapeHtml(messageHref)}" class="btn-primary interview-action-btn">Open Chat</a>
        </div>
      </article>`;
  }

  // Renders stats into the HTML so the user can see it.
  function renderStats(scheduled, upcoming, past) {
    if (scheduledEl)   scheduledEl.textContent   = String(scheduled);
    if (scheduledNote) scheduledNote.textContent  = scheduled ? `${scheduled} interview(s) confirmed.` : 'No confirmed interviews yet.';
    if (upcomingEl)    upcomingEl.textContent     = String(upcoming);
    if (upcomingNote)  upcomingNote.textContent   = upcoming ? `${upcoming} upcoming interview(s).` : 'No upcoming interviews.';
    if (pastEl)        pastEl.textContent         = String(past);
    if (pastNote)      pastNote.textContent       = past ? `${past} completed interview(s).` : 'No completed interviews yet.';
  }

  // Renders upcoming into the HTML so the user can see it.
  function renderUpcoming(applications, jobsById) {
    if (!upcomingListEl) return;
    if (!applications.length) {
      upcomingListEl.innerHTML = `
        <article class="jobseeker-item application-item">
          <div class="application-main">
            <div class="application-title-row">
              <h3>No upcoming interviews</h3>
              <span class="status-pill pending">Empty</span>
            </div>
            <div class="application-summary">
              <p>When an employer confirms an interview date, it will appear here.</p>
            </div>
          </div>
        </article>`;
      return;
    }
    upcomingListEl.innerHTML = applications
      .map((a) => buildCard(a, jobsById.get(a.job_id), false))
      .join('');
  }

  // Renders past into the HTML so the user can see it.
  function renderPast(applications, jobsById) {
    if (!pastListEl) return;
    if (!applications.length) {
      pastListEl.innerHTML = `
        <article class="jobseeker-item application-item">
          <div class="application-main">
            <div class="application-title-row">
              <h3>No completed interviews yet</h3>
              <span class="status-pill reviewed">Empty</span>
            </div>
          </div>
        </article>`;
      return;
    }
    pastListEl.innerHTML = applications
      .map((a) => buildCard(a, jobsById.get(a.job_id), true))
      .join('');
  }

  // Sets up attendance actions when this script is loaded.
  function bindAttendanceActions() {
    document.querySelectorAll('.confirm-attendance-btn').forEach((button) => {
      // Connects this element event to the handler that should run next.
      button.addEventListener('click', async () => {
        const applicationId = button.dataset.applicationId;
        const interviewDate = button.dataset.interviewDate || 'this interview';
        if (!applicationId) return;
        if (!confirm(`Confirm that you can attend the interview on ${interviewDate}?`)) return;
        button.disabled = true;
        button.textContent = 'Confirming...';

        try {
          await confirmInterviewAttendance(applicationId);
        } catch (err) {
          console.error('Failed to confirm interview attendance:', err);
          button.disabled = false;
          button.textContent = 'Confirm Attendance';
          alert(err?.message || 'Unable to confirm attendance right now.');
          return;
        }

        button.disabled = true;
        button.classList.add('btn-disabled');
        button.textContent = 'Attendance Confirmed';

        const meta = button.closest('.application-item')?.querySelector('.application-meta');
        if (meta && !meta.textContent.includes('Attendance confirmed')) {
          meta.insertAdjacentHTML('beforeend', '<span>Attendance confirmed</span>');
        }
      });
    });
  }

  observeAuth(async (user) => {
    if (!user) { window.location.href = '../../login.html'; return; }

    try {
      const [interviewsResult, jobsResult] = await Promise.allSettled([
        fetchApplicationsWithInterview(user.id),
        fetchJobs()
      ]);

      const interviews = interviewsResult.status === 'fulfilled' ? (interviewsResult.value || []) : [];
      const jobs       = jobsResult.status === 'fulfilled' ? (jobsResult.value || []) : [];

      const jobsById = new Map(jobs.map((j) => [j.id, {
        title:         j.title,
        company:       j.company || j.employer_name,
        employer_name: j.employer_name,
        employer_id:   j.employer_id || ''
      }]));

      const now       = new Date();
      const upcoming  = interviews.filter((a) => new Date(a.interview_date) >= now)
                                  .sort((a, b) => new Date(a.interview_date) - new Date(b.interview_date));
      const past      = interviews.filter((a) => new Date(a.interview_date) < now)
                                  .sort((a, b) => new Date(b.interview_date) - new Date(a.interview_date));

      renderStats(interviews.length, upcoming.length, past.length);
      renderUpcoming(upcoming, jobsById);
      renderPast(past, jobsById);
      bindAttendanceActions();

      // Show empty section if no interviews at all
      if (emptySection) emptySection.style.display = interviews.length ? 'none' : 'block';

    } catch (err) {
      console.error('Failed to load interviews:', err);
      if (upcomingListEl) upcomingListEl.innerHTML = `
        <article class="jobseeker-item application-item">
          <div class="application-main">
            <div class="application-title-row">
              <h3>Unable to load interviews</h3>
              <span class="status-pill rejected">Error</span>
            </div>
            <div class="application-summary">
              <p>${String(err?.message || 'Unknown error')}</p>
            </div>
          </div>
        </article>`;
    }
  });
})();

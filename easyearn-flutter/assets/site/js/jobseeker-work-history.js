/**
 * EasyEarn file note: Handles the jobseeker work history page behavior and related user interactions.
 */
import {
  fetchApplications,
  localCalendarDate,
  fetchJobs,
  fetchProfile,
  fetchPaymentByApplication,
  fetchRatings,
  fetchWorkHistory,
  fetchRatingsByReviewer,
  getInitials,
  insertWorkHistory,
  observeAuth,
  syncWorkHistoryEarningsFromPayment,
  upsertRating
} from './supabase-data.js';

(function () {
  'use strict';

  const form = document.getElementById('work-history-form');
  const statusEl = document.getElementById('work-history-status');
  const saveBtn = document.getElementById('save-work-history-btn');
  const historyListEl = document.getElementById('history-list');

  const fields = {
    jobTitle: document.getElementById('history-job-title'),
    company: document.getElementById('history-company'),
    category: document.getElementById('history-category'),
    location: document.getElementById('history-location'),
    completedDate: document.getElementById('history-completed-date'),
    earnings: document.getElementById('history-earnings'),
    rating: document.getElementById('history-rating'),
    period: document.getElementById('history-period'),
    highlights: document.getElementById('history-highlights')
  };

  const summaryEls = {
    totalJobs: document.getElementById('history-total-jobs'),
    totalJobsCopy: document.getElementById('history-total-jobs-copy'),
    totalEarnings: document.getElementById('history-total-earnings'),
    totalEarningsCopy: document.getElementById('history-total-earnings-copy'),
    topCategory: document.getElementById('history-top-category'),
    topCategoryCopy: document.getElementById('history-top-category-copy'),
    savedTrack: document.getElementById('history-saved-track'),
    savedCount: document.getElementById('history-saved-count'),
    resumeTrack: document.getElementById('history-resume-track'),
    resumeStatus: document.getElementById('history-resume-status')
  };

  let currentUser = null;
  let isSaving = false;
  let ratedApplicationIds = new Set(); // track which jobs seeker already rated
  let employerRatingsByApplication = new Map();

  // ── Rate Employer Modal ───────────────────────────────────────────────────
  const rateModal = document.getElementById('rate-employer-modal');
  const rateModalTitle = document.getElementById('rate-modal-title');
  const rateModalJob = document.getElementById('rate-modal-job');
  const rateStarRow = document.getElementById('rate-star-row');
  const rateStarLabel = document.getElementById('rate-star-label');
  const rateReviewText = document.getElementById('rate-review-text');
  const rateModalStatus = document.getElementById('rate-modal-status');
  const rateModalSubmit = document.getElementById('rate-modal-submit');

  let selectedStars = 0;
  let activeRateData = null; // { applicationId, employerId, employerName, jobTitle }

  const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  // Updates stars after the user changes something or data is refreshed.
  function setStars(n) {
    selectedStars = n;
    rateStarRow.querySelectorAll('span').forEach((s) => {
      s.textContent = Number(s.dataset.star) <= n ? '★' : '☆';
      s.style.color = Number(s.dataset.star) <= n ? '#f59e0b' : '#d1d5db';
    });
    if (rateStarLabel) rateStarLabel.textContent = n ? STAR_LABELS[n] : 'Click a star to rate';
  }

  // Helper function for open rate modal used by this script.
  function openRateModal(data) {
    activeRateData = data;
    selectedStars = 0;
    if (rateModalTitle) rateModalTitle.textContent = data.employerName || 'Employer';
    if (rateModalJob) rateModalJob.textContent = data.jobTitle || '';
    if (rateReviewText) rateReviewText.value = '';
    if (rateModalStatus) rateModalStatus.textContent = '';
    setStars(0);
    if (rateModal) { rateModal.style.display = 'flex'; }
  }

  // Runs the rate modal step for this page workflow.
  function closeRateModal() {
    if (rateModal) rateModal.style.display = 'none';
    activeRateData = null;
    selectedStars = 0;
  }

  if (rateStarRow) {
    rateStarRow.querySelectorAll('span').forEach((star) => {
      // Connects this element event to the handler that should run next.
      star.addEventListener('click', () => setStars(Number(star.dataset.star)));
      // Connects this element event to the handler that should run next.
      star.addEventListener('mouseover', () => {
        rateStarRow.querySelectorAll('span').forEach((s) => {
          s.textContent = Number(s.dataset.star) <= Number(star.dataset.star) ? '★' : '☆';
          s.style.color = Number(s.dataset.star) <= Number(star.dataset.star) ? '#f59e0b' : '#d1d5db';
        });
      });
      // Connects this element event to the handler that should run next.
      star.addEventListener('mouseout', () => setStars(selectedStars));
    });
  }

  document.getElementById('rate-modal-close')?.addEventListener('click', closeRateModal);
  document.getElementById('rate-modal-cancel')?.addEventListener('click', closeRateModal);
  rateModal?.addEventListener('click', (e) => { if (e.target === rateModal) closeRateModal(); });

  if (rateModalSubmit) {
    // Connects this element event to the handler that should run next.
    rateModalSubmit.addEventListener('click', async () => {
      if (!selectedStars) {
        if (rateModalStatus) rateModalStatus.textContent = 'Please select a star rating.';
        return;
      }
      if (!activeRateData || !currentUser) return;

      rateModalSubmit.disabled = true;
      rateModalSubmit.textContent = 'Submitting...';
      if (rateModalStatus) rateModalStatus.textContent = '';

      try {
        // Look up employer_id from job_listings via application if not already known
        let rateeId = activeRateData.employerId;
        if (!rateeId && activeRateData.applicationId) {
          try {
            const { supabase: sb } = await import('./supabase-config.js');
            const { data: appData } = await sb
              .from('applications')
              .select('job_id')
              .eq('id', activeRateData.applicationId)
              .maybeSingle();
            if (appData?.job_id) {
              const { data: jobData } = await sb
                .from('job_listings')
                .select('employer_id')
                .eq('id', appData.job_id)
                .maybeSingle();
              rateeId = jobData?.employer_id || null;
            }
          } catch (lookupErr) {
            console.warn('Could not look up employer_id:', lookupErr);
          }
        }

        await upsertRating({
          rater_id: currentUser.id,
          ratee_id: rateeId,
          application_id: activeRateData.applicationId || null,
          stars: selectedStars,
          review: rateReviewText?.value.trim() || null,
          reviewer_role: 'seeker'
        });

        // Mark as rated so button changes
        if (activeRateData.applicationId) {
          ratedApplicationIds.add(activeRateData.applicationId);
        }

        // Update the button in the list
        const btn = historyListEl?.querySelector(`.rate-employer-btn[data-application-id="${activeRateData.applicationId}"]`);
        if (btn) {
          btn.textContent = `★ ${selectedStars}/5`;
          btn.disabled = true;
          btn.style.background = '#f0fdf4';
          btn.style.color = '#16a34a';
          btn.style.borderColor = '#86efac';
        }

        closeRateModal();
      } catch (err) {
        console.error('Rating failed:', err);
        if (rateModalStatus) rateModalStatus.textContent = 'Failed to submit. Please try again.';
      } finally {
        rateModalSubmit.disabled = false;
        rateModalSubmit.textContent = 'Submit Rating';
      }
    });
  }

  // Formats or checks status so later code can use a clean value.
  function normalizeStatus(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('completion') && raw.includes('pend')) return 'completion_pending';
    if (raw.includes('complete')) return 'completed';
    if (raw.includes('accept')) return 'accepted';
    if (raw.includes('reject')) return 'rejected';
    if (raw.includes('review')) return 'reviewed';
    return 'pending';
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

  // Updates header name after the user changes something or data is refreshed.
  function updateHeaderName(name, photoSrc = '') {
    const navName = document.getElementById('nav-user-name');
    const navBadge = document.getElementById('nav-user-badge');
    if (navName) navName.textContent = name || 'Job Seeker';
    if (!navBadge) return;

    if (photoSrc) {
      navBadge.classList.add('has-image');
      navBadge.style.backgroundImage = `url("${photoSrc}")`;
      navBadge.textContent = '';
      return;
    }

    navBadge.classList.remove('has-image');
    navBadge.style.backgroundImage = '';
    navBadge.textContent = getInitials(name || 'Job Seeker', 'JS');
  }

  // Helper function for notify status used by this script.
  function notifyStatus(message, isError = false) {
    const text = String(message || '');
    const shouldShow = isError || /\b(saved|submitted|updated|success|unable|failed|error|wrong|required|cannot)\b/i.test(text);
    if (!shouldShow) return;
    window.EasyEarnToast?.show(text, isError || /\b(unable|failed|error|wrong|required|cannot)\b/i.test(text) ? 'error' : 'success');
  }

  // Updates status after the user changes something or data is refreshed.
  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', isError);
    statusEl.classList.toggle('is-success', !isError && message.toLowerCase().includes('saved'));
    notifyStatus(message, isError);
  }

  // Updates saving state after the user changes something or data is refreshed.
  function setSavingState(saving) {
    isSaving = saving;
    if (!saveBtn) return;
    saveBtn.disabled = saving;
    saveBtn.textContent = saving ? 'Saving...' : 'Save Work Record';
  }

  // Formats or checks highlights so later code can use a clean value.
  function normalizeHighlights(value) {
    return String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  // Formats or checks currency so later code can use a clean value.
  function formatCurrency(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 'RM0';
    return `RM${amount.toLocaleString('en-MY', { maximumFractionDigits: 0 })}`;
  }

  // Formats or checks display date so later code can use a clean value.
  function formatDisplayDate(value) {
    if (!value) return 'Date not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  // Formats or checks payment confirmed so later code can use a clean value.
  function isPaymentConfirmed(payment) {
    return !!(payment?.seeker_confirmed_at || payment?.status === 'confirmed' || payment?.payee_confirmed);
  }

  // Formats or checks payload so later code can use a clean value.
  function buildPayload() {
    return {
      user_id: currentUser.id,
      job_title: fields.jobTitle.value.trim(),
      employer_name: fields.company.value.trim(),
      category: fields.category.value.trim(),
      start_date: null,
      end_date: fields.completedDate.value,
      earnings: fields.earnings.value ? Number(fields.earnings.value) : 0,
      rating: fields.rating?.value ? Number(fields.rating.value) : null,
      created_at: new Date().toISOString()
    };
  }

  // Formats or checks future date so later code can use a clean value.
  function isFutureDate(value) {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  }

  // Helper function for validate payload used by this script.
  function validatePayload(payload) {
    if (!payload.job_title) return 'Please enter the job title.';
    if (payload.job_title.length < 3) return 'Job title must be at least 3 characters.';
    if (!payload.employer_name) return 'Please enter the company name.';
    if (payload.employer_name.length < 2) return 'Company name must be at least 2 characters.';
    if (!payload.end_date) return 'Please choose the completed date.';
    if (isFutureDate(payload.end_date)) return 'Completed date cannot be in the future.';
    if (!Number.isFinite(payload.earnings) || payload.earnings <= 0) return 'Total earnings must be greater than 0.';
    if (payload.rating !== null && (!Number.isFinite(payload.rating) || payload.rating < 0 || payload.rating > 5)) {
      return 'Rating must be between 0 and 5.';
    }
    return '';
  }

  // Helper function for reset form used by this script.
  function resetForm() {
    form?.reset();
  }

  // Renders summary into the HTML so the user can see it.
  function renderSummary(items) {
    const totalJobs = items.length;
    const totalEarnings = items.reduce((sum, item) => sum + Number(item.earnings || 0), 0);
    const categoryCount = new Map();

    items.forEach((item) => {
      const category = item.category || 'Uncategorized';
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    });

    const topCategory = Array.from(categoryCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    if (summaryEls.totalJobs) summaryEls.totalJobs.textContent = String(totalJobs);
    if (summaryEls.totalJobsCopy) summaryEls.totalJobsCopy.textContent = totalJobs ? `${totalJobs} completed job${totalJobs === 1 ? '' : 's'} saved in your history.` : 'No completed jobs saved yet.';
    if (summaryEls.totalEarnings) summaryEls.totalEarnings.textContent = formatCurrency(totalEarnings);
    if (summaryEls.totalEarningsCopy) summaryEls.totalEarningsCopy.textContent = totalJobs ? 'Combined income from your saved completed gigs.' : 'Add finished gigs to track income.';
    if (summaryEls.topCategory) summaryEls.topCategory.textContent = topCategory;
    if (summaryEls.topCategoryCopy) summaryEls.topCategoryCopy.textContent = totalJobs ? 'Your strongest category based on saved records.' : 'Your strongest category will appear here.';
    if (summaryEls.savedCount) summaryEls.savedCount.textContent = String(totalJobs);
    if (summaryEls.savedTrack) summaryEls.savedTrack.style.width = `${Math.min(totalJobs * 20, 100)}%`;
    if (summaryEls.resumeTrack) summaryEls.resumeTrack.style.width = totalJobs ? '100%' : '12%';
    if (summaryEls.resumeStatus) summaryEls.resumeStatus.textContent = totalJobs ? 'Yes' : 'No';
  }

  // Renders history list into the HTML so the user can see it.
  function renderHistoryList(items) {
    if (!historyListEl) return;

    if (!items.length) {
      historyListEl.innerHTML = `
        <div class="jobseeker-item history-item">
          <div>
            <strong>No work history yet</strong>
            <p>Saved records will show up here.</p>
            <p>Add your first completed gig using the form above.</p>
          </div>
        </div>
      `;
      return;
    }

    historyListEl.innerHTML = items.map((item) => {
      const alreadyRated = item.applicationId && ratedApplicationIds.has(item.applicationId);
      const earnings = Number(item.earnings || 0);
      const rateBtn = item.applicationId
        ? alreadyRated
          ? `<button type="button" class="btn-outline rate-employer-btn" data-application-id="${escapeHtml(item.applicationId)}" disabled style="font-size:0.75rem;padding:4px 10px;background:#f0fdf4;color:#16a34a;border-color:#86efac;">★ Rated</button>`
          : `<button type="button" class="btn-outline rate-employer-btn" data-application-id="${escapeHtml(item.applicationId)}" data-employer-name="${escapeHtml(item.company || '')}" data-job-title="${escapeHtml(item.jobTitle || item.title || '')}" data-employer-id="${escapeHtml(item.employerId || '')}" style="font-size:0.75rem;padding:4px 10px;">⭐ Rate Employer</button>`
        : '';
      const earningsSyncControl = item.applicationId
        ? earnings > 0
          ? `<span class="status-pill accepted" style="font-size:0.75rem;padding:4px 10px;">Earnings Saved</span>`
          : `<button type="button" class="btn-outline sync-earnings-btn" style="font-size:0.75rem;padding:4px 10px;" data-application-id="${escapeHtml(item.applicationId)}">ðŸ”„ Sync Earnings</button>`
        : '';

      return `
      <div class="jobseeker-item history-item" data-application-id="${escapeHtml(item.applicationId || '')}">
        <div>
          <strong>${escapeHtml(item.jobTitle || item.title || 'Completed Job')}</strong>
          <p>${escapeHtml(item.company || 'Employer not set')}</p>
          <p>${escapeHtml(item.completedOn || item.period || item.completedDate || 'Date not set')}</p>
          ${item.highlights?.length ? `<p>${escapeHtml(item.highlights[0])}</p>` : ''}
          ${employerRatingsByApplication.has(item.applicationId) ? (() => {
            const rating = employerRatingsByApplication.get(item.applicationId);
            const stars = Math.max(0, Math.min(5, Math.round(Number(rating.stars) || 0)));
            const date = rating.created_at ? new Date(rating.created_at).toLocaleDateString() : '';
            return `<div class="history-employer-review">
              <div class="history-review-heading"><strong>Employer rating</strong><span aria-label="${stars} out of 5 stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span></div>
              <p>${escapeHtml(String(rating.review || '').trim() || 'No written comment.')}</p>
              ${date ? `<small>${escapeHtml(date)}</small>` : ''}
            </div>`;
          })() : ''}
        </div>
        <div class="application-meta">
          ${item.location ? `<span>${escapeHtml(item.location)}</span>` : ''}
          <span class="earnings-display">${escapeHtml(formatCurrency(item.earnings || 0))}</span>
          ${item.rating ? `<span>⭐ ${escapeHtml(String(item.rating))}/5</span>` : ''}
          ${item.category ? `<span>${escapeHtml(item.category)}</span>` : ''}
          ${rateBtn}
          ${item.applicationId ? `<button type="button" class="btn-outline sync-earnings-btn" style="font-size:0.75rem;padding:4px 10px;" data-application-id="${escapeHtml(item.applicationId)}">🔄 Sync Earnings</button>` : ''}
        </div>
      </div>
    `;
    }).join('');

    historyListEl.querySelectorAll('.sync-earnings-btn').forEach((btn) => {
      const card = btn.closest('.history-item');
      const amountText = card?.querySelector('.earnings-display')?.textContent || '';
      const amount = Number(amountText.replace(/[^\d.]/g, ''));
      if (Number.isFinite(amount) && amount > 0) {
        const savedPill = document.createElement('span');
        savedPill.className = 'status-pill accepted';
        savedPill.style.fontSize = '0.75rem';
        savedPill.style.padding = '4px 10px';
        savedPill.textContent = 'Earnings Saved';
        btn.replaceWith(savedPill);
      }
    });

    // Rate employer button handler
    historyListEl.querySelectorAll('.rate-employer-btn:not([disabled])').forEach((btn) => {
      // Connects this element event to the handler that should run next.
      btn.addEventListener('click', () => {
        openRateModal({
          applicationId: btn.dataset.applicationId,
          employerId: btn.dataset.employerId,
          employerName: btn.dataset.employerName,
          jobTitle: btn.dataset.jobTitle
        });
      });
    });
    historyListEl.querySelectorAll('.sync-earnings-btn').forEach((btn) => {
      // Connects this element event to the handler that should run next.
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.applicationId;
        if (!appId) return;
        btn.disabled = true;
        btn.textContent = 'Syncing…';
        try {
          const updated = await syncWorkHistoryEarningsFromPayment(appId);
          if (updated?.syncSkipped) {
            btn.textContent = 'No payment amount';
            btn.disabled = false;
          } else if (updated) {
            const card = btn.closest('.history-item');
            const display = card?.querySelector('.earnings-display');
            if (display) display.textContent = formatCurrency(Number(updated.earnings || 0));
            btn.textContent = '✅ Synced';
          } else {
            btn.textContent = 'No payment found';
            btn.disabled = false;
          }
        } catch (err) {
          btn.textContent = 'Error';
          btn.disabled = false;
          console.error('Sync failed:', err);
        }
      });
    });
  }

  // Loads history data so the page can display current information.
  async function loadHistory(uid) {
    let items = await fetchWorkHistory(uid);

    try {
      const receivedRatings = await fetchRatings(uid);
      employerRatingsByApplication = new Map((receivedRatings || [])
        .filter((rating) => String(rating.reviewer_role || '').toLowerCase() === 'employer'
          && rating.reviewee_id === uid && rating.application_id)
        .map((rating) => [rating.application_id, rating]));
    } catch (error) {
      console.warn('Employer ratings could not be loaded for work history:', error);
      employerRatingsByApplication = new Map();
    }

    // Load existing ratings by this seeker so we know which jobs are already rated
    try {
      const existingRatings = await fetchRatingsByReviewer(uid);
      ratedApplicationIds = new Set(
        (existingRatings || [])
          .filter(r => r.reviewer_role === 'seeker' && r.application_id)
          .map(r => r.application_id)
      );
    } catch (e) {
      ratedApplicationIds = new Set();
    }

    try {
      const [applications, jobs] = await Promise.all([
        fetchApplications(uid),
        fetchJobs()
      ]);

      const jobsById = new Map((jobs || []).map((job) => [job.id, job]));
      const applicationStatusById = new Map((applications || []).map((application) => [application.id, normalizeStatus(application.status)]));
      // Helper function for completed apps used by this script.
      const completedApps = (applications || []).filter((application) => normalizeStatus(application.status) === 'completed');
      const paymentResults = await Promise.all(
        completedApps.map((application) => fetchPaymentByApplication(application.id).catch(() => null))
      );
      const paymentByApplicationId = new Map(
        completedApps.map((application, index) => [application.id, paymentResults[index] || null])
      );
      // Loads payment amount data so the page can display current information.
      const getPaymentAmount = (applicationId, fallbackEarnings = 0) => {
        const fallback = Number(fallbackEarnings || 0);
        const paymentAmount = Number(paymentByApplicationId.get(applicationId)?.amount || 0);
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
          return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
        }
        const application = completedApps.find((item) => item.id === applicationId);
        const job = application ? (jobsById.get(application.job_id) || {}) : {};
        const payRate = Number(job.pay_rate || 0);
        if (Number.isFinite(payRate) && payRate > 0 && Math.abs(paymentAmount - payRate) < 0.01) {
          return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
        }
        return paymentAmount;
      };
      const confirmedApplicationIds = new Set(
        completedApps
          .filter((application, index) => isPaymentConfirmed(paymentResults[index]))
          .map((application) => application.id)
      );
      items = (items || []).filter((item) => {
        if (!item.applicationId) return true;
        return applicationStatusById.get(item.applicationId) === 'completed'
          && confirmedApplicationIds.has(item.applicationId);
      }).map((item) => {
        if (!item.applicationId) return item;
        return {
          ...item,
          earnings: getPaymentAmount(item.applicationId, item.earnings)
        };
      });
      const existingKeys = new Set(
        (items || []).map((item) => [
          String(item.jobTitle || '').trim().toLowerCase(),
          String(item.company || '').trim().toLowerCase(),
          String(item.completedDate || '').trim()
        ].join('::'))
      );

      for (const application of completedApps) {
        if (!confirmedApplicationIds.has(application.id)) continue;
        const job = jobsById.get(application.job_id) || {};
        const payment = paymentByApplicationId.get(application.id);
        const completedDate = payment?.seeker_confirmed_at
          ? localCalendarDate(payment.seeker_confirmed_at) : null;
        const key = [
          String(job.title || 'Completed Job').trim().toLowerCase(),
          String(job.company || job.company_name || job.employer_name || 'EasyEarn Employer').trim().toLowerCase(),
          completedDate
        ].join('::');

        if (existingKeys.has(key)) continue;

        await insertWorkHistory({
          user_id: uid,
          application_id: application.id,
          job_title: job.title || 'Completed Job',
          employer_name: job.company || job.company_name || job.employer_name || 'EasyEarn Employer',
          category: job.category || null,
          start_date: null,
          end_date: completedDate,
          earnings: getPaymentAmount(application.id)
        });

        existingKeys.add(key);
      }

      items = await fetchWorkHistory(uid);
      items = (items || []).filter((item) => {
        if (!item.applicationId) return true;
        return applicationStatusById.get(item.applicationId) === 'completed'
          && confirmedApplicationIds.has(item.applicationId);
      }).map((item) => {
        if (!item.applicationId) return item;
        return {
          ...item,
          earnings: getPaymentAmount(item.applicationId, item.earnings)
        };
      });

      // Attach employer_id to each item so Rate Employer modal can pass correct ratee_id
      const appById = new Map((applications || []).map(a => [a.id, a]));
      items = items.map(item => {
        if (!item.applicationId) return item;
        const app = appById.get(item.applicationId);
        const job = jobsById.get(app?.job_id);
        return { ...item, employerId: job?.employer_id || '' };
      });
    } catch (syncError) {
      console.warn('Work history sync fallback failed:', syncError);
    }

    renderSummary(items);
    renderHistoryList(items);
  }

  // Runs the history step for this page workflow.
  async function saveHistory(event) {
    event.preventDefault();
    if (!currentUser || isSaving) return;

    const payload = buildPayload();
    const validationError = validatePayload(payload);
    if (validationError) {
      setStatus(validationError, true);
      return;
    }

    setSavingState(true);
    setStatus('Saving work record...');

    try {
      await insertWorkHistory(payload);
      resetForm();
      setStatus('Work record saved successfully.');
      await loadHistory(currentUser.id);
    } catch (error) {
      console.error('Failed to save work history:', error);
      setStatus('Something went wrong. Please refresh the page or try again later.', true);
    } finally {
      setSavingState(false);
    }
  }

  if (form) {
    // Connects this element event to the handler that should run next.
    form.addEventListener('submit', saveHistory);
  }

  observeAuth(async (user) => {
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    currentUser = user;
    try {
      const profile = await fetchProfile(user.id, user);
      updateHeaderName(profile.name || user.user_metadata?.name || 'Job Seeker', profile.photoData || profile.photoUrl || '');
    } catch (error) {
      console.error('Failed to load profile for work history:', error);
      updateHeaderName(user.user_metadata?.name || 'Job Seeker');
    }

    await loadHistory(user.id);
  });
})();

/**
 * EasyEarn file note: Handles the jobseeker resume page behavior and related user interactions.
 */
import {
  fetchProfile,
  fetchWorkHistory,
  fetchApplications,
  fetchJobs,
  fetchPaymentByApplication,
  fetchRatings,
  fetchRatingsByApplications,
  calcAverageRating,
  getInitials,
  observeAuth
} from './supabase-data.js';

(function () {
  'use strict';

  const els = {
    photo: document.getElementById('resume-photo'),
    name: document.getElementById('resume-name'),
    role: document.getElementById('resume-role'),
    email: document.getElementById('resume-email'),
    phone: document.getElementById('resume-phone'),
    location: document.getElementById('resume-location'),
    profile: document.getElementById('resume-profile-text'),
    skills: document.getElementById('resume-skills-list'),
    availability: document.getElementById('resume-availability-list'),
    workList: document.getElementById('resume-work-list'),
    gigs: document.getElementById('resume-stat-gigs'),
    rating: document.getElementById('resume-stat-rating'),
    recentReview: document.getElementById('resume-stat-recent-review'),
    education: document.getElementById('resume-education-list'),
    references: document.getElementById('resume-references-list'),
    downloadBtn: document.getElementById('resume-download-btn'),
    refreshBtn: document.getElementById('resume-refresh-btn')
  };

  const resumePaper = document.querySelector('.resume-paper');
  let activeUser = null;
  let refreshResumeData = null;

  // Formats or checks HTML so later code can use a clean value.
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Formats or checks array so later code can use a clean value.
  function normalizeArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  // ── Same status/payment helpers as work-history.js, kept in sync ─────────
  function normalizeStatus(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('completion') && raw.includes('pend')) return 'completion_pending';
    if (raw.includes('complete')) return 'completed';
    if (raw.includes('accept')) return 'accepted';
    if (raw.includes('reject')) return 'rejected';
    if (raw.includes('review')) return 'reviewed';
    return 'pending';
  }

  // Formats or checks payment confirmed so later code can use a clean value.
  function isPaymentConfirmed(payment) {
    return !!(payment?.seeker_confirmed_at || payment?.status === 'confirmed' || payment?.payee_confirmed);
  }

  // Updates header name after the user changes something or data is refreshed.
  function updateHeaderName(name, photoSrc = '', attempt = 0) {
    const navName = document.getElementById('nav-user-name');
    const navBadge = document.getElementById('nav-user-badge');
    if (!navName || !navBadge) {
      if (attempt < 5) setTimeout(() => updateHeaderName(name, photoSrc, attempt + 1), 250);
      return;
    }

    navName.textContent = name || 'Job Seeker';
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

  // Renders list into the HTML so the user can see it.
  function renderList(element, items, emptyText) {
    if (!element) return;
    if (!items.length) {
      element.innerHTML = `<li>${escapeHtml(emptyText)}</li>`;
      return;
    }
    element.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  }

  // Renders photo into the HTML so the user can see it.
  function renderPhoto(name, src) {
    if (!els.photo) return;
    if (src) {
      els.photo.classList.add('has-image');
      els.photo.style.backgroundImage = `url("${src}")`;
      els.photo.textContent = '';
      return;
    }
    els.photo.classList.remove('has-image');
    els.photo.style.backgroundImage = '';
    els.photo.textContent = getInitials(name, 'JS');
  }

  // Helper function for merge data used by this script.
  function mergeData(profile, resume) {
    if (!resume) return profile || {};
    return {
      ...(profile || {}),
      ...resume,
      photoData: resume.photo_data || resume.photoData || profile?.photoData || profile?.photoUrl || '',
      photoUrl: resume.photo_url || resume.photoUrl || profile?.photoUrl || '',
      skills: normalizeArray(resume.skills?.length ? resume.skills : profile?.skills),
      availabilityDays: normalizeArray(resume.availability_days ?? resume.availabilityDays ?? profile?.availabilityDays),
      preferredCategories: normalizeArray(resume.preferred_categories ?? resume.preferredCategories ?? profile?.preferredCategories)
    };
  }

  // Renders profile into the HTML so the user can see it.
  function renderProfile(user, data) {
    const name = data?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Job Seeker';
    const headline = data?.headline || 'Add your professional headline in profile.';
    const email = data?.email || user.email || 'Email not set';
    const phone = data?.phone || 'Phone not set';
    const location = data?.location || 'Location not set';
    const bio = data?.bio || 'Add a short bio in your profile so employers can quickly understand your strengths.';
    const photo = data?.photoData || data?.photoUrl || '';
    const skills = normalizeArray(data?.skills);
    const availability = [
      ...normalizeArray(data?.availability || data?.availabilityDays),
      data?.availabilityTime,
      data?.workMode
    ].filter(Boolean).map((value) => String(value).trim())
      .filter((value, index, values) => value && values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);

    renderPhoto(name, photo);
    if (els.name) els.name.textContent = name;
    if (els.role) els.role.textContent = headline;
    if (els.email) els.email.textContent = email;
    if (els.phone) els.phone.textContent = phone;
    if (els.location) els.location.textContent = location;
    if (els.profile) els.profile.textContent = bio;

    renderList(els.skills, skills, 'Add skills in your profile to populate this section.');
    renderList(els.availability, availability, 'Set your available days and work preferences in profile.');

    // Education
    const education = Array.isArray(data?.education) ? data.education.filter(e => e.level || e.field) : [];
    if (els.education) {
      if (!education.length) {
        els.education.innerHTML = '<li>Add your qualifications in profile.</li>';
      } else {
        els.education.innerHTML = education.map(e => {
          const parts = [e.level, e.field, e.year].filter(Boolean);
          return `<li>${escapeHtml(parts.join(' — '))}</li>`;
        }).join('');
      }
    }

    updateHeaderName(name, photo);
  }

  // Renders work history into the HTML so the user can see it.
  function renderWorkHistory(items) {
    if (!els.workList) return;

    if (!items.length) {
      els.workList.innerHTML = `
        <article class="resume-entry resume-empty-entry">
          <div class="resume-entry-head">
            <div>
              <h4>No work history yet</h4>
              <p>Complete a job to see your work history here.</p>
            </div>
          </div>
        </article>
      `;
      return;
    }

    els.workList.innerHTML = items.map((item) => `
      <article class="resume-entry">
        <div class="resume-entry-head">
          <div>
            <h4>${escapeHtml(item.title || item.jobTitle || 'Completed Job')}</h4>
            <p>${escapeHtml(item.company || 'Employer not set')}</p>
          </div>
          <span>${escapeHtml(item.period || item.completedOn || item.completedDate || 'Date not set')}</span>
        </div>
        <ul class="resume-bullet-list">
          ${(item.highlights || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('') || '<li>Completed work recorded in EasyEarn work history.</li>'}
        </ul>
      </article>
    `).join('');

    // Build References from latest 3 employers
    if (els.references) {
      const seen = new Set();
      const refs = items
        .slice()
        .sort((a, b) => new Date(b.completedOn || b.completedDate || 0) - new Date(a.completedOn || a.completedDate || 0))
        .filter(item => {
          // Helper function for company used by this script.
          const company = (item.company || '').trim().toLowerCase();
          // Helper function for title used by this script.
          const title = (item.title || item.jobTitle || '').trim().toLowerCase();
          const key = `${company}|${title}`;
          if (!company || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 3);

      if (!refs.length) {
        els.references.innerHTML = '<p>Complete jobs to generate references from employers.</p>';
      } else {
        els.references.innerHTML = refs.map(item => `
          <div style="margin-bottom:10px">
            <strong style="display:block;font-size:0.88rem">${escapeHtml(item.company || 'Employer')}</strong>
            <span style="font-size:0.82rem;color:#555">${escapeHtml(item.title || item.jobTitle || 'Job')}</span>
            ${item.completedOn || item.completedDate ? `<span style="font-size:0.8rem;color:#888;display:block">${escapeHtml(item.completedOn || item.completedDate)}</span>` : ''}
            <span style="font-size:0.8rem;color:#888">Available upon request.</span>
          </div>
        `).join('');
      }
    }
  }

  // Helper function for summarize review used by this script.
  function summarizeReview(value) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    if (!text) return 'No review yet';
    return text.length > 72 ? `${text.slice(0, 69).trim()}...` : text;
  }

  // Helper function for merge ratings used by this script.
  function mergeRatings(...ratingGroups) {
    const seen = new Set();
    return ratingGroups
      .flat()
      .filter((rating) => {
        if (!rating) return false;
        const key = rating.id || [
          rating.application_id || '',
          rating.reviewer_id || '',
          rating.reviewee_id || '',
          rating.created_at || '',
          rating.review || ''
        ].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  // Renders stats into the HTML so the user can see it.
  function renderStats(items, ratings = []) {
    const averageRating = calcAverageRating(ratings);
    // Helper function for recent review used by this script.
    const recentReview = (ratings || []).find((rating) => {
      return String(rating.reviewer_role || '').toLowerCase() === 'employer'
        && String(rating.review || '').trim();
    }) || (ratings || []).find((rating) => String(rating.review || '').trim());

    if (els.gigs) els.gigs.textContent = String(items.length);
    if (els.rating) els.rating.textContent = averageRating ? `${averageRating.toFixed(1)}/5` : 'N/A';
    if (els.recentReview) els.recentReview.textContent = summarizeReview(recentReview?.review);
  }

  // Helper function for download pdf used by this script.
  async function downloadPdf() {
    if (!resumePaper || !window.html2canvas || !window.jspdf?.jsPDF || !els.downloadBtn) {
      return;
    }

    const originalText = els.downloadBtn.textContent;
    // Android WebView does not implement a browser download manager. Send the
    // finished PDF to Flutter so Android can show its normal save-location UI.
    const useNativeSaver = Boolean(window.EasyEarnFiles?.postMessage);
    els.downloadBtn.disabled = true;
    els.downloadBtn.textContent = 'Preparing PDF...';

    try {
      if (typeof refreshResumeData === 'function' && activeUser) {
        await refreshResumeData(true);
      }

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      els.downloadBtn.textContent = 'Generating PDF...';

      const canvas = await window.html2canvas(resumePaper, {
        // A smaller export is still crisp on A4 and keeps the native bridge
        // payload within Android's reliable method-channel limit.
        scale: useNativeSaver ? 1.25 : 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: Math.max(window.innerWidth, 1200),
        onclone: (clonedDocument) => {
          clonedDocument.querySelector('.resume-paper')?.classList.add('resume-pdf-export');
        }
      });

      const imageData = useNativeSaver
        ? canvas.toDataURL('image/jpeg', 0.86)
        : canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const imageWidth = usableWidth;
      // Helper function for image height used by this script.
      const imageHeight = (canvas.height * imageWidth) / canvas.width;

      if (imageHeight <= usableHeight) {
        pdf.addImage(imageData, useNativeSaver ? 'JPEG' : 'PNG', margin, margin, imageWidth, imageHeight, undefined, 'FAST');
      } else {
        const pageCanvas = document.createElement('canvas');
        const pageContext = pageCanvas.getContext('2d');
        const sliceHeightPx = Math.floor((usableHeight * canvas.width) / usableWidth);
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;

        let renderedHeight = 0;
        let firstPage = true;

        while (renderedHeight < canvas.height && pageContext) {
          pageContext.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageContext.fillStyle = '#ffffff';
          pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageContext.drawImage(
            canvas,
            0,
            renderedHeight,
            canvas.width,
            Math.min(sliceHeightPx, canvas.height - renderedHeight),
            0,
            0,
            canvas.width,
            Math.min(sliceHeightPx, canvas.height - renderedHeight)
          );

          const sliceData = useNativeSaver
            ? pageCanvas.toDataURL('image/jpeg', 0.86)
            : pageCanvas.toDataURL('image/png');
          // Helper function for slice height mm used by this script.
          const sliceHeightMm = (Math.min(sliceHeightPx, canvas.height - renderedHeight) * imageWidth) / canvas.width;

          if (!firstPage) pdf.addPage();
          pdf.addImage(sliceData, useNativeSaver ? 'JPEG' : 'PNG', margin, margin, imageWidth, sliceHeightMm, undefined, 'FAST');

          renderedHeight += sliceHeightPx;
          firstPage = false;
        }
      }

      // Helper function for raw name used by this script.
      const rawName = (els.name?.textContent || 'job-seeker-resume').trim();
      const safeName = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'job-seeker-resume';
      const fileName = `${safeName}-resume.pdf`;
      if (useNativeSaver) {
        const dataUri = pdf.output('datauristring');
        const base64 = String(dataUri).split(',', 2)[1] || '';
        if (base64.length > 4194304) {
          throw new Error('Your resume is too large to save on this device. Shorten the content and try again.');
        }
        els.downloadBtn.textContent = 'Choose save location...';
        window.EasyEarnFiles.postMessage(JSON.stringify({
          name: fileName,
          type: 'application/pdf',
          base64
        }));
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('PDF download failed. Please try again.');
    } finally {
      els.downloadBtn.disabled = false;
      els.downloadBtn.textContent = originalText;
    }
  }

  // ── Load resume data, filtered to only payment-confirmed work history ────
  async function loadResumeData(user) {
    const [profile, history, directRatings] = await Promise.all([
      fetchProfile(user.id, user),
      fetchWorkHistory(user.id),
      fetchRatings(user.id).catch((error) => {
        console.warn('Resume ratings load failed:', error);
        return [];
      })
    ]);

    let confirmedHistory = history || [];
    let ratings = directRatings || [];

    try {
      const [applications, jobs] = await Promise.all([
        fetchApplications(user.id),
        fetchJobs()
      ]);

      const applicationStatusById = new Map(
        (applications || []).map((app) => [app.id, normalizeStatus(app.status)])
      );
      // Helper function for completed apps used by this script.
      const completedApps = (applications || []).filter(
        (app) => normalizeStatus(app.status) === 'completed'
      );

      const paymentResults = await Promise.all(
        completedApps.map((app) => fetchPaymentByApplication(app.id).catch(() => null))
      );
      const confirmedApplicationIds = new Set(
        completedApps
          .filter((app, index) => isPaymentConfirmed(paymentResults[index]))
          .map((app) => app.id)
      );

      confirmedHistory = (history || []).filter((item) => {
        // Manually-added records (no applicationId) still show, same as work-history.js
        if (!item.applicationId) return true;
        return applicationStatusById.get(item.applicationId) === 'completed'
          && confirmedApplicationIds.has(item.applicationId);
      });

      const applicationRatings = await fetchRatingsByApplications(
        completedApps.map((app) => app.id)
      ).catch((error) => {
        console.warn('Resume application ratings load failed:', error);
        return [];
      });
      ratings = mergeRatings(
        directRatings,
        applicationRatings.filter((rating) => {
          return String(rating.reviewer_role || '').toLowerCase() === 'employer';
        })
      );
    } catch (error) {
      console.warn('Resume payment-confirmation filter failed, falling back to raw history:', error);
      confirmedHistory = history || [];
    }

    renderProfile(user, profile);
    renderWorkHistory(confirmedHistory);
    renderStats(confirmedHistory, ratings);
  }

  if (els.downloadBtn) {
    els.downloadBtn.disabled = true;
    // Connects this element event to the handler that should run next.
    els.downloadBtn.addEventListener('click', downloadPdf);
  }

  observeAuth(async (user) => {
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    activeUser = user;

    // Helper function for refresh used by this script.
    const refresh = async (silent = false) => {
      try {
        await loadResumeData(user);
        if (els.downloadBtn) {
          els.downloadBtn.disabled = false;
        }
      } catch (error) {
        console.error('Failed to load resume data:', error);
        renderProfile(user, {});
        renderWorkHistory([]);
        renderStats([], []);
        if (!silent && els.downloadBtn) {
          els.downloadBtn.disabled = false;
        }
      }
    };

    refreshResumeData = refresh;

    if (els.refreshBtn && !els.refreshBtn.dataset.bound) {
      els.refreshBtn.dataset.bound = 'true';
      // Connects this element event to the handler that should run next.
      els.refreshBtn.addEventListener('click', async () => {
        const originalText = els.refreshBtn.textContent;
        els.refreshBtn.disabled = true;
        els.refreshBtn.textContent = 'Refreshing...';
        await refresh();
        els.refreshBtn.disabled = false;
        els.refreshBtn.textContent = originalText;
      });
    }

    await refresh();
  });
})();

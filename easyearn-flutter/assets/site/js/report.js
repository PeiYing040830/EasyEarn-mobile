import { readReportEvidence } from './report-evidence.js';
/**
 * EasyEarn file note: Handles the report page behavior and related user interactions.
 */
import { observeAuth, fetchProfile, createReport } from './supabase-data.js?v=20261002a';
import { getReportReason, reportReasonOptions } from './report-reasons.js';

(function () {
  'use strict';

  let currentUser = null;
  let currentProfile = null;

  // Sets up report hero slides when this script is loaded.
  function initReportHeroSlides() {
    const slides = document.querySelectorAll('.report-hero-slide');
    if (!slides.length) return;
    let index = 0;

    setInterval(() => {
      slides[index].classList.remove('is-active');
      index = (index + 1) % slides.length;
      slides[index].classList.add('is-active');
    }, 5000);
  }

  // Loads field data so the page can display current information.
  function getField(id) {
    return document.getElementById(id);
  }

  // Runs the status element step for this page workflow.
  function ensureStatusElement(form) {
    let el = form.querySelector('.report-submit-status');
    if (el) return el;

    el = document.createElement('p');
    el.className = 'form-note report-submit-status';
    form.appendChild(el);
    return el;
  }

  // Updates status after the user changes something or data is refreshed.
  function setStatus(form, message, isError = false) {
    const el = ensureStatusElement(form);
    el.textContent = message;
    el.style.color = isError ? '#d14343' : '#1f8f46';
  }

  // Formats or checks valid email so later code can use a clean value.
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim());
  }

  // Formats or checks valid optional URL so later code can use a clean value.
  function isValidOptionalUrl(value) {
    if (!value) return true;
    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      return Boolean(url.hostname.includes('.'));
    } catch {
      return false;
    }
  }

  // Formats or checks allowed evidence file so later code can use a clean value.
  function isAllowedEvidenceFile(file) {
    if (!file) return true;
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    return allowedTypes.includes(file.type);
  }

  function updateEvidencePreview() {
    const file = getField('report-file')?.files?.[0];
    const preview = getField('report-evidence-preview');
    if (!preview) return;
    preview.replaceChildren();
    preview.hidden = !file;
    if (!file) return;

    const url = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
      const image = document.createElement('img');
      image.src = url;
      image.alt = `Preview of ${file.name}`;
      image.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
      preview.appendChild(image);
    }
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = file.type === 'application/pdf' ? `Open PDF: ${file.name}` : `Open image: ${file.name}`;
    preview.appendChild(link);
  }

  // Formats or checks description so later code can use a clean value.
  function buildDescription() {
    const role = getField('report-role')?.value?.trim() || 'Other';
    const link = getField('report-link')?.value?.trim() || '';
    const description = getField('report-desc')?.value?.trim() || '';
    const file = getField('report-file')?.files?.[0] || null;
    const evidenceLine = file ? `Evidence file: ${file.name}` : 'Evidence file: none';
    const linkLine = link ? `Reference link: ${link}` : 'Reference link: none';
    const roleLine = `Reporter role: ${role}`;

    return [roleLine, linkLine, evidenceLine, '', description].join('\n');
  }

  function linkedJobId() {
    const link = getField('report-link')?.value?.trim() || '';
    const match = link.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return match ? match[0] : null;
  }

  // Helper function for validate form used by this script.
  function validateForm() {
    const name = getField('report-name')?.value?.trim();
    const email = getField('report-email')?.value?.trim();
    const link = getField('report-link')?.value?.trim();
    const description = getField('report-desc')?.value?.trim();
    const file = getField('report-file')?.files?.[0] || null;

    if (!getReportReason(getField('report-type')?.value)) return 'Please select a report reason.';

    if (!name || !email || !description) {
      return 'Please fill in name, email, and description.';
    }

    if (name.length < 2) {
      return 'Full name must be at least 2 characters.';
    }

    if (!isValidEmail(email)) {
      return 'Please enter a valid email address.';
    }

    if (!isValidOptionalUrl(link)) {
      return 'Please enter a valid listing or profile link.';
    }

    if (description.length < 20) {
      return 'Description must be at least 20 characters.';
    }

    if (file && file.size > 3 * 1024 * 1024) {
      return 'Evidence file must be 3MB or smaller.';
    }

    if (!isAllowedEvidenceFile(file)) {
      return 'Evidence must be a PDF, PNG, JPG, or WebP file.';
    }

    return '';
  }

  // Updates submitting after the user changes something or data is refreshed.
  function setSubmitting(form, button, submitting) {
    button.disabled = submitting;
    button.textContent = submitting ? 'Submitting...' : 'Submit Report';
    form.classList.toggle('is-submitting', submitting);
  }

  // Helper function for prefill profile used by this script.
  function prefillProfile() {
    if (!currentUser) return;

    const nameInput = getField('report-name');
    const emailInput = getField('report-email');
    const roleSelect = getField('report-role');

    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = currentProfile?.name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || '';
    }

    if (emailInput && !emailInput.value.trim()) {
      emailInput.value = currentProfile?.email || currentUser.email || '';
    }

    if (roleSelect && !roleSelect.dataset.autofilled) {
      const role = currentProfile?.role || currentUser.user_metadata?.role || '';
      if (role === 'seeker') roleSelect.value = 'Job Seeker';
      if (role === 'employer') roleSelect.value = 'Employer';
      roleSelect.dataset.autofilled = 'true';
    }
  }

  // Sets up report form when this script is loaded.
  function initReportForm() {
    const form = document.getElementById('report-form');
    if (!form) return;
    getField('report-type').innerHTML = reportReasonOptions();
    getField('report-type').required = true;
    getField('report-file')?.addEventListener('change', updateEvidencePreview);

    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;

    // Connects this element event to the handler that should run next.
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const validationMessage = validateForm();
      if (validationMessage) {
        setStatus(form, validationMessage, true);
        return;
      }

      const fullName = getField('report-name').value.trim();
      const email = getField('report-email').value.trim();
      const reason = getReportReason(getField('report-type')?.value);
      const reportType = reason.type;
      const fullDescription = [
        `Reason: ${reason.label}`,
        `Reporter name: ${fullName}`,
        `Reporter email: ${email}`,
        buildDescription()
      ].join('\n');

      setSubmitting(form, submitButton, true);

      try {
        const evidence = await readReportEvidence(getField('report-file')?.files?.[0]);
        const report = await createReport({
          evidence,
          reporter_id: currentUser?.id || null,
          reported_user: null,
          job_id: linkedJobId(),
          report_type: reportType,
          description: fullDescription,
          status: 'pending'
        });

        setStatus(form, 'Report submitted successfully. Admin can review it from the reports queue.');
        form.reset();
        updateEvidencePreview();
        prefillProfile();
      } catch (error) {
        console.error('Report submit failed:', error);
        setStatus(form, error?.message || 'Unable to submit report right now. Check Supabase reports insert policy.', true);
      } finally {
        setSubmitting(form, submitButton, false);
      }
    });
  }

  // Helper function for boot used by this script.
  function boot() {
    initReportHeroSlides();
    initReportForm();

    observeAuth(async (user) => {
      currentUser = user;
      currentProfile = null;

      if (user) {
        try {
          currentProfile = await fetchProfile(user.id, user);
        } catch (error) {
          console.warn('Failed to prefill report form from profile:', error);
        }
      }

      prefillProfile();
    });
  }

  if (document.readyState === 'loading') {
    // Waits until the HTML has loaded before running page setup code.
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

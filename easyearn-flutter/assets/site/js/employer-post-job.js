/**
 * EasyEarn file note: Handles the employer post job page behavior and related user interactions.
 */
import {
  createJobListing,
  fetchJobListing,
  fetchProfile,
  observeAuth,
  updateJobListing
} from './supabase-data.js';

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const editJobId = params.get('edit');

  const form = document.getElementById('post-job-form');
  const statusEl = document.getElementById('post-job-status');
  const publishBtn = document.getElementById('publish-job-btn');
  const draftBtn = document.getElementById('save-draft-btn');

  const fields = {
    title: document.getElementById('job-title'),
    category: document.getElementById('job-category'),
    location: document.getElementById('job-location'),
    payRate: document.getElementById('job-pay-rate'),
    openings: document.getElementById('job-openings'),
    schedule: document.getElementById('job-schedule'),
    expiryDate: document.getElementById('job-expiry-date'),
    requirements: document.getElementById('job-requirements'),
    description: document.getElementById('job-description')
  };

  let currentUser = null;
  let editMode = Boolean(editJobId);
  let currentProfile = null;
  let editingJobStatus = null;

  // Helper function for notify status used by this script.
  function notifyStatus(message, type = '') {
    const text = String(message || '');
    const shouldShow = type || /\b(saved|published|updated|success|unable|failed|error|required|cannot)\b/i.test(text);
    if (!shouldShow) return;
    const toastType = type === 'is-error' ? 'error' : type === 'is-success' ? 'success' : /\b(unable|failed|error|required|cannot)\b/i.test(text) ? 'error' : 'success';
    window.EasyEarnToast?.show(text, toastType);
  }

  // Updates status after the user changes something or data is refreshed.
  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error');
    if (type) statusEl.classList.add(type);
    notifyStatus(message, type);
  }

  // Updates button state after the user changes something or data is refreshed.
  function setButtonState(button, busyText, busy) {
    if (!button) return;
    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent;
    }
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.defaultText;
  }

  // Loads restriction message data so the page can display current information.
  function getRestrictionMessage(profile) {
    const status = String(profile?.accountStatus || 'active').toLowerCase();
    if (status === 'suspended') {
      return 'Your employer account is suspended. You cannot publish or edit job listings right now.';
    }
    if (status === 'under_review') {
      return 'Your employer account is under review. Job posting is temporarily locked until admin completes the review.';
    }
    return '';
  }

  // Helper function for apply restriction state used by this script.
  function applyRestrictionState(profile) {
    const message = getRestrictionMessage(profile);
    const locked = Boolean(message);
    [publishBtn, draftBtn].forEach((button) => {
      if (button) button.disabled = locked;
    });
    Object.values(fields).forEach((field) => {
      if (field) field.disabled = locked;
    });
    if (locked) setStatus(message, 'is-error');
    return locked;
  }

  // Helper function for parse pay rate used by this script.
  function parsePayRate(value) {
    const match = String(value ?? '').trim().match(/^(?:RM\s*)?(\d+(?:\.\d{1,2})?)(?:\s*\/\s*(?:h|hr|hour|hourly|day|daily|fixed))?$/i);
    if (!match) return null;
    const amount = Number(match[1]);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  // Helper function for infer pay type used by this script.
  function inferPayType(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('day')) return 'daily';
    if (text.includes('fixed')) return 'fixed';
    return 'hourly';
  }

  // Helper function for infer job type used by this script.
  function inferJobType(schedule) {
    const text = String(schedule || '').toLowerCase();
    if (text.includes('full')) return 'full-time';
    if (text.includes('freelance')) return 'freelance';
    return 'part-time';
  }

  // Helper function for parse openings used by this script.
  function parseOpenings(value) {
    const parsed = Number.parseInt(String(value || '1'), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  // Formats or checks past date so later code can use a clean value.
  function isPastDate(value) {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  // Helper function for fill form used by this script.
  function fillForm(data = {}) {
    if (fields.title) fields.title.value = data.title || '';
    if (fields.category) fields.category.value = data.category || fields.category.value;
    if (fields.location) {
      const loc = data.location || '';
      fields.location.value = loc;
      // Hydrate the visible state/area inputs when editing
      hydrateLocationFields(loc);
    }
    if (fields.payRate) fields.payRate.value = data.payRate || '';
    if (fields.openings) fields.openings.value = data.openings || '1';
    if (fields.schedule) fields.schedule.value = data.schedule || fields.schedule.value;
    if (fields.expiryDate) fields.expiryDate.value = data.expiryDate || '';
    if (fields.requirements) {
      // Hydrate the tag-chip UI if available, else fall back to hidden input
      const rawSkills = data.requirements || '';
      if (typeof window.setSkillTags === 'function') {
        const arr = rawSkills.split(',').map(s => s.trim()).filter(Boolean);
        window.setSkillTags(arr);
      } else {
        fields.requirements.value = rawSkills;
      }
    }
    if (fields.description) fields.description.value = data.description || '';
  }

  // Split a stored "Area, State" string back into the two visible fields
  function hydrateLocationFields(loc) {
    const stateEl  = document.getElementById('job-location-state');
    const areaEl   = document.getElementById('job-location-area');
    const preview  = document.getElementById('location-preview');
    const previewT = document.getElementById('location-preview-text');
    if (!stateEl || !loc) return;

    const parts = loc.split(',').map(s => s.trim());
    const tryState = parts.length >= 2 ? parts[parts.length - 1] : loc;
    const tryArea  = parts.length >= 2 ? parts.slice(0, parts.length - 1).join(', ') : '';

    const opts  = [...stateEl.options];
    const match = opts.find(o => o.value && o.value.toLowerCase() === tryState.toLowerCase());
    if (match) {
      stateEl.value = match.value;
      if (areaEl) areaEl.value = tryArea;
    } else {
      // Fallback: put whole string in area field
      if (areaEl) areaEl.value = loc;
    }

    if (preview && previewT && loc) {
      previewT.textContent = loc;
      preview.style.display = 'block';
    }
  }

  // Helper function for hydrate form from job used by this script.
  function hydrateFormFromJob(job = {}) {
    editingJobStatus = String(job.status || '').toLowerCase();
    const description = String(job.description || '');
    const requirementPrefix = 'Requirements: ';
    let requirements = '';
    let mainDescription = description;

    if (description.includes(requirementPrefix)) {
      const parts = description.split(/\n\nRequirements:\s*/i);
      mainDescription = parts[0] || '';
      requirements = parts[1] || '';
    }

    fillForm({
      title: job.title || '',
      category: job.category || '',
      location: job.location || '',
      payRate: job.pay_rate ? `RM${job.pay_rate}/${job.pay_type === 'daily' ? 'day' : job.pay_type === 'fixed' ? 'fixed' : 'hour'}` : '',
      openings: job.openings_count ?? 1,
      schedule: job.job_type === 'full-time' ? 'Full-time' : job.job_type === 'freelance' ? 'Freelance' : 'Part-time',
      expiryDate: job.expiry_date || '',
      requirements: requirements || (Array.isArray(job.skill_tags) ? job.skill_tags.join(', ') : ''),
      description: mainDescription || ''
    });
  }

  // Updates edit UI state after the user changes something or data is refreshed.
  function setEditUiState() {
    if (publishBtn) {
      publishBtn.textContent = editMode && editingJobStatus !== 'draft'
        ? 'Update and Submit for Review'
        : 'Submit for Review';
      publishBtn.dataset.defaultText = publishBtn.textContent;
    }
    if (draftBtn) {
      draftBtn.textContent = editMode && editingJobStatus !== 'draft'
        ? 'Save Changes and Submit'
        : (editMode ? 'Save Changes' : 'Save Draft');
      draftBtn.dataset.defaultText = draftBtn.textContent;
    }
    if (editMode) {
      setStatus('Edit mode is on. Update the listing and save your changes.');
    }
  }

  // Runs the draft step for this page workflow.
  async function saveDraft() {
    if (!currentUser) {
      setStatus('Please log in as employer first.', 'is-error');
      return;
    }

    if (applyRestrictionState(currentProfile)) return;

    if (!validateForm()) return;

    // A non-draft is always returned to the review queue after editing.
    if (editMode) {
      return handlePublish(new Event('submit'), true);
    }

    // New listing — save with status 'draft' so it is not visible to seekers
    // but the employer can come back and edit / publish it later.
    setButtonState(draftBtn, 'Saving Draft...', true);
    if (publishBtn) publishBtn.disabled = true;
    setStatus('Saving draft...');

    try {
      const profile = await fetchProfile(currentUser.id, currentUser);
      const requirements = fields.requirements?.value.trim() || '';
      const schedule = fields.schedule?.value.trim() || '';

      const payload = {
        employer_id:    currentUser.id,
        title:          fields.title?.value.trim(),
        location:       fields.location?.value.trim(),
        description:    fields.description?.value.trim(),
        category:       fields.category?.value || 'General',
        job_type:       inferJobType(schedule),
        schedule,
        pay_rate:       parsePayRate(fields.payRate?.value),
        pay_type:       inferPayType(fields.payRate?.value),
        openings_count: parseOpenings(fields.openings?.value),
        skill_tags:     requirements.split(',').map((item) => item.trim()).filter(Boolean),
        expiry_date:    fields.expiryDate?.value || null,
        status:         'draft',
        company_name:   profile.companyName || profile.businessName || profile.name || ''
      };

      await createJobListing(payload);
      setStatus('Draft saved. You can publish it later from Manage Jobs.', 'is-success');
      setTimeout(() => { window.location.href = 'manage-jobs.html'; }, 1800);
    } catch (error) {
      console.error('Failed to save draft:', error);
      setStatus(error?.message || 'Unable to save draft right now.', 'is-error');
      setButtonState(draftBtn, draftBtn.dataset.defaultText || 'Save Draft', false);
      if (publishBtn) publishBtn.disabled = false;
    }
  }

  // Helper function for validate form used by this script.
  function validateForm() {
    const title = fields.title?.value.trim() || '';
    const location = fields.location?.value.trim() || '';
    const payRate = parsePayRate(fields.payRate?.value);
    const openings = Number.parseInt(String(fields.openings?.value || ''), 10);
    const description = fields.description?.value.trim() || '';

    if (!title) {
      setStatus('Please enter a job title.', 'is-error');
      fields.title?.focus();
      return false;
    }

    if (title.length < 3) {
      setStatus('Job title must be at least 3 characters.', 'is-error');
      fields.title?.focus();
      return false;
    }

    if (!fields.category?.value) {
      setStatus('Please select a job category.', 'is-error');
      fields.category?.focus();
      return false;
    }

    if (!location) {
      setStatus('Please select a state and enter the job area/district.', 'is-error');
      // Focus the visible state dropdown instead of the hidden input
      document.getElementById('job-location-state')?.focus();
      return false;
    }

    if (!payRate || payRate <= 0) {
      setStatus('Please enter a valid positive pay rate, for example RM14/hour.', 'is-error');
      fields.payRate?.focus();
      return false;
    }

    if (!Number.isInteger(openings) || openings < 1 || openings > 100) {
      setStatus('Openings must be a whole number between 1 and 100.', 'is-error');
      fields.openings?.focus();
      return false;
    }

    if (isPastDate(fields.expiryDate?.value)) {
      setStatus('Expiry date cannot be in the past.', 'is-error');
      fields.expiryDate?.focus();
      return false;
    }

    if (!description) {
      setStatus('Please enter a job description.', 'is-error');
      fields.description?.focus();
      return false;
    }

    if (description.length < 20) {
      setStatus('Job description must be at least 20 characters.', 'is-error');
      fields.description?.focus();
      return false;
    }

    return true;
  }

  // Handles the publish action triggered by the user.
  async function handlePublish(event, preserveDraft = false) {
    event.preventDefault();
    if (!currentUser) {
      setStatus('Please log in as employer first.', 'is-error');
      return;
    }

    if (applyRestrictionState(currentProfile)) return;

    if (!validateForm()) return;

    setButtonState(publishBtn, editMode ? 'Updating...' : 'Publishing...', true);
    if (draftBtn) draftBtn.disabled = true;
    setStatus(editMode ? 'Updating job...' : 'Publishing job...');

    try {
      const profile = await fetchProfile(currentUser.id, currentUser);
      const requirements = fields.requirements?.value.trim() || '';
      const description = fields.description?.value.trim() || '';
      const mergedDescription = [description, requirements ? `Requirements: ${requirements}` : ''].filter(Boolean).join('\n\n');

      const payload = {
        employer_id: currentUser.id,
        title: fields.title?.value.trim(),
        description: mergedDescription,
        category: fields.category?.value || null,
        location: fields.location?.value.trim(),
        job_type: inferJobType(fields.schedule?.value),
        pay_rate: parsePayRate(fields.payRate?.value),
        pay_type: inferPayType(fields.payRate?.value),
        openings_count: parseOpenings(fields.openings?.value),
        skill_tags: requirements.split(',').map((item) => item.trim()).filter(Boolean),
        expiry_date: fields.expiryDate?.value || null,
        // Only an existing draft may remain a draft. Every other edit must
        // be reviewed again before it can be visible to jobseekers.
        status: !editMode || editingJobStatus !== 'draft' || !preserveDraft ? 'pending' : undefined,
        company_name: profile.companyName || profile.businessName || profile.name || ''
      };

      if (editMode && editJobId) {
        await updateJobListing(editJobId, payload);
      } else {
        await createJobListing(payload);
      }

      form?.reset();
      setStatus(editMode ? 'Job updated successfully. Redirecting to Manage Jobs...' : 'Job submitted for admin review. Redirecting to Manage Jobs...', 'is-success');
      setTimeout(() => {
        window.location.href = 'manage-jobs.html';
      }, 900);
    } catch (error) {
      console.error('Failed to publish job:', error);
      setStatus(error?.message || 'Unable to publish job right now. Please check Supabase table policies.', 'is-error');
    } finally {
      setButtonState(publishBtn, 'Publishing...', false);
      if (draftBtn) draftBtn.disabled = false;
    }
  }

  // Handles the draft save action triggered by the user.
  async function handleDraftSave() {
    await saveDraft();
  }

  observeAuth((user) => {
    currentUser = user;

    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    setEditUiState();

    if (editMode && editJobId) {
      fetchProfile(user.id, user)
        .then((profile) => {
          currentProfile = profile;
          if (applyRestrictionState(profile)) return null;
          return fetchJobListing(editJobId);
        })
        .then((job) => {
          if (!job) return;
          if (job.employer_id !== user.id) {
            setStatus('You can only edit your own listings.', 'is-error');
            return;
          }
          hydrateFormFromJob(job);
          setEditUiState();
        })
        .catch((error) => {
          console.error('Failed to load job for editing:', error);
          setStatus('Unable to load this job for editing right now.', 'is-error');
        });
      return;
    }

    fetchProfile(user.id, user)
      .then((profile) => {
        currentProfile = profile;
        if (!applyRestrictionState(profile)) {
          setStatus('Complete the form to create your next job listing.');
        }
      })
      .catch((error) => {
        console.error('Failed to load employer status:', error);
        setStatus('Unable to load your employer account status right now.', 'is-error');
      });
  });

  form?.addEventListener('submit', handlePublish);
  draftBtn?.addEventListener('click', handleDraftSave);
})();

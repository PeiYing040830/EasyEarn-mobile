/**
 * EasyEarn file note: Handles the employer profile page behavior and related user interactions.
 */
import {
  fetchProfile,
  observeAuth,
  upsertProfile
} from './supabase-data.js';

(function () {
  'use strict';

  const form = document.getElementById('employer-profile-form');
  const saveBtn = document.getElementById('employer-save-profile-btn');
  const statusEl = document.getElementById('employer-profile-status');
  const logoStatusEl = document.getElementById('employer-logo-status');

  const fields = {
    companyName: document.getElementById('employer-company-name'),
    contactEmail: document.getElementById('employer-contact-email'),
    phone: document.getElementById('employer-phone'),
    businessType: document.getElementById('employer-business-type'),
    location: document.getElementById('employer-location'),
    website: document.getElementById('employer-website'),
    logoFile: document.getElementById('employer-logo-file'),
    overview: document.getElementById('employer-overview')
  };

  const metrics = {
    basic: {
      track: document.getElementById('employer-basic-track'),
      value: document.getElementById('employer-basic-value')
    },
    trust: {
      track: document.getElementById('employer-trust-track'),
      value: document.getElementById('employer-trust-value')
    },
    ready: {
      track: document.getElementById('employer-ready-track'),
      value: document.getElementById('employer-ready-value')
    }
  };

  const previewEls = {
    logo: document.getElementById('employer-logo-preview'),
    name: document.getElementById('employer-logo-preview-name'),
    meta: document.getElementById('employer-logo-preview-meta')
  };

  let currentUser = null;
  let currentLogo = '';
  let selectedLogoFile = null;
  let currentProfile = null;

  // Helper function for notify status used by this script.
  function notifyStatus(message, type = '') {
    const text = String(message || '');
    const shouldShow = type || /\b(saved|submitted|published|updated|success|unable|failed|error|wrong|required|cannot)\b/i.test(text);
    if (!shouldShow) return;
    const toastType = type === 'is-error' ? 'error' : type === 'is-success' ? 'success' : /\b(unable|failed|error|wrong|required|cannot)\b/i.test(text) ? 'error' : 'success';
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

  // Updates button busy after the user changes something or data is refreshed.
  function setButtonBusy(button, busyText, busy) {
    if (!button) return;
    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent;
    }
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.defaultText;
  }

  // Updates logo status after the user changes something or data is refreshed.
  function setLogoStatus(message, type = '') {
    if (!logoStatusEl) return;
    logoStatusEl.textContent = message;
    logoStatusEl.classList.remove('is-success', 'is-error');
    if (type) logoStatusEl.classList.add(type);
  }

  // Loads account status message data so the page can display current information.
  function getAccountStatusMessage(profile) {
    const status = String(profile?.accountStatus || 'active').toLowerCase();
    if (status === 'suspended') {
      return 'Account status: suspended. Job posting is locked and your listings are hidden while admin reviews the payment dispute history.';
    }
    if (status === 'under_review') {
      return 'Account status: under review. Admin is reviewing your payment dispute history.';
    }
    return '';
  }

  // Helper function for fill form used by this script.
  function fillForm(profile = {}) {
    if (fields.companyName) fields.companyName.value = profile.companyName || profile.businessName || profile.name || '';
    if (fields.contactEmail) fields.contactEmail.value = profile.email || currentUser?.email || '';
    if (fields.phone) fields.phone.value = profile.phone || '';
    const verificationTypes = ['Individual Hirer', 'Company / Business', 'Online Seller / E-commerce'];
    const legacyBusinessCategory = verificationTypes.includes(profile.businessType) ? '' : profile.businessType;
    if (fields.businessType) fields.businessType.value = profile.businessCategory || legacyBusinessCategory || fields.businessType.value;
    if (fields.location) fields.location.value = profile.location || '';
    if (fields.website) fields.website.value = profile.website || '';
    if (fields.overview) fields.overview.value = profile.companyOverview || profile.bio || '';
    currentLogo = profile.photoData || profile.photoUrl || '';
  }

  // Helper function for read payload used by this script.
  function readPayload() {
    return {
      companyName: fields.companyName?.value.trim() || '',
      email: fields.contactEmail?.value.trim() || '',
      phone: fields.phone?.value.trim() || '',
      businessType: fields.businessType?.value || '',
      location: fields.location?.value.trim() || '',
      website: fields.website?.value.trim() || '',
      companyOverview: fields.overview?.value.trim() || ''
    };
  }

  // Formats or checks valid email so later code can use a clean value.
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim());
  }

  // Formats or checks valid phone so later code can use a clean value.
  function isValidPhone(value) {
    if (!value) return true;
    return /^\+?[0-9][0-9\s-]{7,18}$/.test(value);
  }

  // Formats or checks valid URL so later code can use a clean value.
  function isValidUrl(value) {
    if (!value) return true;
    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      return Boolean(url.hostname.includes('.'));
    } catch {
      return false;
    }
  }

  // Helper function for validate payload used by this script.
  function validatePayload(payload) {
    if (!payload.companyName) return { message: 'Please enter a company name.', field: fields.companyName };
    if (payload.companyName.length < 2) return { message: 'Company name must be at least 2 characters.', field: fields.companyName };
    if (!payload.email) return { message: 'Please enter a contact email.', field: fields.contactEmail };
    if (!isValidEmail(payload.email)) return { message: 'Please enter a valid contact email.', field: fields.contactEmail };
    if (payload.phone && !isValidPhone(payload.phone)) return { message: 'Please enter a valid phone number.', field: fields.phone };
    if (payload.website && !isValidUrl(payload.website)) return { message: 'Please enter a valid website URL.', field: fields.website };
    if (payload.companyOverview && payload.companyOverview.length < 20) return { message: 'Company overview must be at least 20 characters.', field: fields.overview };
    if (payload.companyOverview.length > 800) return { message: 'Company overview must be 800 characters or less.', field: fields.overview };
    return null;
  }

  // Loads initials data so the page can display current information.
  function getInitials(name) {
    return String(name || 'Employer')
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'EM';
  }

  // Renders logo into the HTML so the user can see it.
  function renderLogo(src = '') {
    if (!previewEls.logo) return;

    if (src) {
      previewEls.logo.classList.add('has-image');
      previewEls.logo.style.backgroundImage = `url("${src}")`;
      previewEls.logo.textContent = '';
    } else {
      previewEls.logo.classList.remove('has-image');
      previewEls.logo.style.backgroundImage = '';
      previewEls.logo.textContent = getInitials(fields.companyName?.value || 'Employer');
    }

    const name = fields.companyName?.value.trim() || 'Employer';
    if (previewEls.name) previewEls.name.textContent = name;
    if (previewEls.meta) previewEls.meta.textContent = fields.businessType?.value || 'Add a business logo for stronger company branding.';

    const navName = document.getElementById('nav-user-name');
    const navBadge = document.getElementById('nav-user-badge');
    if (navName) navName.textContent = name;
    if (navBadge) {
      if (src) {
        navBadge.classList.add('has-image');
        navBadge.style.backgroundImage = `url("${src}")`;
        navBadge.textContent = '';
      } else {
        navBadge.classList.remove('has-image');
        navBadge.style.backgroundImage = '';
        navBadge.textContent = getInitials(name);
      }
    }
  }

  // Helper function for read image file used by this script.
  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected logo.'));
      reader.readAsDataURL(file);
    });
  }

  // Loads image element data so the page can display current information.
  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to process the selected logo.'));
      image.src = src;
    });
  }

  // Helper function for compress logo to data URL used by this script.
  async function compressLogoToDataUrl(file) {
    const source = await readImageFile(file);
    const image = await loadImageElement(source);
    const maxSide = 320;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) throw new Error('Unable to prepare the selected logo.');

    context.drawImage(image, 0, 0, width, height);

    let quality = 0.82;
    let output = canvas.toDataURL('image/jpeg', quality);
    while (output.length > 350000 && quality > 0.45) {
      quality -= 0.08;
      output = canvas.toDataURL('image/jpeg', quality);
    }

    if (output.length > 350000) {
      throw new Error('Logo is still too large after compression. Please choose a smaller image.');
    }

    return output;
  }

  // Runs the logo if needed step for this page workflow.
  async function saveLogoIfNeeded() {
    if (!selectedLogoFile) return currentLogo;
    if (selectedLogoFile.size > 2 * 1024 * 1024) {
      setLogoStatus('Logo must be 2MB or smaller.', 'error');
      throw new Error('Logo must be 2MB or smaller.');
    }

    setLogoStatus('Compressing logo...');
    currentLogo = await compressLogoToDataUrl(selectedLogoFile);
    selectedLogoFile = null;
    if (fields.logoFile) fields.logoFile.value = '';
    setLogoStatus('Business logo saved successfully.', 'success');
    return currentLogo;
  }

  // Updates metric after the user changes something or data is refreshed.
  function setMetric(metric, percentage) {
    const rounded = Math.max(0, Math.min(100, Math.round(percentage)));
    if (metric.track) metric.track.style.width = `${rounded}%`;
    if (metric.value) metric.value.textContent = `${rounded}%`;
  }

  // Updates readiness after the user changes something or data is refreshed.
  function updateReadiness() {
    const payload = readPayload();

    const basicFilled = [payload.companyName, payload.email, payload.phone, payload.location].filter(Boolean).length;
    const trustFilled = [payload.businessType, payload.website, payload.companyOverview].filter(Boolean).length;
    const readyFilled = [payload.companyName, payload.location, payload.companyOverview, payload.businessType, payload.phone].filter(Boolean).length;

    setMetric(metrics.basic, (basicFilled / 4) * 100);
    setMetric(metrics.trust, (trustFilled / 3) * 100);
    setMetric(metrics.ready, (readyFilled / 5) * 100);
    renderLogo(currentLogo);
  }

  // Sets up realtime update when this script is loaded.
  function bindRealtimeUpdate() {
    Object.values(fields).forEach((field) => {
      field?.addEventListener('input', updateReadiness);
      field?.addEventListener('change', updateReadiness);
    });
  }

  // Handles the save action triggered by the user.
  async function handleSave(event) {
    event.preventDefault();

    if (!currentUser) {
      setStatus('Please log in first.', 'is-error');
      return;
    }

    const payload = readPayload();

    const validationError = validatePayload(payload);
    if (validationError) {
      setStatus(validationError.message, 'is-error');
      validationError.field?.focus();
      return;
    }

    setButtonBusy(saveBtn, 'Saving...', true);
    setStatus('Saving employer profile...');

    try {
      await saveLogoIfNeeded();

      await upsertProfile(currentUser.id, {
        name: payload.companyName,
        full_name: payload.companyName,
        email: payload.email,
        phone: payload.phone,
        location: payload.location,
        bio: payload.companyOverview,
        businessCategory: payload.businessType,
        website: payload.website,
        companyOverview: payload.companyOverview,
        photo_data: currentLogo,
        photo_url: currentLogo,
        role: 'employer'
      });

      setStatus(getAccountStatusMessage(currentProfile) || 'Employer profile saved successfully.', getAccountStatusMessage(currentProfile) ? 'is-error' : 'is-success');
      updateReadiness();
      renderLogo(currentLogo);
    } catch (error) {
      console.error('Failed to save employer profile:', error);
      setStatus(error?.message || 'Unable to save employer profile right now.', 'is-error');
    } finally {
      setButtonBusy(saveBtn, 'Saving...', false);
    }
  }

  // Loads profile data so the page can display current information.
  async function loadProfile(user) {
    const profile = await fetchProfile(user.id, user);
    currentProfile = profile;
    fillForm(profile);
    updateReadiness();
  }

  observeAuth(async (user) => {
    currentUser = user;

    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    try {
      await loadProfile(user);
      setStatus(getAccountStatusMessage(currentProfile) || 'Profile loaded. Keep it complete for posting and verification.', getAccountStatusMessage(currentProfile) ? 'is-error' : '');
      setLogoStatus(currentLogo ? 'Current saved logo is active.' : 'No logo selected.');
      renderLogo(currentLogo);
    } catch (error) {
      console.error('Failed to load employer profile:', error);
      setStatus('Unable to load employer profile right now.', 'is-error');
    }
  });

  fields.logoFile?.addEventListener('change', () => {
    const file = fields.logoFile.files?.[0] || null;
    selectedLogoFile = file;

    if (!file) {
      renderLogo(currentLogo);
      setLogoStatus(currentLogo ? 'Current saved logo is active.' : 'No logo selected.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    renderLogo(objectUrl);
    setLogoStatus(`Selected: ${file.name}`);
  });

  bindRealtimeUpdate();
  form?.addEventListener('submit', handleSave);
})();

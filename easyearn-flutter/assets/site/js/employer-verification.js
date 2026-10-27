import { verificationRequirements, verificationPackageError, normalizeEmployerType } from './verification-rules.js?v=20261001b';
/**
 * EasyEarn file note: Handles the employer verification page behavior and related user interactions.
 */
import { fetchProfile, observeAuth, updateEmployerVerification } from './supabase-data.js';

(function () {
  'use strict';

  const form = document.getElementById('verification-form');
  const submitBtn = document.getElementById('verification-submit-btn');
  const submitStatusEl = document.getElementById('verification-submit-status');
  const statusTitleEl = document.getElementById('verification-status-title');
  const details = {
    ssmNumber: document.getElementById('verification-ssm-number'),
    businessType: document.getElementById('verification-business-type'),
    businessAddress: document.getElementById('verification-business-address')
  };

  const files = {
    registration: {
      input: document.getElementById('verification-registration-file'),
      status: document.getElementById('verification-registration-status')
    },
    contact: {
      input: document.getElementById('verification-contact-file'),
      status: document.getElementById('verification-contact-status')
    }
  };

  const tracks = {
    company: {
      bar: document.getElementById('verification-company-track'),
      value: document.getElementById('verification-company-value')
    },
    documents: {
      bar: document.getElementById('verification-doc-track'),
      value: document.getElementById('verification-doc-value')
    },
    review: {
      bar: document.getElementById('verification-review-track'),
      value: document.getElementById('verification-review-value')
    }
  };

  let currentUser = null;
  let draftSaveTimer = null;
  let draftSaveInProgress = false;
  let draftSaveQueued = false;
  let selectedFiles = {
    registration: null,
    contact: null
  };
  let savedPackage = {
    status: 'pending',
    ssmNumber: '',
    businessType: '',
    businessAddress: '',
    registration: null,
    contact: null,
    reviewNotes: ''
  };

  function updateRequirements() {
    const rules = verificationRequirements(details.businessType?.value || '');
    details.ssmNumber.disabled = !rules.requiresRegistrationNumber;
    details.ssmNumber.required = rules.requiresRegistrationNumber;
    document.getElementById('verification-type-help').textContent = !rules.employerType
      ? 'Select a type to see the required documents. Individual hiring is for personal, non-business needs only.'
      : rules.individual
        ? 'Required: identity proof and proof of address. No SSM required. For personal, non-business hiring only; hiring for a shop or business must use a business category.'
        : rules.employerType === 'Online Seller / E-commerce'
          ? 'Required: registration number, registration document and contact person proof. Selling through Shopee or another platform does not replace these documents. A shop link alone is not sufficient.'
          : 'Required: registration number (SSM / applicable registry), registration document and contact person proof. All documents are reviewed by an admin.';
    details.ssmNumber.closest('label').style.display = rules.individual ? 'none' : '';
    document.getElementById('verification-address-label').textContent = rules.addressLabel;
    document.getElementById('verification-registration-label').textContent = rules.registrationLabel;
    document.getElementById('verification-contact-label').textContent = rules.contactLabel;
    document.getElementById('verification-contact-help').textContent = rules.individual
      ? 'Government-issued identity proof. Address proof: a recent bill or official letter showing your name and address.'
      : 'Identity proof or staff authorisation identifying the contact person.';
  }

  // Helper function for notify status used by this script.
  function notifyStatus(message, type = '') {
    const text = String(message || '');
    const shouldShow = type || /\b(saved|submitted|approved|rejected|success|unable|failed|error|required|cannot)\b/i.test(text);
    if (!shouldShow) return;
    const toastType = type === 'is-error' ? 'error' : type === 'is-success' ? 'success' : /\b(unable|failed|error|required|cannot)\b/i.test(text) ? 'error' : 'success';
    window.EasyEarnToast?.show(text, toastType);
  }

  // Updates submit status after the user changes something or data is refreshed.
  function setSubmitStatus(message, type = '') {
    if (!submitStatusEl) return;
    submitStatusEl.textContent = message;
    submitStatusEl.classList.remove('is-success', 'is-error');
    if (type) submitStatusEl.classList.add(type);
    notifyStatus(message, type);
  }

  // Updates field status after the user changes something or data is refreshed.
  function setFieldStatus(key, message, type = '') {
    const el = files[key]?.status;
    if (!el) return;
    el.textContent = message;
    el.classList.remove('is-success', 'is-error');
    if (type === 'error') el.classList.add('is-error');
  }

  // Updates busy after the user changes something or data is refreshed.
  function setBusy(button, busy) {
    if (!button) return;
    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent;
    }
    button.disabled = busy;
    button.textContent = busy ? 'Submitting...' : button.dataset.defaultText;
  }

  async function saveVerificationDraft() {
    if (!currentUser) return;
    if (draftSaveInProgress) {
      draftSaveQueued = true;
      return;
    }
    draftSaveInProgress = true;
    try {
      await updateEmployerVerification(currentUser.id, {
        businessType: details.businessType?.value || '',
        ssmNumber: details.ssmNumber?.value.trim() || '',
        verificationAddress: details.businessAddress?.value.trim() || ''
      });
      setSubmitStatus('Draft updated. Upload the required documents and submit when ready.');
    } catch (error) {
      console.error('Failed to save verification draft:', error);
      setSubmitStatus(error?.message || 'Unable to save your verification draft.', 'is-error');
    } finally {
      draftSaveInProgress = false;
      if (draftSaveQueued) {
        draftSaveQueued = false;
        window.clearTimeout(draftSaveTimer);
        draftSaveTimer = window.setTimeout(saveVerificationDraft, 0);
      }
    }
  }

  function scheduleVerificationDraftSave() {
    window.clearTimeout(draftSaveTimer);
    draftSaveTimer = window.setTimeout(saveVerificationDraft, 350);
  }

  // Updates metric after the user changes something or data is refreshed.
  function setMetric(metric, percentage) {
    const rounded = Math.max(0, Math.min(100, Math.round(percentage)));
    if (metric.bar) metric.bar.style.width = `${rounded}%`;
    if (metric.value) metric.value.textContent = `${rounded}%`;
  }

  // Helper function for read image or file used by this script.
  function readImageOrFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  // Loads image element data so the page can display current information.
  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to process the selected image.'));
      image.src = src;
    });
  }

  // Helper function for compress if image used by this script.
  async function compressIfImage(file) {
    if (!file.type.startsWith('image/')) {
      return readImageOrFile(file);
    }

    const source = await readImageOrFile(file);
    const image = await loadImageElement(source);
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) throw new Error('Unable to prepare the selected image.');

    context.drawImage(image, 0, 0, width, height);

    let quality = 0.84;
    let output = canvas.toDataURL('image/jpeg', quality);
    while (output.length > 600000 && quality > 0.46) {
      quality -= 0.08;
      output = canvas.toDataURL('image/jpeg', quality);
    }

    if (output.length > 600000) {
      throw new Error('Image is too large after compression. Please choose a smaller file.');
    }

    return output;
  }

  // Updates dashboard after the user changes something or data is refreshed.
  function updateDashboard(profile = {}) {
    const hasCompanyProfile = Boolean(
      (profile.companyName || profile.businessName || profile.name) &&
      (profile.email || currentUser?.email) &&
      profile.location
    );

    const documentCount = [savedPackage.registration, savedPackage.contact]
      .filter(Boolean)
      .length;
    const hasVerificationDetails = Boolean(
      (!verificationRequirements(savedPackage.businessType).requiresRegistrationNumber || savedPackage.ssmNumber) &&
      savedPackage.businessType &&
      savedPackage.businessAddress
    );

    setMetric(tracks.company, hasCompanyProfile ? (hasVerificationDetails ? 100 : 78) : 52);
    setMetric(tracks.documents, (documentCount / 2) * 100);
    const normalizedStatus = String(savedPackage.status || '').toLowerCase();
    const reviewProgress = normalizedStatus === 'approved'
      ? 100
      : normalizedStatus === 'rejected'
        ? 100
        : normalizedStatus === 'recheck'
          ? 55
          : normalizedStatus === 'submitted'
            ? 20
            : 0;

    setMetric(tracks.review, reviewProgress);

    if (statusTitleEl) {
      statusTitleEl.textContent = normalizedStatus === 'approved'
        ? 'Current status: Approved'
        : normalizedStatus === 'rejected'
          ? 'Current status: Rejected'
          : normalizedStatus === 'recheck'
            ? 'Current status: Needs Recheck'
            : normalizedStatus === 'submitted'
              ? 'Current status: Submitted'
              : 'Current status: Pending';
    }
  }

  // Runs the status with profile step for this page workflow.
  function syncStatusWithProfile(profile = {}) {
    savedPackage.status = profile.isVerified ? 'approved' : (profile.verificationStatus || savedPackage.status || 'pending');
    savedPackage.ssmNumber = profile.ssmNumber || savedPackage.ssmNumber || '';
    savedPackage.businessType = normalizeEmployerType(profile.businessType || savedPackage.businessType);
    savedPackage.businessAddress = profile.verificationAddress || savedPackage.businessAddress || '';
    savedPackage.registration = profile.registrationDocData
      ? { name: profile.registrationDocName || 'registration-file', content: profile.registrationDocData }
      : savedPackage.registration;
    savedPackage.contact = profile.contactDocData
      ? { name: profile.contactDocName || 'contact-proof', content: profile.contactDocData }
      : savedPackage.contact;
    savedPackage.reviewNotes = profile.verificationNotes || '';

    if (details.ssmNumber) details.ssmNumber.value = savedPackage.ssmNumber;
    if (details.businessType) details.businessType.value = savedPackage.businessType;
    if (details.businessAddress) details.businessAddress.value = savedPackage.businessAddress;

    updateRequirements();

    if (savedPackage.registration) setFieldStatus('registration', `Saved: ${savedPackage.registration.name}`, 'success');
    if (savedPackage.contact) setFieldStatus('contact', `Saved: ${savedPackage.contact.name}`, 'success');
  }

  // Helper function for prepare file used by this script.
  async function prepareFile(key) {
    const file = selectedFiles[key];
    if (!file) return savedPackage[key];
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Verification files must be PDF, PNG, JPG, or WebP.');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Each file must be 2MB or smaller.');
    }

    const dataUrl = await compressIfImage(file);
    const payload = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      content: dataUrl,
      savedAt: new Date().toISOString()
    };
    savedPackage[key] = payload;
    selectedFiles[key] = null;
    if (files[key]?.input) files[key].input.value = '';
    setFieldStatus(key, `Saved: ${payload.name}`, 'success');
    return payload;
  }

  // Handles the submit action triggered by the user.
  async function handleSubmit(event) {
    event.preventDefault();
    if (!currentUser) return;

    setBusy(submitBtn, true);
    setSubmitStatus('Saving verification package...');

    try {
      savedPackage.ssmNumber = details.ssmNumber?.value.trim() || '';
      savedPackage.businessType = details.businessType?.value || '';
      savedPackage.businessAddress = details.businessAddress?.value.trim() || '';

      if (!verificationRequirements(savedPackage.businessType).requiresRegistrationNumber) {
        savedPackage.ssmNumber = '';
      }

      await prepareFile('registration');
      await prepareFile('contact');

      const packageError = verificationPackageError(savedPackage);
      if (packageError) {
        setSubmitStatus(packageError, 'is-error');
        return;
      }

      savedPackage.status = 'submitted';
      await updateEmployerVerification(currentUser.id, {
        ssmNumber: savedPackage.ssmNumber,
        businessType: savedPackage.businessType,
        verificationAddress: savedPackage.businessAddress,
        verificationStatus: savedPackage.status,
        verificationNotes: '',
        registrationDocName: savedPackage.registration?.name || '',
        registrationDocData: savedPackage.registration?.content || '',
        contactDocName: savedPackage.contact?.name || '',
        contactDocData: savedPackage.contact?.content || ''
      });
      const profile = await fetchProfile(currentUser.id, currentUser);
      updateDashboard(profile);
      setSubmitStatus('Verification package submitted successfully.', 'is-success');
    } catch (error) {
      console.error('Failed to save verification package:', error);
      setSubmitStatus(error?.message || 'Unable to save the verification package right now.', 'is-error');
    } finally {
      setBusy(submitBtn, false);
    }
  }

  // Sets up file inputs when this script is loaded.
  function bindFileInputs() {
    Object.entries(files).forEach(([key, field]) => {
      field.input?.addEventListener('change', () => {
        const file = field.input.files?.[0] || null;
        selectedFiles[key] = file;

        if (!file) {
          setFieldStatus(key, savedPackage[key] ? `Saved: ${savedPackage[key].name}` : 'No file selected.');
          return;
        }

        setFieldStatus(key, `Selected: ${file.name}`);
      });
    });
  }

  observeAuth(async (user) => {
    currentUser = user;

    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    try {
      const profile = await fetchProfile(user.id, user);
      syncStatusWithProfile(profile);
      updateDashboard(profile);
      if (savedPackage.status === 'approved') {
        setSubmitStatus('Your employer verification has been approved.');
      } else if (savedPackage.status === 'rejected') {
        setSubmitStatus('Your verification was rejected. Update the package and resubmit if needed.');
      } else if (savedPackage.status === 'recheck') {
        setSubmitStatus(savedPackage.reviewNotes || 'Admin requested a recheck. Please update your package and submit again.');
      } else if (savedPackage.status === 'submitted') {
        setSubmitStatus('Verification package submitted successfully.');
      } else {
        setSubmitStatus('Upload your files first, then submit your verification package.');
      }
    } catch (error) {
      console.error('Failed to load verification profile context:', error);
      updateDashboard({});
    }
  });

  details.businessType?.addEventListener('change', () => {
    const wasIndividual = verificationRequirements(savedPackage.businessType).individual;
    const isIndividual = verificationRequirements(details.businessType.value).individual;
    if (wasIndividual !== isIndividual) {
      for (const key of ['registration', 'contact']) {
        savedPackage[key] = null;
        selectedFiles[key] = null;
        files[key].input.value = '';
        setFieldStatus(key, 'Please upload the document for this employer type.');
      }
    }
    savedPackage.businessType = details.businessType.value;
    updateRequirements();
    updateDashboard();
    window.clearTimeout(draftSaveTimer);
    saveVerificationDraft();
  });
  [details.ssmNumber, details.businessAddress].forEach((field) => {
    field?.addEventListener('input', scheduleVerificationDraftSave);
    field?.addEventListener('change', () => {
      window.clearTimeout(draftSaveTimer);
      saveVerificationDraft();
    });
    field?.addEventListener('blur', () => {
      window.clearTimeout(draftSaveTimer);
      saveVerificationDraft();
    });
  });
  updateRequirements();
  bindFileInputs();
  form?.addEventListener('submit', handleSubmit);
})();

/**
 * EasyEarn file note: Handles the admin profile page behavior and related user interactions.
 */
import { fetchProfile, getInitials, observeAuth, upsertProfile } from './supabase-data.js';

(function () {
  'use strict';

  const form = document.getElementById('admin-profile-form');
  const saveBtn = document.getElementById('admin-save-profile-btn');
  const statusEl = document.getElementById('admin-profile-status');
  const photoStatusEl = document.getElementById('admin-photo-status');
  const fields = {
    name: document.getElementById('admin-name'),
    email: document.getElementById('admin-email'),
    phone: document.getElementById('admin-phone'),
    location: document.getElementById('admin-location'),
    bio: document.getElementById('admin-bio'),
    photo: document.getElementById('admin-photo-file')
  };

  const preview = {
    avatar: document.getElementById('admin-profile-avatar'),
    name: document.getElementById('admin-profile-preview-name'),
    meta: document.getElementById('admin-profile-preview-meta'),
    basicBar: document.getElementById('admin-basic-track'),
    basicValue: document.getElementById('admin-basic-value'),
    identityBar: document.getElementById('admin-identity-track'),
    identityValue: document.getElementById('admin-identity-value'),
    readyBar: document.getElementById('admin-ready-track'),
    readyValue: document.getElementById('admin-ready-value')
  };

  let currentUser = null;
  let selectedPhotoData = '';
  let currentPhotoData = '';

  // Updates header after the user changes something or data is refreshed.
  function updateHeader(name, photoSrc = '') {
    const navName = document.getElementById('nav-user-name');
    const navBadge = document.getElementById('nav-user-badge');

    if (navName) navName.textContent = name || 'Admin';
    if (!navBadge) return;

    if (photoSrc) {
      navBadge.classList.add('has-image');
      navBadge.style.backgroundImage = `url("${photoSrc}")`;
      navBadge.textContent = '';
      return;
    }

    navBadge.classList.remove('has-image');
    navBadge.style.backgroundImage = '';
    navBadge.textContent = getInitials(name || 'Admin', 'AD');
  }

  // Updates status after the user changes something or data is refreshed.
  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('is-success', 'is-error');
    if (type) statusEl.classList.add(type);
  }

  // Updates photo status after the user changes something or data is refreshed.
  function setPhotoStatus(message, type = '') {
    if (!photoStatusEl) return;
    photoStatusEl.textContent = message;
    photoStatusEl.classList.remove('is-success', 'is-error');
    if (type) photoStatusEl.classList.add(type);
  }

  // Updates busy after the user changes something or data is refreshed.
  function setBusy(isBusy) {
    if (!saveBtn) return;
    if (!saveBtn.dataset.defaultText) saveBtn.dataset.defaultText = saveBtn.textContent;
    saveBtn.disabled = isBusy;
    saveBtn.textContent = isBusy ? 'Saving...' : saveBtn.dataset.defaultText;
  }

  // Updates metric after the user changes something or data is refreshed.
  function setMetric(barEl, valueEl, percentage) {
    const rounded = Math.max(0, Math.min(100, Math.round(percentage)));
    if (barEl) barEl.style.width = `${rounded}%`;
    if (valueEl) valueEl.textContent = `${rounded}%`;
  }

  // Helper function for read file as data URL used by this script.
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  // Loads image data so the page can display current information.
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to process the selected image.'));
      image.src = src;
    });
  }

  // Helper function for compress image used by this script.
  async function compressImage(file) {
    const source = await readFileAsDataUrl(file);
    if (!file.type.startsWith('image/')) return source;

    const image = await loadImage(source);
    const maxSide = 1200;
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
    return output;
  }

  // Renders preview into the HTML so the user can see it.
  function renderPreview() {
    const name = fields.name?.value.trim() || currentUser?.email?.split('@')[0] || 'Admin';
    const email = fields.email?.value.trim() || 'Email not set';
    const phone = fields.phone?.value.trim() || 'Phone not set';
    const location = fields.location?.value.trim() || 'Location not set';
    const bio = fields.bio?.value.trim() || 'Add an admin bio for stronger platform identity.';
    const photo = selectedPhotoData || currentPhotoData;

    if (preview.name) preview.name.textContent = name;
    if (preview.meta) preview.meta.textContent = `${email} - ${phone} - ${location}`;

    if (preview.avatar) {
      if (photo) {
        preview.avatar.style.backgroundImage = `url("${photo}")`;
        preview.avatar.textContent = '';
      } else {
        preview.avatar.style.backgroundImage = '';
        preview.avatar.textContent = getInitials(name, 'AD');
      }
    }

    updateHeader(name, photo);

    const basic = [name, email, phone, location].filter((item) => item && !String(item).includes('not set')).length / 4 * 100;
    const identity = [photo, bio].filter(Boolean).length / 2 * 100;
    // Helper function for ready used by this script.
    const ready = ((basic + identity) / 2);

    setMetric(preview.basicBar, preview.basicValue, basic);
    setMetric(preview.identityBar, preview.identityValue, identity);
    setMetric(preview.readyBar, preview.readyValue, ready);
  }

  // Handles the photo change action triggered by the user.
  async function handlePhotoChange() {
    const file = fields.photo?.files?.[0];
    if (!file) {
      selectedPhotoData = '';
      setPhotoStatus(currentPhotoData ? 'Current image kept.' : 'No image selected.');
      renderPreview();
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setPhotoStatus('Image must be 2MB or smaller.', 'is-error');
      fields.photo.value = '';
      return;
    }

    try {
      selectedPhotoData = await compressImage(file);
      setPhotoStatus(`Selected: ${file.name}`, 'is-success');
      renderPreview();
    } catch (error) {
      console.error('Admin photo processing failed:', error);
      selectedPhotoData = '';
      setPhotoStatus(error.message || 'Unable to process the selected image.', 'is-error');
    }
  }

  // Handles the submit action triggered by the user.
  async function handleSubmit(event) {
    event.preventDefault();
    if (!currentUser) return;

    setBusy(true);
    setStatus('Saving admin profile...');

    try {
      const payload = {
        name: fields.name?.value.trim() || currentUser.email?.split('@')[0] || 'Admin',
        full_name: fields.name?.value.trim() || currentUser.email?.split('@')[0] || 'Admin',
        email: fields.email?.value.trim() || currentUser.email || '',
        phone: fields.phone?.value.trim() || '',
        location: fields.location?.value.trim() || '',
        bio: fields.bio?.value.trim() || '',
        profile_pic: selectedPhotoData || currentPhotoData || '',
        role: 'admin'
      };

      const saved = await upsertProfile(currentUser.id, payload);
      currentPhotoData = saved?.profile_pic || payload.profile_pic || '';
      selectedPhotoData = '';
      if (fields.photo) fields.photo.value = '';
      setPhotoStatus(currentPhotoData ? 'Admin image saved successfully.' : 'No image selected.');
      setStatus('Admin profile saved successfully.', 'is-success');
      renderPreview();
    } catch (error) {
      console.error('Failed to save admin profile:', error);
      setStatus(error?.message || 'Unable to save admin profile right now.', 'is-error');
    } finally {
      setBusy(false);
    }
  }

  // Helper function for populate used by this script.
  function populate(profile, user) {
    if (fields.name) fields.name.value = profile.name || user?.email?.split('@')[0] || '';
    if (fields.email) fields.email.value = profile.email || user?.email || '';
    if (fields.phone) fields.phone.value = profile.phone || '';
    if (fields.location) fields.location.value = profile.location || '';
    if (fields.bio) fields.bio.value = profile.bio || '';
    currentPhotoData = profile.photoData || profile.photoUrl || '';
    setPhotoStatus(currentPhotoData ? 'Current image loaded.' : 'No image selected.');
    renderPreview();
  }

  Object.values(fields).forEach((field) => {
    if (field && field !== fields.photo) field.addEventListener('input', renderPreview);
  });
  fields.photo?.addEventListener('change', handlePhotoChange);
  form?.addEventListener('submit', handleSubmit);

  observeAuth(async (user) => {
    currentUser = user;
    if (!user) {
      window.location.href = '../../login.html';
      return;
    }

    try {
      const profile = await fetchProfile(user.id, user);
      populate(profile, user);
      setStatus('Admin profile is ready to edit.');
    } catch (error) {
      console.error('Failed to load admin profile:', error);
      populate({}, user);
      setStatus('Unable to load admin profile right now.', 'is-error');
    }
  });
})();

/**
 * EasyEarn file note: Handles the jobs page behavior and related user interactions.
 */
// jobs page scripts
import { supabase } from './supabase-config.js';
import { fetchPublicProfilesByIds } from './supabase-data.js';

(function () {
  'use strict';

  let allJobs = [];
  let activeFilter = 'all';
  let userCoords = null;
  let nearbyRadius = 10;
  let employerProfilesById = new Map();

  const CATEGORY_MAP = {
    events: 'events',
    event: 'events',
    'f&b': 'fnb',
    fnb: 'fnb',
    food: 'fnb',
    'food & beverage': 'fnb',
    education: 'education',
    tutor: 'education',
    delivery: 'delivery',
    logistic: 'delivery',
    logistics: 'delivery'
  };

  // Helper function for normalise category used by this script.
  function normaliseCategory(raw) {
    if (!raw) return 'other';
    return CATEGORY_MAP[String(raw).toLowerCase().trim()] || 'other';
  }

  // Helper function for relative date used by this script.
  function relativeDate(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
    if (diff <= 0) return 'Posted today';
    if (diff === 1) return 'Posted 1 day ago';
    return `Posted ${diff} days ago`;
  }

  // Helper function for haversine km used by this script.
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    // Helper function for d lat used by this script.
    const dLat = (lat2 - lat1) * Math.PI / 180;
    // Helper function for d lng used by this script.
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
      * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const geocodeCache = {};
  // Helper function for geocode location used by this script.
  async function geocodeLocation(locationStr) {
    if (!locationStr) return null;
    const key = locationStr.toLowerCase().trim();
    if (geocodeCache[key] !== undefined) return geocodeCache[key];
    try {
      const q = encodeURIComponent(`${locationStr}, Malaysia`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data && data[0]) {
        const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        geocodeCache[key] = coords;
        return coords;
      }
    } catch (error) {
      console.warn('Geocode failed', locationStr, error);
    }
    geocodeCache[key] = null;
    return null;
  }

  // Helper function for normalise job used by this script.
  function normaliseJob(job = {}) {
    return {
      id: job.id || '',
      employer_id: job.employer_id || '',
      title: job.title || job.job_title || 'Untitled Position',
      location: job.city || job.location || 'Malaysia',
      category: job.category || job.job_category || 'General',
      job_type: job.job_type || job.schedule || job.employment_type || 'Part-time',
      pay_rate: job.pay_rate || '',
      pay_type: job.pay_type || '',
      salary: job.salary || job.pay || job.rate || job.salary_range || '',
      created_at: job.created_at || '',
      expiry_date: job.expiry_date || null,
      status: String(job.status || '').toLowerCase(),
      isVerified: Boolean(job.verified || job.is_verified || job.employer_verified)
    };
  }

  // Helper function for query jobs table used by this script.
  async function queryJobsTable(tableName) {
    const isLegacyJobsTable = tableName === 'jobs';
    const selectClause = isLegacyJobsTable
      ? 'id, title, job_title, location, city, category, job_category, schedule, employment_type, salary, pay, rate, salary_range, verified, is_verified, employer_verified, status, created_at'
      : 'id, employer_id, title, category, location, job_type, pay_rate, pay_type, status, created_at, expiry_date';

    const { data, error } = await supabase
      .from(tableName)
      .select(selectClause)
      .in('status', isLegacyJobsTable ? ['active', 'open', 'approved'] : ['open', 'approved', 'active'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(normaliseJob);
  }

  // Loads jobs data so the page can display current information.
  async function fetchJobs() {
    let lastError = null;

    for (const tableName of ['job_listings', 'jobs']) {
      try {
        const jobs = await queryJobsTable(tableName);
        if (jobs.length > 0) return jobs;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) throw lastError;
    return [];
  }

  // Renders card into the HTML so the user can see it.
  function renderCard(job) {
    const title = escapeHtml(job.title);
    const location = escapeHtml(job.location);
    const salary = escapeHtml(
      job.salary || (job.pay_rate ? `RM${job.pay_rate}/${job.pay_type || 'day'}` : 'Negotiable')
    );
    const schedule = escapeHtml(job.job_type || 'Part-time');
    const category = job.category || '';
    const catKey = normaliseCategory(category);
    const catLabel = escapeHtml(category || catKey);
    const dateStr = relativeDate(job.created_at);
    const employerProfile = employerProfilesById.get(job.employer_id || '') || null;
    const isVerified = Boolean(job.isVerified || employerProfile?.isVerified);

    let distanceBadge = '';
    if (userCoords && job._distanceKm != null) {
      const label = job._distanceKm < 1
        ? `${Math.round(job._distanceKm * 1000)} m away`
        : `${job._distanceKm.toFixed(1)} km away`;
      distanceBadge = `<span class="job-distance-badge">${escapeHtml(label)}</span>`;
    }

    const keywords = [title, location, salary, schedule, catLabel].join(' ').toLowerCase();

    return `
      <div class="job-card" data-category="${catKey}" data-keywords="${keywords}">
        <div class="job-top">
          <span class="job-category ${catKey}">${catLabel}</span>
          ${isVerified ? '<span class="verified-badge">Verified</span>' : ''}
          ${distanceBadge}
        </div>
        <h3>${title}</h3>
        <div class="job-details">
          <span>Location: ${location}</span>
          <span>Pay: ${salary}</span>
          <span>Schedule: ${schedule}</span>
        </div>
        <div class="job-footer">
          <span class="job-date">${dateStr}</span>
          <button class="btn-apply" onclick="location.href='login.html?tab=register'">Apply</button>
        </div>
      </div>`;
  }

  // Helper function for apply filters used by this script.
  async function applyFilters() {
    const grid = document.getElementById('jobs-grid');
    const empty = document.getElementById('jobs-empty');
    const searchInput = document.getElementById('jobs-search');
    if (!grid) return;

    // Helper function for term used by this script.
    const term = (searchInput?.value || '').trim().toLowerCase();

    let filtered = allJobs.filter((job) => {
      const catKey = normaliseCategory(job.category || '');
      const catMatch = activeFilter === 'all' || catKey === activeFilter;
      const keywords = [job.title, job.location, job.category, job.job_type, job.pay_type, job.pay_rate, job.salary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return catMatch && (term === '' || keywords.includes(term));
    });

    if (userCoords) {
      const withCoords = await Promise.all(filtered.map(async (job) => {
        const coords = await geocodeLocation(job.location);
        if (!coords) return { ...job, _distanceKm: null };
        return { ...job, _distanceKm: haversineKm(userCoords.lat, userCoords.lng, coords.lat, coords.lng) };
      }));

      filtered = withCoords
        .filter((job) => job._distanceKm != null && job._distanceKm <= nearbyRadius)
        .sort((a, b) => a._distanceKm - b._distanceKm);
    }

    grid.innerHTML = filtered.length ? filtered.map(renderCard).join('') : '';
    if (empty) empty.style.display = filtered.length === 0 ? 'block' : 'none';
  }

  // Sets up location UI when this script is loaded.
  function initLocationUI() {
    const btnLocate = document.getElementById('btn-locate');
    const locBar = document.getElementById('location-bar');
    const locName = document.getElementById('location-name');
    const radiusSel = document.getElementById('radius-select');
    const btnClear = document.getElementById('btn-clear-location');
    if (!btnLocate) return;

    // Connects this element event to the handler that should run next.
    btnLocate.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }

      btnLocate.disabled = true;
      btnLocate.textContent = 'Locating...';

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          btnLocate.textContent = 'Near Me';
          btnLocate.disabled = false;

          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${userCoords.lat}&lon=${userCoords.lng}&format=json`,
              { headers: { 'Accept-Language': 'en' } }
            );
            const data = await res.json();
            const name = data.address?.suburb
              || data.address?.city_district
              || data.address?.city
              || data.address?.town
              || data.address?.county
              || 'your location';
            if (locName) locName.textContent = name;
          } catch {
            if (locName) locName.textContent = 'your location';
          }

          if (locBar) locBar.style.display = 'flex';
          applyFilters();
        },
        (err) => {
          btnLocate.disabled = false;
          btnLocate.textContent = 'Near Me';
          const msgs = {
            1: 'Location permission denied. Please allow location access in browser settings.',
            2: 'Unable to detect location. Check your GPS or network.',
            3: 'Location request timed out. Try again.'
          };
          alert(msgs[err.code] || 'Location error. Please try again.');
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    });

    radiusSel?.addEventListener('change', () => {
      nearbyRadius = parseInt(radiusSel.value, 10);
      if (userCoords) applyFilters();
    });

    btnClear?.addEventListener('click', () => {
      userCoords = null;
      if (locBar) locBar.style.display = 'none';
      applyFilters();
    });
  }

  // Loads jobs data so the page can display current information.
  async function loadJobs() {
    const loading = document.getElementById('jobs-loading');
    const empty = document.getElementById('jobs-empty');

    try {
      allJobs = await fetchJobs();
      const employerIds = Array.from(new Set(allJobs.map((job) => job.employer_id).filter(Boolean)));
      try {
        const employerProfiles = await fetchPublicProfilesByIds(employerIds);
        employerProfilesById = employerProfiles.reduce((map, profile) => {
          if (profile.id) map.set(profile.id, profile);
          return map;
        }, new Map());
      } catch (error) {
        employerProfilesById = new Map();
        console.warn('Unable to load employer verification badges:', error);
      }
      allJobs = allJobs.filter((job) => job.status === 'approved'
        && employerProfilesById.get(job.employer_id)?.isVerified === true);
      if (loading) loading.style.display = 'none';

      if (!allJobs.length) {
        if (empty) empty.style.display = 'block';
        return;
      }

      applyFilters();
    } catch (err) {
      console.error('Failed to load jobs:', err);
      if (loading) loading.textContent = 'Unable to load jobs. Please refresh and try again.';
    }
  }

  // Sets up init when this script is loaded.
  function init() {
    const searchInput = document.getElementById('jobs-search');
    const filters = document.getElementById('jobs-filters');

    filters?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      activeFilter = btn.dataset.filter || 'all';
      filters.querySelectorAll('.filter-pill').forEach((pill) => pill.classList.remove('is-active'));
      btn.classList.add('is-active');
      applyFilters();
    });

    searchInput?.addEventListener('input', applyFilters);
    initLocationUI();
    loadJobs();
  }

  if (document.readyState === 'loading') {
    // Waits until the HTML has loaded before running page setup code.
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Formats or checks HTML so later code can use a clean value.
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();

/**
 * EasyEarn file note: Handles the employer ratings page behavior and related user interactions.
 */
import { observeAuth, fetchRatings, calcAverageRating, fetchProfile } from './supabase-data.js';

// Runs the stars step for this page workflow.
function stars(n) {
  return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
}

// Formats or checks HTML so later code can use a clean value.
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

observeAuth(async (user) => {
  if (!user) { window.location.href = '../../login.html'; return; }

  let ratings = [];
  try {
    ratings = await fetchRatings(user.id);
    // Only show ratings where reviewer is a job seeker (seeker rating employer)
    ratings = ratings.filter(r => {
      // Helper function for role used by this script.
      const role = (r.reviewer_role || '').toLowerCase();
      return role === 'seeker' || role === 'jobseeker' || role === 'job_seeker';
    });
  } catch (e) {
    console.error(e);
  }

  // Summary
  const total = ratings.length;
  const avg = calcAverageRating(ratings);
  const fiveStar = ratings.filter(r => Number(r.stars) === 5).length;

  document.getElementById('avg-rating').textContent = avg ? avg.toFixed(1) : '—';
  document.getElementById('avg-rating-sub').textContent = total ? `Based on ${total} review${total > 1 ? 's' : ''}` : 'No ratings yet';
  document.getElementById('total-reviews').textContent = total || '0';
  document.getElementById('total-reviews-sub').textContent = total ? `From job seekers` : 'Complete jobs to earn reviews';
  document.getElementById('five-star').textContent = fiveStar || '0';
  document.getElementById('five-star-sub').textContent = total ? `${Math.round(fiveStar / total * 100)}% of reviews` : 'No ratings yet';

  // Star breakdown
  const breakdown = document.getElementById('star-breakdown');
  if (total === 0) {
    breakdown.innerHTML = '<p style="color:var(--text-muted)">No ratings yet. Complete jobs to receive reviews.</p>';
  } else {
    let html = '';
    for (let s = 5; s >= 1; s--) {
      const count = ratings.filter(r => Math.round(Number(r.stars)) === s).length;
      const pct = Math.round(count / total * 100);
      html += `<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
        <span style="min-width:60px;color:#f5a623">${'★'.repeat(s)}</span>
        <div style="flex:1;background:var(--border-color,#e5e7eb);border-radius:99px;height:10px">
          <div style="width:${pct}%;background:#f5a623;height:10px;border-radius:99px"></div>
        </div>
        <span style="min-width:40px;color:var(--text-muted)">${count}</span>
      </div>`;
    }
    breakdown.innerHTML = html;
  }

  // Reviews list
  const list = document.getElementById('reviews-list');
  if (total === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);padding:1rem">No reviews yet. Reviews appear here after job seekers rate you.</p>';
  } else {
    // Try to fetch reviewer names
    const reviewerIds = [...new Set(ratings.map(r => r.reviewer_id).filter(Boolean))];
    const nameMap = {};
    await Promise.all(reviewerIds.map(async id => {
      try {
        const p = await fetchProfile(id);
        nameMap[id] = p?.full_name || p?.name || 'Anonymous';
      } catch { nameMap[id] = 'Anonymous'; }
    }));

    list.innerHTML = ratings.map(r => `
      <article class="employer-item">
        <strong>${escapeHtml(nameMap[r.reviewer_id] || 'Anonymous')}</strong>
        <span style="color:#f5a623;font-size:1.1rem">${stars(r.stars)}</span>
        <p>${escapeHtml(r.review || 'No written review.')}</p>
        <div class="employer-item-meta">
          <span>Stars: ${r.stars}/5</span>
          <span>${r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
        </div>
      </article>`).join('');
  }
});

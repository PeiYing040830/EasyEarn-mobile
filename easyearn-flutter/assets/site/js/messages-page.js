/**
 * EasyEarn file note: Handles the messages page page behavior and related user interactions.
 */
import { downloadChatAttachment } from './chat-attachments.js';
import {
  createChatMessage,
  fetchChatMessages,
  fetchProfilesByIds,
  fetchChatThreads,
  fetchProfile,
  fetchRatingsForReviewees,
  markChatThreadAsRead,
  observeAuth,
  uploadChatImage
} from './supabase-data.js';

(function () {
  'use strict';

  const body = document.body;
  const threadListEl = document.getElementById('messages-thread-list');
  const threadSelectEl = document.getElementById('messages-thread-select');
  const threadBodyEl = document.getElementById('messages-thread-body');
  const threadTitleEl = document.getElementById('messages-thread-title');
  const threadSubtitleEl = document.getElementById('messages-thread-subtitle');
  const formEl = document.getElementById('messages-form');
  const inputEl = document.getElementById('messages-input');
  const sendBtn = document.getElementById('messages-send-btn');
  const statusEl = document.getElementById('messages-status');
  const role = body?.dataset?.messagesRole || 'jobseeker';
  const search = new URLSearchParams(window.location.search);

  let currentUser = null;
  let currentProfile = null;
  let threads = [];
  let activeThread = null;
  let pendingImageFile = null;
  let sending = false;
  let fileInput = null;
  let imagePreviewEl = null;
  let counterpartRatingsById = new Map();
  let counterpartRolesById = new Map();

  if (inputEl) inputEl.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  // Formats or checks role so later code can use a clean value.
  function normalizeRole(value) {
    const roleValue = String(value || '').trim().toLowerCase();
    if (roleValue === 'jobseeker' || roleValue === 'job seeker') return 'seeker';
    return roleValue;
  }

  // Helper function for expected role used by this script.
  function expectedRole() {
    if (role === 'admin') return 'admin';
    if (role === 'employer') return 'employer';
    return 'seeker';
  }

  // Runs the by role step for this page workflow.
  function redirectByRole(actualRole) {
    if (actualRole === 'admin') {
      window.location.href = '../admin/dashboard.html';
      return;
    }
    if (actualRole === 'employer') {
      window.location.href = '../employer/dashboard.html';
      return;
    }
    window.location.href = '../jobseeker/dashboard.html';
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

  // Updates status after the user changes something or data is refreshed.
  function setStatus(message, type = '') {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'messages-status ' + type;
  }

  // Loads current display name data so the page can display current information.
  function getCurrentDisplayName() {
    return currentProfile?.name
      || currentUser?.user_metadata?.name
      || currentUser?.user_metadata?.full_name
      || currentUser?.email
      || (role === 'employer' ? 'Employer' : role === 'admin' ? 'Admin' : 'Job Seeker');
  }

  // Loads counterpart rating data so the page can display current information.
  function getCounterpartRating(counterpartId) {
    const counterpartRole = counterpartRolesById.get(counterpartId) || '';
    if (counterpartRole === 'admin') return 'Admin support';

    const ratingSummary = counterpartRatingsById.get(counterpartId) || null;
    if (!ratingSummary || !ratingSummary.count) {
      if (counterpartRole === 'employer') return 'New employer';
      if (counterpartRole === 'seeker') return 'New job seeker';
      if (role === 'employer') return 'New job seeker';
      if (role === 'admin') return 'EasyEarn user';
      return 'New employer';
    }

    const averageText = Number(ratingSummary.average).toFixed(1);
    const reviewLabel = ratingSummary.count === 1 ? 'review' : 'reviews';
    return `★ ${averageText} · ${ratingSummary.count} ${reviewLabel}`;
  }

  // Helper function for empty state class used by this script.
  function emptyStateClass() {
    if (role === 'jobseeker') return 'jobseeker-item';
    if (role === 'admin') return 'admin-item';
    return 'employer-item';
  }

  // Loads thread from query data so the page can display current information.
  function getThreadFromQuery() {
    const counterpartId = search.get('user') || '';
    if (!counterpartId) return null;
    return {
      counterpartId,
      counterpartName: search.get('name') || (role === 'employer' ? 'Job Seeker' : 'Employer'),
      jobId: search.get('jobId') || '',
      jobTitle: search.get('job') || 'Job conversation'
    };
  }

  // ── Inject toolbar + image preview into form ──────────────────────────────

  // Formats or checks chat extras so later code can use a clean value.
  function buildChatExtras() {
    if (!formEl) return;
    if (formEl.dataset.extrasBuilt) return;   // ← already built, skip
    formEl.dataset.extrasBuilt = '1';

    // Hidden file input
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    formEl.appendChild(fileInput);

    // Image preview strip (above textarea label)
    imagePreviewEl = document.createElement('div');
    imagePreviewEl.className = 'messages-image-preview';
    imagePreviewEl.hidden = true;
    imagePreviewEl.innerHTML = '<img id="messages-preview-img" src="" alt="Preview" /><button type="button" id="messages-clear-image" class="messages-clear-img" title="Remove">✕</button>';

    const labelEl = formEl.querySelector('label[for="messages-input"]');
    if (labelEl) formEl.insertBefore(imagePreviewEl, labelEl);
    else formEl.insertBefore(imagePreviewEl, formEl.firstChild);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'messages-toolbar';
    toolbar.innerHTML =
      '<button type="button" id="messages-attach-btn" class="messages-tool-btn">📎 Attach Image</button>';
    formEl.insertBefore(toolbar, imagePreviewEl);

    // Events
    document.getElementById('messages-attach-btn').addEventListener('click', () => fileInput.click());

    // Connects this element event to the handler that should run next.
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || !file.size || file.size > 3 * 1024 * 1024) {
        fileInput.value = '';
        setStatus('Choose a non-empty PNG, JPG, WebP or GIF image, up to 3MB.', 'is-error');
        return;
      }
      pendingImageFile = file;
      const reader = new FileReader();
      reader.onload = function(e) {
        document.getElementById('messages-preview-img').src = e.target.result;
        imagePreviewEl.hidden = false;
        setStatus('Image ready to send.');
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });

    document.getElementById('messages-clear-image').addEventListener('click', () => {
      pendingImageFile = null;
      imagePreviewEl.hidden = true;
      document.getElementById('messages-preview-img').src = '';
      setStatus(activeThread ? 'Image removed.' : 'Open a thread to start chatting.');
    });

  }


  // ── Render thread list ─────────────────────────────────────────────────────

  // Renders thread list into the HTML so the user can see it.
  function renderThreadList() {
    if (!threadListEl) return;
    if (threadSelectEl) {
      threadSelectEl.disabled = !threads.length;
      threadSelectEl.innerHTML = threads.length
        ? '<option value="">Choose a conversation</option>' + threads.map(function(thread, index) {
          const selected = activeThread && activeThread.counterpartId === thread.counterpartId && String(activeThread.jobId || '') === String(thread.jobId || '') ? ' selected' : '';
          return '<option value="' + index + '"' + selected + '>' + escapeHtml((thread.counterpartName || 'EasyEarn User') + ' — ' + (thread.jobTitle || 'Job conversation')) + '</option>';
        }).join('')
        : '<option value="">No conversations yet</option>';
    }
    if (!threads.length) {
      threadListEl.innerHTML = '<article class="' + emptyStateClass() + '"><strong>No messages yet</strong><p class="application-company">' + (role === 'admin' ? 'Start from Reports to contact an employer.' : 'Start from Applicants or Applications to open your first conversation.') + '</p></article>';
      return;
    }
    threadListEl.innerHTML = threads.map(function(thread) {
      const isActive = activeThread && activeThread.counterpartId === thread.counterpartId && String(activeThread.jobId || '') === String(thread.jobId || '');
      const ratingText = getCounterpartRating(thread.counterpartId);
      return '<button type="button" class="messages-thread-btn ' + (isActive ? 'is-active' : '') + '" data-user="' + escapeHtml(thread.counterpartId) + '" data-name="' + escapeHtml(thread.counterpartName) + '" data-job-id="' + escapeHtml(thread.jobId || '') + '" data-job-title="' + escapeHtml(thread.jobTitle || 'Job conversation') + '">' +
        '<strong>' + escapeHtml(thread.counterpartName || 'EasyEarn User') + '</strong>' +
        (ratingText ? '<span class="messages-thread-rating">' + escapeHtml(ratingText) + '</span>' : '') +
        '<span>' + escapeHtml(thread.jobTitle || 'Job conversation') + '</span>' +
        '<small>' + escapeHtml(thread.latestBody || 'Open to continue the chat.') + '</small>' +
        (thread.unreadCount ? '<em>' + escapeHtml(String(thread.unreadCount)) + ' new</em>' : '') +
        '</button>';
    }).join('');
  }

  // ── Render messages ────────────────────────────────────────────────────────

  // Renders messages into the HTML so the user can see it.
  function renderMessages(messages) {
    if (!threadBodyEl) return;
    if (!messages || !messages.length) {
      threadBodyEl.innerHTML = '<article class="' + emptyStateClass() + '"><strong>No messages in this thread yet</strong><p class="application-company">Send the first message below to start the conversation.</p></article>';
      return;
    }

    threadBodyEl.innerHTML = messages.map(function(message) {
      const mine = message.senderId === currentUser?.id;
      const isDuitNow = message.messageType === 'duitnow';
      const hasImage = !!message.imageUrl;

      const imageHtml = hasImage
        ? '<a href="' + escapeHtml(message.imageUrl) + '" target="_blank" rel="noopener" class="messages-bubble-image-link">' +
            '<img src="' + escapeHtml(message.imageUrl) + '" alt="' + (isDuitNow ? 'DuitNow QR' : 'Image') + '" class="messages-bubble-image" />' +
            (isDuitNow ? '<span class="messages-duitnow-label">💳 Tap to enlarge &amp; scan</span>' : '') +
          '</a><button type="button" class="messages-tool-btn" data-download-image="' + escapeHtml(message.imageUrl) + '">Download image</button>'
        : '';

      const bodyHtml = message.body ? '<p>' + escapeHtml(message.body) + '</p>' : '';

      return '<article class="messages-bubble ' + (mine ? 'is-mine' : 'is-theirs') + (isDuitNow ? ' is-duitnow' : '') + '">' +
        '<strong>' + escapeHtml(mine ? 'You' : (message.senderName || activeThread?.counterpartName || 'EasyEarn User')) + '</strong>' +
        imageHtml + bodyHtml +
        '<small>' + escapeHtml(new Date(message.createdAt || Date.now()).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })) + '</small>' +
        '</article>';
    }).join('');

    threadBodyEl.scrollTop = threadBodyEl.scrollHeight;
  }

  // Helper function for open thread used by this script.
  async function openThread(thread) {
    activeThread = thread;
    renderThreadList();
    if (threadTitleEl) threadTitleEl.textContent = thread.counterpartName || 'Conversation';
    if (threadSubtitleEl) {
      const ratingText = getCounterpartRating(thread.counterpartId);
      const pieces = [
        thread.jobTitle ? 'Talking about ' + thread.jobTitle : 'Direct chat thread',
        ratingText
      ].filter(Boolean);
      threadSubtitleEl.textContent = pieces.join(' • ');
    }
    if (inputEl) inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    setStatus('Chatting with ' + (thread.counterpartName || 'EasyEarn User') + '.');
    try {
      const messages = await fetchChatMessages(currentUser.id, thread.counterpartId, thread.jobId || '');
      if (activeThread !== thread) return false;
      renderMessages(messages);
      try {
        await markChatThreadAsRead(currentUser.id, thread.counterpartId, thread.jobId || '', messages);
      } catch (error) {
        console.warn('Messages loaded, but marking them read failed:', error);
        if (activeThread === thread) setStatus('Messages loaded, but read receipts could not be updated.', 'is-error');
        return false;
      }
      if (activeThread !== thread) return false;
      threads = threads.map(function(item) {
        const sameThread = item.counterpartId === thread.counterpartId && String(item.jobId || '') === String(thread.jobId || '');
        return sameThread ? Object.assign({}, item, { unreadCount: 0 }) : item;
      });
      renderThreadList();
      return true;
    } catch (error) {
      console.error('Failed to open messages thread:', error);
      if (activeThread !== thread) return false;
      renderMessages([]);
      setStatus('Unable to load this conversation right now.', 'is-error');
      return false;
    }
  }

  // Loads threads data so the page can display current information.
  async function loadThreads() {
    threads = await fetchChatThreads(currentUser.id);
    const counterpartIds = Array.from(new Set(threads.map(function(thread) {
      return thread.counterpartId;
    }).filter(Boolean)));

    try {
      const counterpartProfiles = await fetchProfilesByIds(counterpartIds);
      counterpartRolesById = new Map(counterpartProfiles.map(function(profile) {
        return [profile.id, normalizeRole(profile.role)];
      }));
      const namesById = new Map(counterpartProfiles.map(function(profile) {
        return [profile.id, profile.name || profile.full_name || ''];
      }));

      threads = threads.map(function(thread) {
        const resolvedName = namesById.get(thread.counterpartId) || '';
        const currentName = String(thread.counterpartName || '').trim();
        const shouldReplace = !currentName
          || ['applicant', 'job seeker', 'seeker', 'easyearn user'].includes(currentName.toLowerCase());

        return shouldReplace && resolvedName
          ? Object.assign({}, thread, { counterpartName: resolvedName })
          : thread;
      });
    } catch (error) {
      counterpartRolesById = new Map();
      console.warn('Counterpart profile names load failed:', error);
    }

    try {
      const ratings = await fetchRatingsForReviewees(counterpartIds);
      counterpartRatingsById = ratings.reduce(function(map, rating) {
        const key = rating.reviewee_id;
        if (!key) return map;
        const current = map.get(key) || { totalStars: 0, count: 0, average: 0 };
        current.totalStars += Number(rating.stars || 0);
        current.count += 1;
        current.average = current.count ? current.totalStars / current.count : 0;
        map.set(key, current);
        return map;
      }, new Map());
    } catch (error) {
      counterpartRatingsById = new Map();
      console.warn('Counterpart ratings load failed:', error);
    }

    const queryThread = getThreadFromQuery();
    if (queryThread) {
      const exists = threads.find(function(item) { return item.counterpartId === queryThread.counterpartId && String(item.jobId || '') === String(queryThread.jobId || ''); });
      if (!exists) threads.unshift(Object.assign({}, queryThread, { latestBody: '', latestAt: '', unreadCount: 0 }));
    }
    renderThreadList();
    const initial = activeThread || queryThread || threads[0] || null;
    return initial ? await openThread(initial) : true;
  }

  threadBodyEl?.addEventListener('click', function(event) {
    const button = event.target.closest('[data-download-image]');
    if (!button) return;
    try { downloadChatAttachment(button.dataset.downloadImage); }
    catch (error) { setStatus(error.message, 'is-error'); }
  });

  threadListEl?.addEventListener('click', function(event) {
    const button = event.target.closest('.messages-thread-btn');
    if (!button) return;
    openThread({ counterpartId: button.dataset.user || '', counterpartName: button.dataset.name || 'EasyEarn User', jobId: button.dataset.jobId || '', jobTitle: button.dataset.jobTitle || 'Job conversation' });
  });
  threadSelectEl?.addEventListener('change', function() {
    if (threadSelectEl.value === '') return;
    const thread = threads[Number(threadSelectEl.value)];
    if (thread) openThread(thread);
  });

  formEl?.addEventListener('submit', async function(event) {
    event.preventDefault();
    if (sending) return;
    if (!activeThread || !currentUser) {
      if (inputEl) inputEl.disabled = true;
      if (sendBtn) sendBtn.disabled = true;
      setStatus('Choose a conversation first before sending a message.', 'is-error');
      return;
    }
    // Helper function for body text used by this script.
    const bodyText = (inputEl?.value || '').trim();
    if (!bodyText && !pendingImageFile) {
      setStatus('Type a message or attach an image before sending.', 'is-error');
      return;
    }

    sending = true;
    sendBtn.disabled = true;
    setStatus('Sending…');
    let messageSaved = false;

    try {
      let imageUrl = '';
      let messageType = 'text';

      if (pendingImageFile) {
        setStatus('Uploading image…');
        imageUrl = await uploadChatImage(pendingImageFile);
        messageType = 'image';
        pendingImageFile = null;
        if (imagePreviewEl) imagePreviewEl.hidden = true;
        const previewImg = document.getElementById('messages-preview-img');
        if (previewImg) previewImg.src = '';
      }

      await createChatMessage({
        sender_id: currentUser.id,
        sender_name: getCurrentDisplayName(),
        recipient_id: activeThread.counterpartId,
        recipient_name: activeThread.counterpartName || 'EasyEarn User',
        job_id: activeThread.jobId || '',
        job_title: activeThread.jobTitle || 'Job conversation',
        body: bodyText,
        image_url: imageUrl,
        message_type: messageType
      });

      messageSaved = true;
      if (inputEl) inputEl.value = '';
      const refreshed = await loadThreads();
      setStatus(refreshed
        ? 'Message sent.'
        : 'Message sent, but the conversation could not fully refresh. Please refresh; do not resend.',
        refreshed ? 'is-success' : 'is-error');
    } catch (error) {
      if (messageSaved) {
        console.warn('Message saved, but refreshing conversations failed:', error);
        setStatus('Message sent, but refreshing conversations failed. Please refresh; do not resend.', 'is-error');
        return;
      }
      console.error('Failed to send chat message:', error);
      const fallback = pendingImageFile
        ? 'Failed to send image. Please try a smaller file (max 3MB).'
        : 'Failed to send message. Please try again.';
      setStatus(error?.message || fallback, 'is-error');
    } finally {
      sending = false;
      sendBtn.disabled = !activeThread;
    }
  });

  observeAuth(async function(user) {
    currentUser = user;
    if (!user) { window.location.href = '../../login.html'; return; }
    buildChatExtras();
    try {
      currentProfile = await fetchProfile(user.id, user);
      const actualRole = normalizeRole(currentProfile.role || user.user_metadata?.role);
      if (actualRole && actualRole !== expectedRole()) {
        redirectByRole(actualRole);
        return;
      }
      await loadThreads();
    } catch (error) {
      console.error('Failed to load messages page:', error);
      const fallbackRole = normalizeRole(user.user_metadata?.role);
      if (fallbackRole && fallbackRole !== expectedRole()) {
        redirectByRole(fallbackRole);
        return;
      }
      setStatus('Unable to load messages right now.', 'is-error');
      renderThreadList();
    }
  });
})();

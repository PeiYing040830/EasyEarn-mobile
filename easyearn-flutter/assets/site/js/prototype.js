/**
 * EasyEarn file note: Handles the prototype page behavior and related user interactions.
 */
(function () {
  const STORAGE_KEY = 'easyearnPrototypeState';
  const USERS_KEY = 'easyearnPrototypeUsers';
  const SESSION_KEY = 'easyearnPrototypeSession';

  const defaultState = {
    verificationStatus: 'not_submitted',
    jobStatus: 'draft',
    applicationStatus: 'not_applied',
    workHistoryCreated: false,
    resumeGenerated: false,
    savedJob: false,
    profileSaved: false,
    language: 'en',
    seekerProfile: {
      headline: 'Student looking for part-time cashier roles',
      skills: 'Cashier, Customer Service, Communication',
      availability: 'Saturday, Sunday'
    },
    job: {
      title: 'Cashier',
      category: 'Food and Beverage',
      pay: 'RM10/hour',
      description: 'Part-time cashier needed for weekend shift.'
    }
  };

  let state = loadState();
  let session = loadSession();

  // Loads state data so the page can display current information.
  function loadState() {
    try {
      return {
        ...defaultState,
        ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      };
    } catch (error) {
      return { ...defaultState };
    }
  }

  // Runs the state step for this page workflow.
  function saveState(nextState) {
    state = { ...state, ...nextState };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderState();
  }

  // Loads users data so the page can display current information.
  function loadUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } catch (error) {
      return [];
    }
  }

  // Runs the users step for this page workflow.
  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  // Loads session data so the page can display current information.
  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  // Runs the session step for this page workflow.
  function saveSession(user) {
    session = user;
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
    renderSession();
  }

  // Helper function for text used by this script.
  function text(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // Updates disabled after the user changes something or data is refreshed.
  function setDisabled(id, disabled) {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  }

  // Updates done after the user changes something or data is refreshed.
  function setDone(id, done) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('done', done);
  }

  // Helper function for value used by this script.
  function value(id) {
    return document.getElementById(id)?.value.trim() || '';
  }

  // Updates value after the user changes something or data is refreshed.
  function setValue(id, nextValue) {
    const el = document.getElementById(id);
    if (el) el.value = nextValue;
  }

  // Shows the page message or section when the user needs feedback.
  function showPage(pageId) {
    const protectedPages = ['jobseeker', 'employer', 'admin'];

    if (protectedPages.includes(pageId) && !session) {
      renderSession('Please sign up and login before opening role pages.');
      pageId = 'auth';
    }

    if (protectedPages.includes(pageId) && session && pageId !== pageForRole(session.role)) {
      renderSession(`This demo account is ${formatRole(session.role)}. Login with another role to view ${formatRole(pageId)}.`);
      pageId = pageForRole(session.role);
    }

    document.querySelectorAll('.page').forEach((page) => {
      page.classList.toggle('active', page.id === pageId);
    });

    document.querySelectorAll('.nav-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.page === pageId);
    });
  }

  // Helper function for page for role used by this script.
  function pageForRole(role) {
    if (role === 'employer') return 'employer';
    if (role === 'admin') return 'admin';
    return 'jobseeker';
  }

  // Renders session into the HTML so the user can see it.
  function renderSession(message) {
    const summary = session
      ? `Logged in as ${session.name} (${formatRole(session.role)})`
      : 'Not logged in';

    text('session-summary', summary);
    text('auth-message', message || summary);
  }

  // Formats or checks role so later code can use a clean value.
  function formatRole(role) {
    const labels = {
      jobseeker: 'Job Seeker',
      employer: 'Employer',
      admin: 'Admin'
    };
    return labels[role] || 'Job Seeker';
  }

  // Shows the panel message or section when the user needs feedback.
  function showPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const page = panel.closest('.page');
    page?.querySelectorAll('.panel').forEach((item) => {
      item.classList.toggle('active', item.id === panelId);
    });

    page?.querySelectorAll('.sub-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.panel === panelId);
    });
  }

  // Helper function for application rank used by this script.
  function applicationRank() {
    const order = {
      not_applied: 0,
      pending: 1,
      reviewed: 2,
      accepted: 3,
      completed: 4
    };
    return order[state.applicationStatus] || 0;
  }

  // Renders state into the HTML so the user can see it.
  function renderState() {
    const isVerified = state.verificationStatus === 'approved';
    const verificationPending = state.verificationStatus === 'pending';
    const jobPending = state.jobStatus === 'pending';
    const jobApproved = state.jobStatus === 'approved';
    const appRank = applicationRank();
    const job = state.job || defaultState.job;
    const profile = state.seekerProfile || defaultState.seekerProfile;

    text('employer-verification-stat', `Verification: ${isVerified ? 'Approved' : verificationPending ? 'Pending' : 'Not submitted'}`);
    text('employer-verification-status', `Status: ${isVerified ? 'Approved by admin' : verificationPending ? 'Submitted, waiting for admin approval' : 'Not submitted'}`);
    text('admin-verification-stat', `Verifications Pending: ${verificationPending ? 1 : 0}`);
    text('admin-verification-status', `Status: ${isVerified ? 'Approved' : verificationPending ? 'Pending admin review' : 'Waiting for employer submission'}`);
    text('seeker-verified-badge', isVerified ? 'Verified Employer' : 'Verification pending');

    text('employer-job-stat', `Posted Jobs: ${state.jobStatus === 'draft' ? 0 : 1}`);
    text('employer-job-status', `Status: ${jobApproved ? 'Approved and visible to job seekers' : jobPending ? 'Submitted, waiting for admin approval' : state.jobStatus === 'created' ? 'Created, not submitted yet' : 'Draft'}`);
    text('admin-job-stat', `Jobs Pending: ${jobPending ? 1 : 0}`);
    text('admin-job-status', `Status: ${jobApproved ? 'Approved' : jobPending ? 'Pending admin approval' : 'Waiting for employer job post'}`);
    text('job-availability-note', jobApproved ? 'This job is approved and open for applications.' : 'Waiting for admin job approval.');
    text('seeker-job-title', job.title);
    text('seeker-job-pay', job.pay);
    text('seeker-job-description', job.description);
    text('admin-job-preview', `Job: ${job.title}, ${job.pay}`);

    setValue('job-title-input', job.title);
    setValue('job-category-input', job.category);
    setValue('job-pay-input', job.pay);
    setValue('job-description-input', job.description);

    text('seeker-application-stat', `Applications: ${appRank > 0 ? 1 : 0}`);
    text('seeker-saved-stat', `Saved Jobs: ${state.savedJob ? 1 : 0}`);
    text('employer-applicant-stat', `Applicants: ${appRank > 0 ? 1 : 0}`);
    text('applicant-status', `Status: ${formatApplicationStatus(state.applicationStatus)}`);
    text('application-record-line', appRank > 0 ? `Application record: applications -> ${job.title} / seeker profile` : 'Application record: not created');

    text('application-status-title', `${job.title} - ${formatApplicationStatus(state.applicationStatus)}`);
    text('application-resume-text', appRank > 0 ? 'Resume uploaded: pei-ying-resume.pdf' : 'Resume not uploaded yet.');

    text('profile-save-status', state.profileSaved ? 'Profile updated in localStorage.' : 'Profile not updated yet.');
    text('profile-identity-line', state.profileSaved ? `Profile: ${profile.headline} / ${profile.availability}` : 'Profile: not updated yet');
    setValue('profile-headline-input', profile.headline);
    setValue('profile-skills-input', profile.skills);
    setValue('profile-availability-input', profile.availability);

    text('saved-job-title', state.savedJob ? job.title : 'No saved job yet');
    text('saved-job-detail', state.savedJob ? `${job.category} / ${job.pay} / W&X Bakery` : 'Save an approved job from Browse Jobs to show it here.');

    text('seeker-work-stat', `Work History: ${state.workHistoryCreated ? 1 : 0}`);
    text('work-history-status', `Status: ${state.workHistoryCreated ? 'Completed' : 'Not created yet'}`);
    text('work-history-earnings', `Earnings: ${state.workHistoryCreated ? 'RM120' : '-'}`);
    text('identity-resume-status', `Identity resume: ${state.resumeGenerated ? 'Generated from work history' : 'Not generated'}`);
    text('language-demo-text', languageText(state.language));
    setValue('language-demo', state.language);

    setDone('flow-verification', isVerified);
    setDone('flow-job', jobApproved);
    setDone('flow-apply', appRank >= 1);
    setDone('flow-accept', appRank >= 3);
    setDone('flow-work', state.workHistoryCreated);

    setDone('step-submitted', appRank >= 1);
    setDone('step-reviewed', appRank >= 2);
    setDone('step-accepted', appRank >= 3);
    setDone('step-work', state.workHistoryCreated);

    setDisabled('apply-btn', !jobApproved || appRank > 0);
    setDisabled('save-job-btn', !jobApproved || state.savedJob);
    setDisabled('remove-saved-job-btn', !state.savedJob);
    setDisabled('cancel-btn', appRank === 0 || appRank >= 3);
    setDisabled('submit-verification-btn', verificationPending || isVerified);
    setDisabled('approve-verification-btn', !verificationPending || isVerified);
    setDisabled('create-job-btn', !isVerified || state.jobStatus !== 'draft');
    setDisabled('update-job-btn', !isVerified || !['created', 'pending', 'approved'].includes(state.jobStatus));
    setDisabled('delete-job-btn', !isVerified || state.jobStatus === 'draft' || appRank > 0);
    setDisabled('submit-job-btn', !isVerified || jobPending || jobApproved || state.jobStatus === 'draft');
    setDisabled('approve-job-btn', !jobPending || jobApproved);
    setDisabled('review-applicant-btn', appRank < 1 || appRank >= 2);
    setDisabled('accept-applicant-btn', appRank < 2 || appRank >= 3);
    setDisabled('complete-work-btn', appRank < 3 || state.workHistoryCreated);
    setDisabled('generate-resume-btn', !state.workHistoryCreated);

    const applyBtn = document.getElementById('apply-btn');
    if (applyBtn) applyBtn.textContent = appRank > 0 ? 'Applied' : 'Apply';

    const saveJobBtn = document.getElementById('save-job-btn');
    if (saveJobBtn) saveJobBtn.textContent = state.savedJob ? 'Saved' : 'Save Job';
  }

  // Helper function for language text used by this script.
  function languageText(language) {
    const readableLabels = {
      en: 'Language demo: English interface selected.',
      ms: 'Demo bahasa: Antara muka Bahasa Melayu dipilih.',
      zh: '\u8bed\u8a00\u793a\u8303\uff1a\u5df2\u9009\u62e9\u4e2d\u6587\u754c\u9762\u3002',
      ta: '\u0bae\u0bca\u0bb4\u0bbf \u0bae\u0bbe\u0ba4\u0bbf\u0bb0\u0bbf: \u0ba4\u0bae\u0bbf\u0bb4\u0bcd \u0b87\u0b9f\u0bc8\u0bae\u0bc1\u0b95\u0bae\u0bcd \u0ba4\u0bc7\u0bb0\u0bcd\u0bb5\u0bc1 \u0b9a\u0bc6\u0baf\u0bcd\u0baf\u0baa\u0bcd\u0baa\u0b9f\u0bcd\u0b9f\u0ba4\u0bc1.'
    };
    return readableLabels[language] || readableLabels.en;

    const labels = {
      en: 'Language demo: English interface selected.',
      ms: 'Demo bahasa: Antara muka Bahasa Melayu dipilih.',
      zh: '语言示范：已选择中文界面。',
      ta: 'மொழி மாதிரி: தமிழ் இடைமுகம் தேர்வு செய்யப்பட்டது.'
    };
    return labels[language] || labels.en;
  }

  // Formats or checks application status so later code can use a clean value.
  function formatApplicationStatus(status) {
    const labels = {
      not_applied: 'Not Applied',
      pending: 'Pending',
      reviewed: 'Reviewed',
      accepted: 'Accepted',
      completed: 'Completed'
    };
    return labels[status] || 'Not Applied';
  }

  document.querySelectorAll('.nav-btn, .go-page').forEach((button) => {
    // Connects this element event to the handler that should run next.
    button.addEventListener('click', () => showPage(button.dataset.page));
  });

  document.querySelectorAll('.sub-btn').forEach((button) => {
    // Connects this element event to the handler that should run next.
    button.addEventListener('click', () => showPanel(button.dataset.panel));
  });

  document.getElementById('register-demo-btn')?.addEventListener('click', () => {
    const name = document.getElementById('register-name')?.value.trim() || 'Demo User';
    const email = document.getElementById('register-email')?.value.trim().toLowerCase();
    const password = document.getElementById('register-password')?.value || '';
    const role = document.getElementById('register-role')?.value || 'jobseeker';

    if (!email || !password) {
      renderSession('Please enter email and password.');
      return;
    }

    const users = loadUsers();
    const existingIndex = users.findIndex((user) => user.email === email);
    const user = { name, email, password, role };

    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }

    saveUsers(users);
    saveSession(null);
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    if (loginEmail) loginEmail.value = email;
    if (loginPassword) loginPassword.value = password;
    renderSession(`Sign up complete. Now login as ${formatRole(role)} to continue.`);
    showPage('auth');
  });

  document.getElementById('login-demo-btn')?.addEventListener('click', () => {
    const email = document.getElementById('login-email')?.value.trim().toLowerCase();
    const password = document.getElementById('login-password')?.value || '';
    const user = loadUsers().find((item) => item.email === email && item.password === password);

    if (!user) {
      renderSession('Login failed. Sign up the demo account first or check password.');
      return;
    }

    saveSession({ name: user.name, email: user.email, role: user.role });
    renderSession(`Logged in as ${formatRole(user.role)}.`);
    showPage(pageForRole(user.role));
  });

  document.getElementById('logout-demo-btn')?.addEventListener('click', () => {
    saveSession(null);
    renderSession('Logged out.');
    showPage('home');
  });

  document.getElementById('submit-verification-btn')?.addEventListener('click', () => {
    saveState({ verificationStatus: 'pending' });
    showPage('admin');
    showPanel('admin-verification');
  });

  document.getElementById('approve-verification-btn')?.addEventListener('click', () => {
    saveState({ verificationStatus: 'approved' });
    showPage('employer');
    showPanel('employer-post');
  });

  document.getElementById('save-profile-btn')?.addEventListener('click', () => {
    saveState({
      profileSaved: true,
      seekerProfile: {
        headline: value('profile-headline-input') || defaultState.seekerProfile.headline,
        skills: value('profile-skills-input') || defaultState.seekerProfile.skills,
        availability: value('profile-availability-input') || defaultState.seekerProfile.availability
      }
    });
  });

  document.getElementById('submit-job-btn')?.addEventListener('click', () => {
    saveState({ jobStatus: 'pending' });
    showPage('admin');
    showPanel('admin-jobs');
  });

  document.getElementById('create-job-btn')?.addEventListener('click', () => {
    saveState({
      jobStatus: 'created',
      job: {
        title: value('job-title-input') || defaultState.job.title,
        category: value('job-category-input') || defaultState.job.category,
        pay: value('job-pay-input') || defaultState.job.pay,
        description: value('job-description-input') || defaultState.job.description
      }
    });
  });

  document.getElementById('update-job-btn')?.addEventListener('click', () => {
    saveState({
      job: {
        title: value('job-title-input') || defaultState.job.title,
        category: value('job-category-input') || defaultState.job.category,
        pay: value('job-pay-input') || defaultState.job.pay,
        description: value('job-description-input') || defaultState.job.description
      }
    });
  });

  document.getElementById('delete-job-btn')?.addEventListener('click', () => {
    saveState({
      jobStatus: 'draft',
      savedJob: false,
      job: { ...defaultState.job }
    });
  });

  document.getElementById('approve-job-btn')?.addEventListener('click', () => {
    saveState({ jobStatus: 'approved' });
    showPage('jobseeker');
    showPanel('seeker-jobs');
  });

  document.getElementById('apply-btn')?.addEventListener('click', () => {
    if (state.jobStatus !== 'approved') return;
    saveState({ applicationStatus: 'pending' });
    showPanel('seeker-applications');
  });

  document.getElementById('save-job-btn')?.addEventListener('click', () => {
    if (state.jobStatus !== 'approved') return;
    saveState({ savedJob: true });
    showPanel('seeker-saved');
  });

  document.getElementById('remove-saved-job-btn')?.addEventListener('click', () => {
    saveState({ savedJob: false });
  });

  document.getElementById('cancel-btn')?.addEventListener('click', () => {
    saveState({ applicationStatus: 'not_applied', workHistoryCreated: false });
  });

  document.getElementById('review-applicant-btn')?.addEventListener('click', () => {
    saveState({ applicationStatus: 'reviewed' });
  });

  document.getElementById('accept-applicant-btn')?.addEventListener('click', () => {
    saveState({ applicationStatus: 'accepted' });
    showPage('jobseeker');
    showPanel('seeker-applications');
  });

  document.getElementById('complete-work-btn')?.addEventListener('click', () => {
    saveState({ applicationStatus: 'completed', workHistoryCreated: true });
    showPage('jobseeker');
    showPanel('seeker-work-history');
  });

  document.getElementById('generate-resume-btn')?.addEventListener('click', () => {
    saveState({ resumeGenerated: true });
  });

  document.getElementById('language-demo')?.addEventListener('change', (event) => {
    saveState({ language: event.target.value });
  });

  document.getElementById('reset-demo-btn')?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(SESSION_KEY);
    state = { ...defaultState };
    session = null;
    renderState();
    renderSession('Demo data reset.');
    showPage('home');
  });

  renderState();
  setValue('language-demo', state.language);
  renderSession();
})();

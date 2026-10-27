/**
 * EasyEarn file note: Handles the auth page behavior and related user interactions.
 */
import { supabase } from './supabase-config.js';
import { fetchAccountAccess, isAccountLocked, signOutLockedAccount } from './account-access.js';

const EMPLOYER_CODE = 'EASYEARN-EMPLOYER-2026';
const PROFILE_TABLE = 'users';

let selectedRole = 'seeker';

async function awaitLoginStep(operation, step, timeoutMs = 20000) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(step + ' timed out. Refresh this page before trying again.');
        error.code = 'LOGIN_STEP_TIMEOUT';
        reject(error);
      }, timeoutMs);
    })]);
  } finally {
    clearTimeout(timer);
  }
}



// Shows the error message or section when the user needs feedback.
function showError(msg) {
  const el = document.getElementById('error-msg');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

// Formats or checks valid email so later code can use a clean value.
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim());
}

// Sets up password toggles when this script is loaded.
function setupPasswordToggles() {
  const SHOW_EMOJI = String.fromCodePoint(0x1f440);
  const HIDE_EMOJI = String.fromCodePoint(0x1f648);

  document.querySelectorAll('.password-toggle').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.textContent = SHOW_EMOJI;

    // Connects this element event to the handler that should run next.
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-toggle-target');
      const input = targetId ? document.getElementById(targetId) : null;
      if (!input) return;

      const shouldShow = input.type === 'password';
      input.type = shouldShow ? 'text' : 'password';
      button.textContent = shouldShow ? HIDE_EMOJI : SHOW_EMOJI;
      button.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
    });
  });
}

// Clears or removes error from the UI or database.
function clearError() {
  const el = document.getElementById('error-msg');
  if (el) {
    el.textContent = '';
    el.style.display = 'none';
  }
}

// Formats or checks role so later code can use a clean value.
function normalizeRole(role) {
  if (!role) return 'seeker';
  return role === 'jobseeker' ? 'seeker' : role;
}

// Formats or checks Supabase auth error so later code can use a clean value.
function mapSupabaseAuthError(error, context = 'login') {
  const message = String(error?.message || '').toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }

  if (message.includes('email not confirmed')) {
    return 'Your email is not confirmed yet. Please check your inbox.';
  }

  if (message.includes('user already registered')) {
    return 'This email is already registered. Please login instead.';
  }

  if (message.includes('password should be at least')) {
    return 'Password must be at least 6 characters.';
  }

  if (context === 'register') {
    return 'Registration failed. Please try again.';
  }

  return 'Login failed. Please try again.';
}

// Creates or updates profile so the database stays in sync.
async function upsertProfile(user, overrides = {}) {
  if (!user?.id) return null;

  const role = normalizeRole(
    overrides.role ||
    user.user_metadata?.role ||
    selectedRole ||
    'seeker'
  );

  const payload = {
    id: user.id,
    email: user.email || '',
    full_name:
      overrides.name ||
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      'EasyEarn User',
    role,
    updated_at: new Date().toISOString()
  };

  if (overrides.created_at) {
    payload.created_at = overrides.created_at;
  }

  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (error) {
    console.warn('Profile upsert failed:', error);
    return null;
  }

  return data;
}

// Loads role for user data so the page can display current information.
async function getRoleForUser(user) {
  if (!user?.id) return 'seeker';

  try {
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && data?.role) {
      return normalizeRole(data.role);
    }
  } catch (lookupError) {
    console.warn('Role lookup skipped:', lookupError);
  }

  return normalizeRole(user.user_metadata?.role || 'seeker');
}

// Runs the by role step for this page workflow.
async function redirectByRole(user, verifiedRole) {
  const role = verifiedRole ? normalizeRole(verifiedRole) : await getRoleForUser(user);

  let url = 'pages/jobseeker/dashboard.html';
  if (role === 'employer') url = 'pages/employer/dashboard.html';
  if (role === 'admin') url = 'pages/admin/dashboard.html';

  // Show the welcome loading overlay (login.html) before redirecting, if present
  if (typeof window.showWelcomeOverlay === 'function') {
    window.showWelcomeOverlay(url);
  } else {
    window.location.href = url;
  }
}

// Handles the login action triggered by the user.
async function handleLogin() {
  clearError();
  // support both combined page (login-email) and old standalone (email)
  const email = (document.getElementById('login-email') || document.getElementById('email'))?.value.trim();
  // Helper function for password used by this script.
  const password = (document.getElementById('login-password') || document.getElementById('password'))?.value.trim();

  if (!email || !password) {
    showError('Please enter your email and password.');
    return;
  }

  if (!isValidEmail(email)) {
    showError('Please enter a valid email address.');
    return;
  }

  const { data, error } = await awaitLoginStep(supabase.auth.signInWithPassword({
    email,
    password
  }), 'Sign-in request');

  if (error) {
    console.error('Email login failed:', error);
    showError(mapSupabaseAuthError(error, 'login'));
    return;
  }

  try {
    const account = await awaitLoginStep(fetchAccountAccess(data.user.id), 'Account access check');
    if (isAccountLocked(account.account_status)) {
      showError('Your account has been locked by the administrator. Please contact support.');
      await awaitLoginStep(signOutLockedAccount(), 'Locked account sign-out');
      return;
    }
    await redirectByRole(data.user, account.role);
  } catch (error) {
    console.error('Account access check failed:', error);
    if (error.code === 'LOGIN_STEP_TIMEOUT') throw error;
    showError('Unable to verify account access. Please try again.');
  }
}

// Handles the register action triggered by the user.
async function handleRegister() {
  clearError();
  const privacyConsent = document.getElementById('register-privacy-consent');
  if (!privacyConsent?.checked) {
    showError('Please agree to the data use notice, Privacy Policy and Terms of Service before creating an account.');
    privacyConsent?.focus();
    return;
  }

  const name = document.getElementById('name')?.value.trim();
  const email = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value.trim();
  const confirmPassword = document.getElementById('confirm-password')?.value.trim();
  const adminCode = document.getElementById('admin-code')?.value.trim() || '';
  const employerCode = document.getElementById('employer-code')?.value.trim() || '';

  if (!name || !email || !password) {
    showError('Please fill in all fields.');
    return;
  }

  if (name.length < 2) {
    showError('Full name must be at least 2 characters.');
    return;
  }

  if (!isValidEmail(email)) {
    showError('Please enter a valid email address.');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters.');
    return;
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    showError('Password must contain at least one letter and one number.');
    return;
  }

  if (!/[!@#$%^]/.test(password)) {
    showError('Password must contain at least one of !@#$%^.');
    return;
  }

  if (confirmPassword !== password) {
    showError('Confirm password does not match.');
    return;
  }

  if (selectedRole === 'admin' && !adminCode) {
    showError('Please enter the Admin Secure Code.');
    return;
  }

  if (selectedRole === 'employer' && employerCode !== EMPLOYER_CODE) {
    showError('Invalid employer secure code.');
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        full_name: name,
        role: selectedRole
      }
    }
  });

  if (error) {
    console.error('Registration failed:', error);
    showError(mapSupabaseAuthError(error, 'register'));
    return;
  }

  if (data.user && selectedRole === 'admin') {
    const { error: promotionError } = await supabase.functions.invoke('promote-admin', {
      body: { userId: data.user.id, adminCode }
    });
    if (promotionError) {
      console.error('Admin authorization failed:', promotionError);
      let authorizationDetail = promotionError.message || '';
      try {
        const response = promotionError.context;
        if (response && typeof response.clone === 'function') {
          const responseText = await response.clone().text();
          let responseBody = null;
          try { responseBody = JSON.parse(responseText); } catch (_) { /* Keep plain text responses too. */ }
          authorizationDetail = responseBody?.error
            || responseBody?.message
            || responseText
            || authorizationDetail;
          if (response.status) authorizationDetail = `HTTP ${response.status}: ${authorizationDetail}`;
        } else if (response?.message) {
          authorizationDetail = response.message;
        }
      } catch (_) {
        // Keep the function client's message when no JSON response is available.
      }
      if (authorizationDetail.includes('Invalid Admin Secure Code')) {
        showError('Account created, but Admin authorization failed: the entered Admin Secure Code does not match the ADMIN_REGISTRATION_CODE secret. This email is already registered, so do not register again. Check the secret value, then authorize this existing account.');
      } else {
        const detailText = authorizationDetail ? ` (${authorizationDetail})` : '';
        showError(`Account created, but Admin authorization failed${detailText}. This email is already registered. Fix the reported function issue, then authorize this existing account; do not register again.`);
      }
      return;
    }
  } else if (data.user) {
    await upsertProfile(data.user, {
      name,
      role: selectedRole,
      created_at: new Date().toISOString()
    });
  }

  if (!data.session) {
    showError('Account created. Please check your email to confirm your account before logging in.');
    return;
  }

  if (selectedRole === 'admin') {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn('Admin session refresh failed:', refreshError);
      showError('Admin account created. Please log in again to activate the Admin role.');
      return;
    }
  }

  await redirectByRole(data.user, selectedRole);
}

window.selectRole = function selectRole(role) {
  const requestedRole = normalizeRole(role);
  selectedRole = ['seeker', 'employer', 'admin'].includes(requestedRole) ? requestedRole : 'seeker';
  document.querySelectorAll('.role-card').forEach((card) => card.classList.remove('selected'));
  document.getElementById(`role-${selectedRole}`)?.classList.add('selected');

  const adminGroup = document.getElementById('admin-code-group');
  const employerGroup = document.getElementById('employer-code-group');

  if (employerGroup) {
    employerGroup.classList.toggle('active', selectedRole === 'employer');
  }
  if (adminGroup) {
    adminGroup.classList.toggle('active', selectedRole === 'admin');
  }
};

const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
  // Connects this element event to the handler that should run next.
  loginBtn.addEventListener('click', async () => {
    if (loginBtn.disabled) return;
    const originalText = loginBtn.textContent;
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    let timedOut = false;
    try {
      await handleLogin();
    } catch (error) {
      console.error('Login request failed:', error);
      timedOut = error.code === 'LOGIN_STEP_TIMEOUT';
      showError(timedOut ? error.message : mapSupabaseAuthError(error, 'login'));
    } finally {
      // Do not overlap a retry with an SDK operation still pending after timeout.
      loginBtn.disabled = timedOut;
      loginBtn.textContent = timedOut ? 'Refresh to retry' : originalText;
    }
  });
}

const registerBtn = document.getElementById('register-btn');
if (registerBtn) {
  // Connects this element event to the handler that should run next.
  registerBtn.addEventListener('click', handleRegister);
}

setupPasswordToggles();

if (new URLSearchParams(window.location.search).get('reason') === 'account_locked') {
  showError('Your account has been locked by the administrator. Please contact support.');
}

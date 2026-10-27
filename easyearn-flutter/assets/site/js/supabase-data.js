/**
 * EasyEarn file note: Handles the supabase data page behavior and related user interactions.
 */
import { supabase } from './supabase-config.js';

export const TABLES = {
  profiles: 'users',
  publicProfiles: 'public_profiles',
  resumes: 'users',
  workHistory: 'work_history',
  applications: 'applications',
  jobs: 'job_listings',
  // Legacy/planned admin table names kept for compatibility. The current FYP
  // employer verification flow stores requests on the users table instead, so
  // missing-table errors are handled gracefully by the related helpers below.
  jobModeration: 'job_moderation',
  reports: 'reports',
  reportReviews: 'report_reviews',
  savedJobs: 'saved_jobs',
  chatbotKnowledge: 'chatbot_knowledge',
  chatbotLogs: 'chatbot_logs',
  notifications: 'notifications',
  ratings: 'ratings',
  payments: 'payments',
  analytics: 'analytics',
  verificationRequests: 'verification_requests'
};

// Formats or checks missing optional table error so later code can use a clean value.
function isMissingOptionalTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01' || message.includes('could not find the table') || message.includes('does not exist');
}

// Formats or checks array so later code can use a clean value.
export function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

// Formats or checks role value so later code can use a clean value.
function normalizeRoleValue(role) {
  const value = String(role || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (['job seeker', 'jobseeker', 'seeker'].includes(value)) return 'seeker';
  if (value === 'employer') return 'employer';
  if (['admin', 'administrator'].includes(value)) return 'admin';
  return value || 'seeker';
}

// Loads initials data so the page can display current information.
export function getInitials(name, fallback = 'EE') {
  const initials = String(name || fallback)
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return initials || fallback;
}

// Loads current user data so the page can display current information.
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user || null;
}

// Loads current session data so the page can display current information.
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

// Helper function for sign out user used by this script.
// Versioned imports can instantiate this module more than once. Keep logout
// intent shared within this document so every auth observer chooses one route.
const signOutStateKey = Symbol.for('easyearn.signOutState');
const signOutState = window[signOutStateKey] || (window[signOutStateKey] = { voluntary: false });
function showLogoutPage() {
  window.location.href = new URL('../logout.html', import.meta.url).href;
}

export async function signOutUser() {
  signOutState.voluntary = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    showLogoutPage();
  } catch (error) {
    signOutState.voluntary = false;
    throw error;
  }
}

// Runs the user step for this page workflow.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    // Resolve login.html relative to the site root regardless of how deeply
    // nested the calling page is (e.g. pages/admin/ vs root-level pages).
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    const prefix = depth > 1 ? '../'.repeat(depth - 1) : '';
    window.location.href = `${prefix}login.html`;
    return null;
  }
  return user;
}

// Runs the auth step for this page workflow.
export function observeAuth(callback) {
  let active = true;
  let pendingNotification = null;

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (!active) return;
    // INITIAL_SESSION runs after Supabase restores persisted authentication.
    // Do not race it with getUser(), or turn network/page errors into logout.
    if (!session?.user && event !== 'INITIAL_SESSION' && event !== 'SIGNED_OUT') return;
    clearTimeout(pendingNotification);
    // Page callbacks may query Supabase. Run them outside the auth event lock.
    pendingNotification = setTimeout(() => {
      if (!active) return;
      if (!session?.user && signOutState.voluntary) {
        // signOutUser owns navigation after the sign-out request succeeds.
        return;
      }
      Promise.resolve()
        .then(() => callback(session?.user || null))
        .catch((error) => console.error('Auth observer callback failed:', error));
    }, 0);
  });

  return () => {
    active = false;
    clearTimeout(pendingNotification);
    subscription?.unsubscribe();
  };
}

// Formats or checks profile row so later code can use a clean value.
export function normalizeProfileRow(row = {}, user = null) {
  const trustedRole = user?.app_metadata?.role === 'admin' ? 'admin' : '';
  const role = normalizeRoleValue(trustedRole || row.role || user?.user_metadata?.role || 'seeker');
  const isEmployer = role === 'employer';

  return {
    id: row.id || row.user_id || user?.id || '',
    name:
      row.name ||
      row.full_name ||
      row.company_name ||
      row.business_name ||
      user?.user_metadata?.name ||
      user?.user_metadata?.full_name ||
      user?.email?.split('@')[0] ||
      '',
    email: row.email || user?.email || '',
    role,
    phone: row.phone || '',
    location: row.location || '',
    headline: row.headline || '',
    bio: row.bio || row.company_overview || '',
    photoData: row.profile_pic || row.photo_data || row.photoData || '',
    photoUrl: row.profile_pic || row.photo_url || row.photoUrl || '',
    skills: normalizeArray(row.skill_tags ?? row.skills),
    preferredCategories: normalizeArray(row.preferred_categories ?? row.preferredCategories),
    experienceYears: row.experience_years ?? row.experienceYears ?? null,
    expectedRate: row.expected_rate || row.expectedRate || '',
    availabilityDays: normalizeArray(row.availability_days ?? row.availabilityDays),
    availabilityTime: row.availability_time || row.availabilityTime || '',
    workMode: row.work_mode || row.workMode || '',
    education: Array.isArray(row.education) ? row.education : [],
    companyName: row.company_name || row.companyName || row.full_name || '',
    businessName: row.business_name || row.businessName || row.full_name || '',
    businessType: row.business_type || row.businessType || '',
    businessCategory: row.business_category || row.businessCategory || row.business_type || row.businessType || '',
    website: row.website || '',
    companyOverview: row.company_overview || row.companyOverview || '',
    isVerified: Boolean(row.is_verified || false),
    ssmNumber: row.ssm_number || row.ssmNumber || '',
    verificationStatus: row.verification_status || row.verificationStatus || (isEmployer ? 'pending' : ''),
    accountStatus: row.account_status || row.accountStatus || 'active',
    verificationNotes: row.verification_notes || row.verificationNotes || '',
    verificationAddress: row.verification_address || row.verificationAddress || '',
    registrationDocName: row.registration_doc_name || row.registrationDocName || '',
    registrationDocData: row.registration_doc_data || row.registrationDocData || '',
    contactDocName: row.contact_doc_name || row.contactDocName || '',
    contactDocData: row.contact_doc_data || row.contactDocData || '',
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

// Loads profile data so the page can display current information.
export async function fetchProfile(userId, user = null) {
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return normalizeProfileRow(data || {}, user);
}

// Loads profiles by IDs data so the page can display current information.
export async function fetchProfilesByIds(userIds = []) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select('*')
    .in('id', ids);

  if (error) throw error;
  return (data || []).map((row) => normalizeProfileRow(row, null));
}

// Loads public profiles by IDs data so the page can display current information.
export async function fetchPublicProfilesByIds(userIds = []) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from(TABLES.publicProfiles)
    .select('*')
    .in('id', ids);

  if (error) throw error;
  return (data || []).map((row) => normalizeProfileRow(row, null));
}

// Loads applicant profiles for employer data so the page can display current information.
export async function fetchApplicantProfilesForEmployer(userIds = []) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!ids.length) return [];

  const { data, error } = await supabase.rpc('get_employer_applicant_profiles', {
    applicant_ids: ids
  });

  if (error) throw error;
  return (data || []).map((row) => normalizeProfileRow(row, null));
}

// Loads all profiles data so the page can display current information.
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select('*')
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data || []).map((row) => normalizeProfileRow(row, null));
}

// Creates or updates profile so the database stays in sync.
export async function upsertProfile(userId, payload) {
  const role = normalizeRoleValue(payload.role || 'seeker');
  const isSeeker = role === 'seeker' || role === 'jobseeker';
  const isEmployer = role === 'employer';
  const row = {
    id: userId,
    email: payload.email || '',
    full_name: payload.full_name || payload.name || '',
    role,
    phone: payload.phone || null,
    location: payload.location || null,
    bio: payload.bio || null,
    headline: payload.headline || null,
    profile_pic: payload.profile_pic || payload.photo_url || payload.photo_data || null,
    website: payload.website || null,
    company_overview: payload.company_overview || payload.companyOverview || null
  };

  if (isSeeker) {
    row.skill_tags = normalizeArray(payload.skill_tags ?? payload.skills);
    row.preferred_categories = normalizeArray(payload.preferred_categories ?? payload.preferredCategories);
    row.experience_years = payload.experience_years ?? payload.experienceYears ?? null;
    row.expected_rate = payload.expected_rate || payload.expectedRate || null;
    row.availability_days = normalizeArray(payload.availability_days ?? payload.availabilityDays);
    row.availability_time = payload.availability_time || payload.availabilityTime || null;
    row.work_mode = payload.work_mode || payload.workMode || null;
    row.education = Array.isArray(payload.education) ? payload.education : [];
  } else {
    row.skill_tags = null;
    row.preferred_categories = null;
    row.experience_years = null;
    row.expected_rate = null;
    row.availability_days = null;
    row.availability_time = null;
    row.work_mode = null;
    row.education = null;
  }

  if (payload.is_verified !== undefined || payload.isVerified !== undefined) {
    row.is_verified = Boolean(payload.is_verified || payload.isVerified);
  }
  if (payload.business_type !== undefined || payload.businessType !== undefined) {
    row.business_type = payload.business_type || payload.businessType || null;
  }
  if (payload.business_category !== undefined || payload.businessCategory !== undefined) {
    row.business_category = payload.business_category || payload.businessCategory || null;
  }
  if (payload.ssm_number !== undefined || payload.ssmNumber !== undefined) {
    row.ssm_number = payload.ssm_number || payload.ssmNumber || null;
  }
  if (payload.verification_status !== undefined || payload.verificationStatus !== undefined) {
    row.verification_status = payload.verification_status || payload.verificationStatus || null;
  } else if (!isEmployer) {
    row.verification_status = null;
  }
  if (payload.verification_notes !== undefined || payload.verificationNotes !== undefined) {
    row.verification_notes = payload.verification_notes || payload.verificationNotes || null;
  }
  if (payload.verification_address !== undefined || payload.verificationAddress !== undefined) {
    row.verification_address = payload.verification_address || payload.verificationAddress || null;
  }
  if (payload.registration_doc_name !== undefined || payload.registrationDocName !== undefined) {
    row.registration_doc_name = payload.registration_doc_name || payload.registrationDocName || null;
  }
  if (payload.registration_doc_data !== undefined || payload.registrationDocData !== undefined) {
    row.registration_doc_data = payload.registration_doc_data || payload.registrationDocData || null;
  }
  if (payload.contact_doc_name !== undefined || payload.contactDocName !== undefined) {
    row.contact_doc_name = payload.contact_doc_name || payload.contactDocName || null;
  }
  if (payload.contact_doc_data !== undefined || payload.contactDocData !== undefined) {
    row.contact_doc_data = payload.contact_doc_data || payload.contactDocData || null;
  }

  if (!isEmployer) {
    row.ssm_number = null;
    row.business_type = null;
    row.verification_notes = null;
    row.verification_address = null;
    row.registration_doc_name = null;
    row.registration_doc_data = null;
    row.contact_doc_name = null;
    row.contact_doc_data = null;
  }

  if (payload.account_status !== undefined || payload.accountStatus !== undefined) {
    row.account_status = payload.account_status || payload.accountStatus || 'active';
  }

  if (payload.created_at) row.created_at = payload.created_at;

  const { data, error } = await supabase
    .from(TABLES.profiles)
    .upsert(row, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Loads resume data so the page can display current information.
export async function fetchResume(userId) {
  return fetchProfile(userId);
}

// Creates or updates resume so the database stays in sync.
export async function upsertResume(userId, payload) {
  return upsertProfile(userId, payload);
}

// Updates user verification after the user changes something or data is refreshed.
export async function setUserVerification(userId, isVerified) {
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .update({ is_verified: Boolean(isVerified) })
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Updates employer verification after the user changes something or data is refreshed.
export async function updateEmployerVerification(userId, payload) {
  const row = {};

  if (payload.ssmNumber !== undefined) row.ssm_number = payload.ssmNumber || null;
  if (payload.businessType !== undefined) row.business_type = payload.businessType || null;
  if (payload.verificationAddress !== undefined) row.verification_address = payload.verificationAddress || null;
  if (payload.verificationStatus !== undefined) row.verification_status = payload.verificationStatus || null;
  if (payload.verificationNotes !== undefined) row.verification_notes = payload.verificationNotes || null;
  if (payload.registrationDocName !== undefined) row.registration_doc_name = payload.registrationDocName || null;
  if (payload.registrationDocData !== undefined) row.registration_doc_data = payload.registrationDocData || null;
  if (payload.contactDocName !== undefined) row.contact_doc_name = payload.contactDocName || null;
  if (payload.contactDocData !== undefined) row.contact_doc_data = payload.contactDocData || null;
  if (payload.isVerified !== undefined) row.is_verified = Boolean(payload.isVerified);
  if (payload.accountStatus !== undefined) row.account_status = payload.accountStatus || null;

  const { data, error } = await supabase
    .from(TABLES.profiles)
    .update(row)
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const authUser = authData?.user || null;
  if (authUser?.id !== userId) {
    throw new Error('Employer profile was not found. Ask the employer to complete their profile first.');
  }

  const fallbackProfile = {
    id: userId,
    email: authUser.email || '',
    full_name:
      authUser.user_metadata?.company_name ||
      authUser.user_metadata?.business_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split('@')[0] ||
      'Employer',
    role: 'employer',
    ...row
  };

  const { data: created, error: createError } = await supabase
    .from(TABLES.profiles)
    .upsert(fallbackProfile, { onConflict: 'id' })
    .select()
    .maybeSingle();

  if (createError) throw createError;
  return created;
}

// Formats or checks work history row so later code can use a clean value.
export function normalizeWorkHistoryRow(row = {}) {
  return {
    id: row.id,
    applicationId: row.application_id || '',
    userId: row.seeker_id || row.user_id || row.userId || row.uid || '',
    jobTitle: row.job_title || row.jobTitle || row.title || 'Completed Job',
    title: row.title || row.job_title || row.jobTitle || 'Completed Job',
    company: row.employer_name || row.company || row.company_name || row.companyName || 'Employer not set',
    category: row.category || '',
    location: row.location || '',
    completedDate: row.end_date || row.completed_date || row.completedDate || '',
    completedOn: row.completed_on || row.completedOn || '',
    period: row.period || ((row.start_date || row.end_date) ? [row.start_date, row.end_date].filter(Boolean).join(' - ') : ''),
    earnings: Number(row.earnings || 0),
    hoursWorked: Number(row.hours_worked || row.total_hours || row.hours || 0),
    rating: row.rating == null ? null : Number(row.rating),
    highlights: normalizeArray(row.highlights),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

// Loads work history data so the page can display current information.
export async function fetchWorkHistory(userId) {
  const { data, error } = await supabase
    .from(TABLES.workHistory)
    .select('*')
    .eq('seeker_id', userId)
    .order('end_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;

  // Helper function for rows used by this script.
  const rows = (data || []).map(normalizeWorkHistoryRow);
  const deduped = [];
  const seenKeys = new Set();

  rows.forEach((row) => {
    const key = row.applicationId || [
      String(row.jobTitle || '').trim().toLowerCase(),
      String(row.company || '').trim().toLowerCase(),
      String(row.completedDate || '').trim()
    ].join('::');

    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    deduped.push(row);
  });

  const unresolved = deduped.filter((row) => row.applicationId &&
    /^(employer|easyearn employer|employer not set)$/i.test(row.company.trim()));
  if (unresolved.length) {
    try {
      const { data: applications, error: applicationError } = await supabase
        .from(TABLES.applications).select('id, job_id')
        .in('id', unresolved.map((row) => row.applicationId));
      if (applicationError) throw applicationError;
      const jobIds = [...new Set((applications || []).map((row) => row.job_id).filter(Boolean))];
      if (jobIds.length) {
        const { data: jobs, error: jobError } = await supabase
          .from(TABLES.jobs).select('id, employer_id').in('id', jobIds);
        if (jobError) throw jobError;
        const namedJobs = await resolveJobEmployerNames(jobs || []);
        const byJob = new Map(namedJobs.map((job) => [job.id, job.company_name]));
        const byApplication = new Map((applications || []).map((row) => [row.id, byJob.get(row.job_id)]));
        unresolved.forEach((row) => { row.company = byApplication.get(row.applicationId) || row.company; });
      }
    } catch (error) {
      console.warn('Work history employer names could not be loaded:', error);
    }
  }
  return deduped;
}

// Date-only fields use the local calendar day, not the UTC day before midnight.
export function localCalendarDate(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function resolveJobEmployerNames(jobs) {
  try {
    const profiles = await fetchPublicProfilesByIds(jobs.map((job) => job.employer_id));
    const names = new Map(profiles.map((profile) => [profile.id, profile.name]));
    return jobs.map((job) => ({ ...job,
      company_name: job.company_name || job.employer_name || names.get(job.employer_id) || ''
    }));
  } catch (error) {
    console.warn('Job employer names could not be loaded:', error);
    return jobs;
  }
}

// Creates work history when the workflow needs a new record or message.
export async function insertWorkHistory(payload) {
  const applicationId = payload.application_id || null;

  if (applicationId) {
    const { data: existing, error: existingError } = await supabase
      .from(TABLES.workHistory)
      .select('id')
      .eq('application_id', applicationId)
      .limit(1);

    if (existingError) throw existingError;
    if ((existing || []).length) {
      const earnings = Number(payload.earnings);
      if (!Number.isFinite(earnings) || earnings <= 0) return existing[0];
      const { data, error } = await supabase
        .from(TABLES.workHistory)
        .update({ earnings })
        .eq('id', existing[0].id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  }

  const row = {
    seeker_id: payload.seeker_id || payload.user_id || payload.userId,
    application_id: applicationId,
    job_title: payload.job_title || payload.jobTitle || payload.title || '',
    employer_name: payload.employer_name || payload.company || payload.employerName || null,
    category: payload.category || null,
    start_date: payload.start_date || null,
    end_date: payload.end_date || payload.completed_date || payload.date_completed || null,
    earnings: payload.earnings || 0,
    created_at: payload.created_at || new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(TABLES.workHistory)
    .insert(row)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Runs the work history earnings from payment step for this page workflow.
export async function syncWorkHistoryEarningsFromPayment(applicationId) {
  // Fetch payment record and update work history earnings to match
  const { data: payment } = await supabase
    .from(TABLES.payments)
    .select('id, amount')
    .eq('application_id', applicationId)
    .maybeSingle();

  let amount = Number(payment?.amount);

  const isLegacyPayRateAmount = await isPaymentAmountSameAsPayRate(applicationId, amount);
  if (!payment || !Number.isFinite(amount) || amount <= 0 || isLegacyPayRateAmount) {
    return { syncSkipped: true, reason: 'Payment amount is empty.' };
  }

  const { data, error } = await supabase
    .from(TABLES.workHistory)
    .update({ earnings: amount })
    .eq('application_id', applicationId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Formats or checks payment amount same as pay rate so later code can use a clean value.
async function isPaymentAmountSameAsPayRate(applicationId, amount) {
  if (!applicationId || !Number.isFinite(amount) || amount <= 0) return false;

  const { data: application, error: applicationError } = await supabase
    .from(TABLES.applications)
    .select('job_id')
    .eq('id', applicationId)
    .maybeSingle();

  if (applicationError || !application?.job_id) return false;

  const { data: job, error: jobError } = await supabase
    .from(TABLES.jobs)
    .select('pay_rate')
    .eq('id', application.job_id)
    .maybeSingle();

  if (jobError) return false;

  const payRate = Number(job?.pay_rate || 0);
  return Number.isFinite(payRate) && payRate > 0 && Math.abs(amount - payRate) < 0.01;
}

// Loads applications data so the page can display current information.
export async function fetchApplications(userId) {
  const { data, error } = await supabase
    .from(TABLES.applications)
    .select('*')
    .eq('seeker_id', userId)
    .is('deleted_at', null);

  if (error) throw error;
  return data || [];
}

// Loads applications with interview data so the page can display current information.
export async function fetchApplicationsWithInterview(userId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('seeker_id', userId)
    .is('deleted_at', null)
    .not('interview_date', 'is', null)
    .order('interview_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Creates application when the workflow needs a new record or message.
export async function createApplication(payload) {
  const row = {
    job_id: payload.job_id,
    seeker_id: payload.seeker_id || payload.user_id,
    status: payload.status || 'pending',
    applied_at: payload.applied_at || new Date().toISOString(),
    resume_url: payload.resume_url || null
  };

  const { data, error } = await supabase
    .from(TABLES.applications)
    .insert(row)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Updates application status after the user changes something or data is refreshed.
export async function updateApplicationStatus(applicationId, status) {
  const { error } = await supabase
    .from(TABLES.applications)
    .update({ status })
    .eq('id', applicationId);

  if (error) throw error;
  return { id: applicationId, status };
}

// Clears or removes application from the UI or database.
export async function deleteApplication(applicationId, seekerId) {
  let query = supabase
    .from(TABLES.applications)
    .delete()
    .eq('id', applicationId);

  if (seekerId) query = query.eq('seeker_id', seekerId);

  const { error } = await query;
  if (error) throw error;
  return { id: applicationId };
}

// Updates interview schedule after the user changes something or data is refreshed.
export async function updateInterviewSchedule(applicationId, payload) {
  const { error } = await supabase
    .from('applications')
    .update({
      interview_date:     payload.interview_date     || null,
      interview_notes:    payload.interview_notes    || null,
      interview_location: payload.interview_location || null,
      attendance_confirmed_at: null
    })
    .eq('id', applicationId);

  if (error) throw error;
  return { id: applicationId, ...payload };
}

// Runs the interview attendance step for this page workflow.
export async function confirmInterviewAttendance(applicationId) {
  const confirmedAt = new Date().toISOString();

  const { error } = await supabase
    .from('applications')
    .update({
      attendance_confirmed_at: confirmedAt
    })
    .eq('id', applicationId);

  if (error) throw error;
  return { id: applicationId, attendance_confirmed_at: confirmedAt };
}

// Loads employer applications data so the page can display current information.
export async function fetchEmployerApplications(employerId) {
  const jobs = await fetchEmployerJobs(employerId);
  // Helper function for job IDs used by this script.
  const jobIds = (jobs || []).map((job) => job.id).filter(Boolean);

  if (!jobIds.length) return [];

  const { data, error } = await supabase
    .from(TABLES.applications)
    .select('*')
    .in('job_id', jobIds)
    .order('applied_at', { ascending: false, nullsFirst: false });

  if (error) throw error;

  const jobsById = new Map((jobs || []).map((job) => [job.id, job]));
  const applications = data || [];
  const seekerIds = applications.map((row) => row.seeker_id).filter(Boolean);

  let applicantsById = new Map();
  try {
    const applicants = await fetchApplicantProfilesForEmployer(seekerIds);
    applicantsById = new Map(applicants.map((profile) => [profile.id, profile]));
  } catch (profileError) {
    console.error('Failed to load applicant profiles for employer view:', profileError);
  }

  return applications.map((row) => ({
    ...row,
    _job: jobsById.get(row.job_id) || null,
    _applicant: applicantsById.get(row.seeker_id) || null
  }));
}

// Loads jobs data so the page can display current information.
export async function fetchJobs() {
  const { data, error } = await supabase
    .from(TABLES.jobs)
    .select('*');

  if (error) throw error;
  return resolveJobEmployerNames(data || []);
}

// Loads reports data so the page can display current information.
export async function fetchReports() {
  const { data, error } = await supabase
    .from(TABLES.reports)
    .select('*')
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Loads report reviews data so the page can display current information.
export async function fetchReportReviews() {
  const { data, error } = await supabase
    .from(TABLES.reportReviews)
    .select('*')
    .order('updated_at', { ascending: false, nullsFirst: false });

  if (isMissingOptionalTableError(error)) return [];
  if (error) throw error;
  return data || [];
}

// Loads job moderation data so the page can display current information.
export async function fetchJobModeration() {
  const { data, error } = await supabase
    .from(TABLES.jobModeration)
    .select('*')
    .order('updated_at', { ascending: false, nullsFirst: false });

  if (isMissingOptionalTableError(error)) return [];
  if (error) throw error;
  return data || [];
}

// Loads verification requests data so the page can display current information.
export async function fetchVerificationRequests() {
  const { data, error } = await supabase
    .from(TABLES.verificationRequests)
    .select('*')
    .order('updated_at', { ascending: false, nullsFirst: false });

  if (isMissingOptionalTableError(error)) return [];
  if (error) throw error;
  return data || [];
}

// Creates report when the workflow needs a new record or message.
export async function createReport(payload) {
  const session = await getCurrentSession();
  if (!session?.user) {
    throw new Error('Please sign in before submitting a report. Your report details have been kept.');
  }
  const user = await getCurrentUser();
  if (!user) throw new Error('Your session has expired. Please sign in again.');
  const row = {
    reporter_id: user.id,
    reported_user: payload.reported_user || null,
    report_type: payload.report_type || 'other',
    description: payload.description || '',
    status: payload.status || 'open',
    admin_notes: payload.admin_notes || null
  };

  if (payload.evidence) row.evidence = payload.evidence;

  if (payload.job_id) row.job_id = payload.job_id;

  const { data, error } = await supabase
    .from(TABLES.reports)
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

// Updates report after the user changes something or data is refreshed.
export async function updateReport(reportId, payload) {
  const row = {};
  if (payload.status !== undefined) row.status = payload.status;
  if (payload.admin_notes !== undefined) row.admin_notes = payload.admin_notes;

  const { data, error } = await supabase
    .from(TABLES.reports)
    .update(row)
    .eq('id', reportId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Report update did not persist. Check the Supabase reports update policy or the report id.');
  }
  return data;
}

// Loads employer jobs data so the page can display current information.
export async function fetchJobApplicantCounts(jobIds = []) {
  const entries = await Promise.all([...new Set(jobIds.filter(Boolean))].map(async (jobId) => {
    const { count, error } = await supabase
      .from(TABLES.applications)
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .is('deleted_at', null);
    if (error) throw error;
    return [jobId, count ?? 0];
  }));
  return Object.fromEntries(entries);
}

export async function fetchEmployerJobs(employerId) {
  const { data, error } = await supabase
    .from(TABLES.jobs)
    .select('*')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Loads job listing data so the page can display current information.
export async function fetchJobListing(jobId) {
  const { data, error } = await supabase
    .from(TABLES.jobs)
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? (await resolveJobEmployerNames([data]))[0] : null;
}

// Creates job listing when the workflow needs a new record or message.
export async function createJobListing(payload) {
  const row = {
    employer_id: payload.employer_id,
    title: payload.title || '',
    description: payload.description || null,
    category: payload.category || null,
    location: payload.location || '',
    job_type: payload.job_type || 'part-time',
    pay_rate: payload.pay_rate ?? null,
    pay_type: payload.pay_type || 'hourly',
    openings_count: Number.isFinite(Number(payload.openings_count)) ? Number(payload.openings_count) : 1,
    skill_tags: normalizeArray(payload.skill_tags),
    expiry_date: payload.expiry_date || null,
    status: payload.status || 'pending',
    created_at: payload.created_at || new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(TABLES.jobs)
    .insert(row)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Updates job listing after the user changes something or data is refreshed.
export async function updateJobListing(jobId, payload) {
  const row = {
    title: payload.title || '',
    description: payload.description || null,
    category: payload.category || null,
    location: payload.location || '',
    job_type: payload.job_type || 'part-time',
    pay_rate: payload.pay_rate ?? null,
    pay_type: payload.pay_type || 'hourly',
    openings_count: Number.isFinite(Number(payload.openings_count)) ? Number(payload.openings_count) : 1,
    skill_tags: normalizeArray(payload.skill_tags),
    expiry_date: payload.expiry_date || null
  };

  // Editing content must not implicitly submit a draft or change moderation status.
  if (payload.status !== undefined) row.status = payload.status;

  const { data, error } = await supabase
    .from(TABLES.jobs)
    .update(row)
    .eq('id', jobId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Updates job listing status after the user changes something or data is refreshed.
export async function updateJobListingStatus(jobId, status) {
  const { data, error } = await supabase
    .from(TABLES.jobs)
    .update({ status })
    .eq('id', jobId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Updates user account status after the user changes something or data is refreshed.
export async function updateUserAccountStatus(userId, accountStatus) {
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .update({ account_status: accountStatus })
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return normalizeProfileRow(data || {}, null);
}

// Updates employer jobs status after the user changes something or data is refreshed.
export async function updateEmployerJobsStatus(employerId, status) {
  const { data, error } = await supabase
    .from(TABLES.jobs)
    .update({ status })
    .eq('employer_id', employerId)
    .select();

  if (error) throw error;
  return data || [];
}

// Loads saved jobs count data so the page can display current information.
export async function fetchSavedJobsCount(userId) {
  const { count, error } = await supabase
    .from(TABLES.savedJobs)
    .select('*', { count: 'exact', head: true })
    .eq('seeker_id', userId);

  if (error) throw error;
  return count || 0;
}

// Loads saved job IDs data so the page can display current information.
export async function fetchSavedJobIds(userId) {
  const { data, error } = await supabase
    .from(TABLES.savedJobs)
    .select('job_id')
    .eq('seeker_id', userId);

  if (error) throw error;
  return (data || []).map((row) => row.job_id).filter(Boolean);
}

// Runs the job step for this page workflow.
export async function saveJob(payload) {
  const row = {
    seeker_id: payload.seeker_id || payload.user_id,
    job_id: payload.job_id,
    saved_at: payload.saved_at || new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(TABLES.savedJobs)
    .insert(row)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Clears or removes saved job from the UI or database.
export async function removeSavedJob(userId, jobId) {
  const { error } = await supabase
    .from(TABLES.savedJobs)
    .delete()
    .eq('seeker_id', userId)
    .eq('job_id', jobId);

  if (error) throw error;
  return true;
}

// Loads knowledge base data so the page can display current information.
export async function fetchKnowledgeBase() {
  const { data, error } = await supabase
    .from(TABLES.chatbotKnowledge)
    .select('*')
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    question: typeof row.question === 'string' ? row.question : '',
    keywords: normalizeArray(row.keywords),
    answer: typeof row.answer === 'string' ? row.answer : '',
    category: typeof row.category === 'string' ? row.category : '',
    usageCount: Number(row.usage_count || 0),
    createdAt: row.created_at || ''
  }));
}

// Runs the knowledge base step for this page workflow.
export async function seedKnowledgeBase(items) {
  const rows = items.map((item) => ({
    question: item.question || normalizeArray(item.keywords)[0] || 'General question',
    keywords: normalizeArray(item.keywords),
    answer: item.answer || '',
    category: item.category || null
  }));

  const { error } = await supabase
    .from(TABLES.chatbotKnowledge)
    .insert(rows);

  if (error) throw error;
}

// Updates knowledge entry after the user changes something or data is refreshed.
export async function updateKnowledgeEntry(entryId, payload) {
  const row = {
    question: payload.question || normalizeArray(payload.keywords)[0] || 'General question',
    keywords: normalizeArray(payload.keywords),
    answer: payload.answer || '',
    category: payload.category || null
  };

  const { data, error } = await supabase
    .from(TABLES.chatbotKnowledge)
    .update(row)
    .eq('id', entryId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Clears or removes knowledge entry from the UI or database.
export async function deleteKnowledgeEntry(entryId) {
  const { error } = await supabase
    .from(TABLES.chatbotKnowledge)
    .delete()
    .eq('id', entryId);

  if (error) throw error;
  return true;
}

// Runs the chatbot interaction step for this page workflow.
export async function logChatbotInteraction(payload = {}) {
  let userId = payload.user_id || null;

  if (!userId) {
    try {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id || null;
    } catch (_error) {
      userId = null;
    }
  }

  const row = {
    user_id: userId,
    question: payload.question || '',
    answer: payload.answer || '',
    matched: Boolean(payload.matched),
    confidence_score: payload.confidence_score ?? null
  };

  const { error } = await supabase
    .from(TABLES.chatbotLogs)
    .insert(row);

  if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
    const { error: singularError } = await supabase
      .from('chatbot_log')
      .insert(row);

    if (singularError) throw singularError;
    return;
  }

  if (error) throw error;
}

// Creates notification when the workflow needs a new record or message.
export async function createNotification(payload) {
  const row = {
    user_id: payload.user_id,
    type: payload.type === 'system' ? 'system' : 'application_update',
    message: payload.message || '',
    is_read: Boolean(payload.is_read || false),
    created_at: payload.created_at || new Date().toISOString(),
    target_table: payload.target_table || null,
    target_id: payload.target_id || null,
    is_admin: Boolean(payload.is_admin || false),
    actor_id: payload.actor_id || null
  };

  const { data, error } = await supabase
    .from(TABLES.notifications)
    .insert(row)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Helper function for notify admins used by this script.
export async function notifyAdmins(payload) {
  const { data: admins, error: adminError } = await supabase
    .from(TABLES.profiles)
    .select('id')
    .eq('role', 'admin');

  if (adminError) throw adminError;

  // Helper function for rows used by this script.
  const rows = (admins || [])
    .map((admin) => admin.id)
    .filter(Boolean)
    .map((adminId) => ({
      user_id: adminId,
      type: 'application_update',
      message: payload.message || '',
      is_read: false,
      created_at: payload.created_at || new Date().toISOString(),
      target_table: payload.target_table || null,
      target_id: payload.target_id || null,
      is_admin: true,
      actor_id: payload.actor_id || null
    }));

  if (!rows.length) return [];

  const { data, error } = await supabase
    .from(TABLES.notifications)
    .insert(rows)
    .select('*');

  if (error) throw error;
  return data || [];
}

// Formats or checks parse json so later code can use a clean value.
function safeParseJson(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

// Formats or checks chat payload so later code can use a clean value.
function normalizeChatPayload(row = {}) {
  const parsed = safeParseJson(row.message);
  if (!parsed || parsed.kind !== 'chat') return null;

  return {
    id: row.id,
    ownerId: row.user_id || '',
    senderId: parsed.sender_id || '',
    senderName: parsed.sender_name || 'EasyEarn User',
    recipientId: parsed.recipient_id || '',
    recipientName: parsed.recipient_name || 'EasyEarn User',
    jobId: parsed.job_id || '',
    jobTitle: parsed.job_title || 'Job conversation',
    body: parsed.body || '',
    imageUrl: parsed.image_url || '',
    messageType: parsed.message_type || 'text',
    threadKey: parsed.thread_key || '',
    createdAt: row.created_at || parsed.created_at || '',
    isRead: Boolean(row.is_read || false)
  };
}

// Formats or checks thread key so later code can use a clean value.
function buildThreadKey(userA, userB, jobId = '') {
  const pair = [String(userA || ''), String(userB || '')].sort();
  return [pair[0], pair[1], String(jobId || '')].join('::');
}

// Creates chat message when the workflow needs a new record or message.
export async function createChatMessage(payload) {
  const threadKey = buildThreadKey(payload.sender_id, payload.recipient_id, payload.job_id);
  const createdAt = payload.created_at || new Date().toISOString();

  const messagePayload = {
    kind: 'chat',
    thread_key: threadKey,
    sender_id: payload.sender_id,
    sender_name: payload.sender_name || 'EasyEarn User',
    recipient_id: payload.recipient_id,
    recipient_name: payload.recipient_name || 'EasyEarn User',
    job_id: payload.job_id || '',
    job_title: payload.job_title || 'Job conversation',
    body: payload.body || '',
    image_url: payload.image_url || '',
    message_type: payload.message_type || 'text',
    created_at: createdAt
  };

  const rows = [
    {
      user_id: payload.sender_id,
      type: 'system',
      message: JSON.stringify(messagePayload),
      is_read: true,
      created_at: createdAt
    },
    {
      user_id: payload.recipient_id,
      type: 'system',
      message: JSON.stringify(messagePayload),
      is_read: false,
      created_at: createdAt
    }
  ];

  const { error } = await supabase
    .from(TABLES.notifications)
    .insert(rows);

  if (error) throw error;
  return [
    normalizeChatPayload({
      id: '',
      user_id: payload.sender_id,
      message: JSON.stringify(messagePayload),
      is_read: true,
      created_at: createdAt
    })
  ].filter(Boolean);
}

// Loads chat messages data so the page can display current information.
export async function fetchChatMessages(userId, counterpartId = '', jobId = '') {
  const { data, error } = await supabase
    .from(TABLES.notifications)
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'system')
    .order('created_at', { ascending: true, nullsFirst: false });

  if (error) throw error;

  // Helper function for messages used by this script.
  const messages = (data || []).map(normalizeChatPayload).filter(Boolean);

  return messages.filter((item) => {
    const matchesCounterpart = counterpartId
      ? [item.senderId, item.recipientId].includes(counterpartId)
      : true;
    const matchesJob = jobId ? String(item.jobId || '') === String(jobId) : true;
    return matchesCounterpart && matchesJob;
  });
}

// Loads chat threads data so the page can display current information.
export async function fetchChatThreads(userId) {
  const { data, error } = await supabase
    .from(TABLES.notifications)
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'system')
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;

  // Helper function for messages used by this script.
  const messages = (data || []).map(normalizeChatPayload).filter(Boolean);
  const map = new Map();

  messages.forEach((message) => {
    const key = message.threadKey || buildThreadKey(message.senderId, message.recipientId, message.jobId);
    const counterpartId = message.senderId === userId ? message.recipientId : message.senderId;
    const counterpartName = message.senderId === userId ? message.recipientName : message.senderName;

    if (!map.has(key)) {
      map.set(key, {
        threadKey: key,
        counterpartId,
        counterpartName: counterpartName || 'EasyEarn User',
        jobId: message.jobId || '',
        jobTitle: message.jobTitle || 'Job conversation',
        latestBody: message.body || '',
        latestAt: message.createdAt || '',
        unreadCount: message.isRead ? 0 : 1
      });
      return;
    }

    const current = map.get(key);
    current.unreadCount += message.isRead ? 0 : 1;
  });

  return Array.from(map.values());
}

// Runs the chat thread as read step for this page workflow.
export async function markChatThreadAsRead(userId, counterpartId = '', jobId = '', loadedMessages = null) {
  const messages = loadedMessages ?? await fetchChatMessages(userId, counterpartId, jobId);
  const unreadIds = messages.filter((item) => !item.isRead && item.ownerId === userId).map((item) => item.id);
  if (!unreadIds.length) return [];

  const { data, error } = await supabase
    .from(TABLES.notifications)
    .update({ is_read: true })
    .in('id', unreadIds)
    .select('*');

  if (error) throw error;
  return (data || []).map(normalizeChatPayload).filter(Boolean);
}


// ── Notifications ─────────────────────────────────────────────────────────

// Loads notifications data so the page can display current information.
export async function fetchNotifications(userId, { limit = 20 } = {}) {
  // Fetch regular notifications AND unread chat messages in parallel
  const [notifRes, chatRes] = await Promise.all([
    supabase
      .from(TABLES.notifications)
      .select('*')
      .eq('user_id', userId)
      .neq('type', 'system')
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(limit),
    supabase
      .from(TABLES.notifications)
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'system')
      .eq('is_read', false)
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(100)
  ]);

  if (notifRes.error) throw notifRes.error;
  if (chatRes.error) throw chatRes.error;

  // Deduplicate: keep only the latest unread message per thread
  const threadMap = new Map();
  for (const row of (chatRes.data || [])) {
    const parsed = safeParseJson(row.message);
    if (!parsed || parsed.kind !== 'chat') continue;
    if ((parsed.sender_id || '') === userId) continue; // skip own sent rows
    const key = parsed.thread_key || (parsed.sender_id + '::' + (parsed.job_id || ''));
    if (!threadMap.has(key) || row.created_at > threadMap.get(key).created_at) {
      threadMap.set(key, { ...row, _parsed: parsed });
    }
  }

  const chatNotifs = Array.from(threadMap.values()).map(row => {
    const p = row._parsed;
    const preview = p.body
      ? (p.body.length > 45 ? p.body.slice(0, 45) + '…' : p.body)
      : (p.image_url ? '📷 Sent an image' : '(message)');
    return {
      id: row.id,
      user_id: row.user_id,
      type: 'new_message',
      message: `${p.sender_name || 'Someone'}: ${preview}`,
      is_read: false,
      created_at: row.created_at,
      _chatSenderId: p.sender_id || '',
      _chatSenderName: p.sender_name || 'EasyEarn User',
      _chatJobId: p.job_id || '',
      _chatJobTitle: p.job_title || 'Job conversation'
    };
  });

  // Hide accidental duplicate rows for the same event. Keep separate notices
  // when the same application changes status again later.
  const seenEvents = new Map();
  const dedupedNotifications = [...(notifRes.data || []), ...chatNotifs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .filter((notification) => {
      const eventKey = [
        notification.user_id,
        notification.type,
        notification.target_table || '',
        notification.target_id || '',
        String(notification.message || '').trim()
      ].join('|');
      const createdAt = new Date(notification.created_at).getTime();
      const previousAt = seenEvents.get(eventKey);
      if (previousAt !== undefined && Math.abs(previousAt - createdAt) <= 60_000) return false;
      seenEvents.set(eventKey, createdAt);
      return true;
    });

  return dedupedNotifications.slice(0, limit);
}

// Runs the notification read step for this page workflow.
export async function markNotificationRead(notificationId) {
  const { error } = await supabase
    .from(TABLES.notifications)
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

// Runs the all notifications read step for this page workflow.
export async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from(TABLES.notifications)
    .update({ is_read: true })
    .eq('user_id', userId);

  if (error) throw error;
}

// ── Ratings ───────────────────────────────────────────────────────────────

// Creates or updates rating so the database stays in sync.
export async function upsertRating(payload) {
  const row = {
    reviewer_id:   payload.rater_id || payload.reviewer_id,
    reviewee_id:   payload.ratee_id || payload.reviewee_id,
    application_id: payload.application_id || null,
    stars:          Number(payload.stars) || 5,
    review:         payload.review || null,
    reviewer_role:  payload.rater_role || payload.reviewer_role || 'employer',
    created_at:     new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(TABLES.ratings)
    .upsert(row, { onConflict: 'application_id,reviewer_id' })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Loads ratings data so the page can display current information.
export async function fetchRatings(revieweeId) {
  const { data, error } = await supabase
    .from(TABLES.ratings)
    .select('*')
    .eq('reviewee_id', revieweeId)
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Loads ratings for reviewees data so the page can display current information.
export async function fetchRatingsForReviewees(revieweeIds = []) {
  const ids = Array.from(new Set((revieweeIds || []).filter(Boolean)));
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from(TABLES.ratings)
    .select('*')
    .in('reviewee_id', ids)
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Loads ratings by applications data so the page can display current information.
export async function fetchRatingsByApplications(applicationIds = []) {
  const ids = Array.from(new Set((applicationIds || []).filter(Boolean)));
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from(TABLES.ratings)
    .select('*')
    .in('application_id', ids)
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Loads ratings by reviewer data so the page can display current information.
export async function fetchRatingsByReviewer(reviewerId) {
  const { data, error } = await supabase
    .from(TABLES.ratings)
    .select('*')
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

// Formats or checks average rating so later code can use a clean value.
export function calcAverageRating(ratings = []) {
  if (!ratings.length) return null;
  const sum = ratings.reduce((acc, r) => acc + Number(r.stars || 0), 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

// ── Payments ───────────────────────────────────────────────────────────────

// Creates payment when the workflow needs a new record or message.
export async function createPayment(payload) {
  const { data, error } = await supabase
    .from(TABLES.payments)
    .insert({
      application_id: payload.application_id,
      payer_id: payload.payer_id,
      payee_id: payload.payee_id,
      amount: payload.amount || 0,
      method: payload.method || 'duitnow',
      status: 'pending'
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Runs the employer paid step for this page workflow.
export async function markEmployerPaid(applicationId, seekerId = null, amount = 0) {
  const requestedAmount = Number(amount) || 0;
  // Check if a payment record already exists for this application
  const { data: existing, error: existingError } = await supabase
    .from(TABLES.payments)
    .select('id, amount')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const existingAmount = Number(existing.amount) || 0;
    if (requestedAmount <= 0 && existingAmount <= 0) {
      throw new Error('Final earnings amount is required before confirming payment.');
    }
    // Record exists → stamp employer_paid_at
    const updates = {
      employer_paid_at: new Date().toISOString(),
      amount: requestedAmount > 0 ? requestedAmount : existingAmount
    };

    const { error } = await supabase
      .from(TABLES.payments)
      .update(updates)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    if (requestedAmount <= 0) {
      throw new Error('Final earnings amount is required before confirming payment.');
    }
    // No record yet → insert a new one
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from(TABLES.payments)
      .insert({
        application_id: applicationId,
        payer_id: user?.id ?? null,
        payee_id: seekerId ?? null,
        amount: requestedAmount,
        status: 'pending',
        employer_paid_at: new Date().toISOString()
      });
    if (error) throw error;
  }
}

// Loads payment by application data so the page can display current information.
export async function fetchPaymentByApplication(applicationId) {
  const { data, error } = await supabase
    .from(TABLES.payments)
    .select('*')
    .eq('application_id', applicationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Runs the payment record for application step for this page workflow.
export async function ensurePaymentRecordForApplication(applicationId, payeeId = null) {
  const existing = await fetchPaymentByApplication(applicationId);
  if (existing?.id) return existing;
  throw new Error('No payment record exists yet. Ask the employer to record payment first. For unpaid work, use Report Employer.');
}

// Loads payments by user data so the page can display current information.
export async function fetchPaymentsByUser(userId) {
  const { data, error } = await supabase
    .from(TABLES.payments)
    .select('*')
    .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Runs the payment step for this page workflow.
export async function confirmPayment(paymentId) {
  const { data, error } = await supabase
    .from(TABLES.payments)
    .update({ status: 'confirmed' })
    .eq('id', paymentId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Runs the payment evidence step for this page workflow.
export async function uploadPaymentEvidence(paymentId, evidenceUrl) {
  const { data, error } = await supabase
    .from(TABLES.payments)
    .update({ evidence_url: evidenceUrl })
    .eq('id', paymentId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Runs the payment evidence by application step for this page workflow.
export async function uploadPaymentEvidenceByApplication(applicationId, evidenceUrl, payeeId = null) {
  const payment = await ensurePaymentRecordForApplication(applicationId, payeeId);
  return uploadPaymentEvidence(payment.id, evidenceUrl);
}

// Runs the payment dispute step for this page workflow.
export async function raisePaymentDispute(paymentId, disputeDesc) {
  const { data, error } = await supabase
    .from(TABLES.payments)
    .update({ dispute_desc: disputeDesc, status: 'disputed', disputed_at: new Date().toISOString() })
    .eq('id', paymentId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Runs the payment dispute by application step for this page workflow.
export async function raisePaymentDisputeByApplication(applicationId, disputeDesc, payeeId = null) {
  const payment = await ensurePaymentRecordForApplication(applicationId, payeeId);
  return raisePaymentDispute(payment.id, disputeDesc);
}

// Runs the payment dispute and create report by application step for this page workflow.
export async function raisePaymentDisputeAndCreateReportByApplication(applicationId, disputeDesc, payeeId = null, evidenceUrl = '') {
  const payment = await raisePaymentDisputeByApplication(applicationId, disputeDesc, payeeId);

  let application = null;
  let employerId = null;
  let jobTitle = 'job listing';

  try {
    const { data, error } = await supabase
      .from(TABLES.applications)
      .select('id, job_id')
      .eq('id', applicationId)
      .maybeSingle();
    if (error) throw error;
    application = data || null;
  } catch (_) {}

  if (application?.job_id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.jobs)
        .select('id, employer_id, title')
        .eq('id', application.job_id)
        .maybeSingle();
      if (error) throw error;
      employerId = data?.employer_id || null;
      jobTitle = data?.title || jobTitle;
    } catch (_) {}
  }

  await createReport({
    reporter_id: payeeId || payment?.payee_id || null,
    reported_user: employerId,
    report_type: 'other',
    description: `Payment dispute for "${jobTitle}". ${disputeDesc}${evidenceUrl ? ` Evidence: ${evidenceUrl}` : ''}`,
    status: 'pending',
    admin_notes: `payment_dispute:${payment.id}`
  });

  return payment;
}

// Runs the payment dispute step for this page workflow.
export async function resolvePaymentDispute(paymentId, resolution) {
  const { data, error } = await supabase
    .from(TABLES.payments)
    .update({ admin_resolution: resolution, status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', paymentId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Loads payment disputes data so the page can display current information.
export async function fetchPaymentDisputes() {
  const { data, error } = await supabase
    .from(TABLES.payments)
    .select('*')
    .or('status.eq.disputed,dispute_desc.not.is.null')
    .order('disputed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data || []).filter((row) =>
    row.dispute_desc || String(row.status || '').toLowerCase() === 'disputed'
  );
}

// Runs the payment received step for this page workflow.
export async function confirmPaymentReceived(applicationId) {
  // Find the payment record for this application, then mark seeker confirmed
  const { data: payment, error: fetchError } = await supabase
    .from(TABLES.payments)
    .select('id, amount')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (payment?.id) {
    // Payment record exists — update seeker_confirmed_at
    const updates = {
      seeker_confirmed_at: new Date().toISOString(),
      payee_confirmed: true,
      status: 'confirmed'
    };
    const { error } = await supabase
      .from(TABLES.payments)
      .update(updates)
      .eq('id', payment.id);
    if (error) throw error;
  } else {
    throw new Error('No payment record exists yet. Ask the employer to record payment before confirming receipt.');
  }

  await updateApplicationStatus(applicationId, 'completed');
  return { amount: Number(payment?.amount) || 0 };
}

// ── Skill Tags ─────────────────────────────────────────────────────────────

// Loads skill tags data so the page can display current information.
export async function fetchSkillTags() {
  const [profilesResult, jobsResult] = await Promise.all([
    supabase.from(TABLES.profiles).select('skill_tags'),
    supabase.from(TABLES.jobs).select('skill_tags')
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (jobsResult.error) throw jobsResult.error;

  const counts = new Map();
  [...(profilesResult.data || []), ...(jobsResult.data || [])].forEach((row) => {
    normalizeArray(row.skill_tags).forEach((tag) => {
      const name = String(tag).trim();
      if (!name) return;
      const key = name.toLowerCase();
      const current = counts.get(key) || { name, usage_count: 0 };
      current.usage_count += 1;
      counts.set(key, current);
    });
  });

  return [...counts.values()].sort((a, b) => b.usage_count - a.usage_count || a.name.localeCompare(b.name));
}

// Runs the skill tag usage step for this page workflow.
export async function incrementSkillTagUsage(tagNames = []) {
  return normalizeArray(tagNames).length;
}

// ── Analytics ─────────────────────────────────────────────────────────────
// Note: the Admin Analytics dashboard now computes everything live from
// users/jobs/reports/applications on each page load instead of writing to
// or reading from a stored public.analytics snapshot table.

// Loads all applications data so the page can display current information.
export async function fetchAllApplications() {
  const { data, error } = await supabase
    .from(TABLES.applications)
    .select('*')
    .order('applied_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

// ── Job Expiry ─────────────────────────────────────────────────────────────

// Runs the expired jobs step for this page workflow.
export async function closeExpiredJobs() {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from(TABLES.jobs)
    .update({ status: 'expired' })
    .in('status', ['open', 'approved'])
    .lt('expiry_date', today);
  if (error) console.warn('closeExpiredJobs error (non-fatal):', error);
}

// ── Chat Image Upload ──────────────────────────────────────────────────────

// Runs the chat image step for this page workflow.
export async function uploadChatImage(file) {
  // Convert to base64 data URL directly — no Storage bucket needed
  return new Promise((resolve, reject) => {
    if (file.size > 3 * 1024 * 1024) {
      reject(new Error('Image must be 3MB or smaller.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

// ── Analytics Snapshot ─────────────────────────────────────────────────────
// Upserts one row per calendar date into the analytics table so that
// Table 3.20 (Data Dictionary – analytics) stays in sync with real usage.

// Runs the analytics snapshot step for this page workflow.
export async function saveAnalyticsSnapshot({
  totalUsers = 0,
  totalSeekers = 0,
  totalEmployers = 0,
  activeListings = 0,
  totalApps = 0,
  successfulMatches = 0
} = {}) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { error } = await supabase
    .from(TABLES.analytics)
    .upsert(
      {
        recorded_at: today,
        total_users: totalUsers,
        total_seekers: totalSeekers,
        total_employers: totalEmployers,
        active_listings: activeListings,
        total_apps: totalApps,
        successful_matches: successfulMatches
      },
      { onConflict: 'recorded_at' }
    );

  if (error) {
    console.warn('saveAnalyticsSnapshot (non-fatal):', error.message);
  }
}

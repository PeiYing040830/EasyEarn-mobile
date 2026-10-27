/**
 * EasyEarn file note: Handles the chatbot page behavior and related user interactions.
 */
import { fetchKnowledgeBase, fetchProfile, getCurrentUser, logChatbotInteraction } from './supabase-data.js';

const input = document.getElementById('chatbot-input');
const sendButton = document.getElementById('chatbot-send');
const body = document.getElementById('chatbot-body');
const quickContainer = document.getElementById('chatbot-quick');

let knowledgeBase = [];
let currentRole = 'guest';
const FALLBACK_REPLY = "I'm not sure about that. Please visit the Help page or contact our support team.";

const generalReplies = [
  // Greetings
  {
    triggers: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'helo', 'hai', 'howdy', 'sup', 'hiya'],
    answer:
      'Hi there! Welcome to EasyEarn. I can help with registration, finding jobs, applying, employer tools, and reports. What would you like to know?',
  },
  {
    triggers: ['help', 'what can you do', 'how can you help', 'what do you know', 'what can i ask', 'what do you offer', 'guide me', 'assist me'],
    answer:
      'I can help you with: registering an account, logging in, applying for jobs, saving jobs, updating your profile, uploading a resume, posting jobs (employers), reviewing applicants (employers), employer verification, and reporting suspicious listings. Just ask!',
  },
  // Registration & Login
  {
    triggers: ['register', 'sign up', 'create account'],
    answer:
      'You can register from the Register page using email and password. Choose the correct role first so your account opens the right dashboard.',
  },
  {
    triggers: ['login', 'log in', 'sign in'],
    answer:
      'Use the Login page with your email and password. If you already created an account, the system will redirect you to your role dashboard after sign-in.',
  },
  {
    triggers: ['forgot password', 'reset password', 'forget password', 'lupa password', 'change password', 'cant login', "can't login", 'password wrong', 'password incorrect'],
    answer:
      "To reset your password, click 'Forgot Password' on the Login page. A reset link will be sent to your registered email address.",
  },
  {
    triggers: ['forgot email', 'wrong email', 'change email', 'update email'],
    answer:
      'If you need to update your email address, please contact our support team from the Help page as email changes require admin assistance.',
  },
  {
    triggers: ['logout', 'log out', 'sign out'],
    answer:
      'You can log out by clicking the logout button in the top navigation bar or from your profile menu.',
  },
  // Job browsing
  {
    triggers: ['find job', 'search job', 'browse job', 'look for job', 'cari kerja', 'part time', 'full time', 'freelance', 'available job', 'job listing', 'job available'],
    answer:
      'You can browse all available jobs from the Jobs page. Use the search bar and filters to narrow down by job type, location, or category.',
  },
  // Application tracking
  {
    triggers: ['application status', 'track application', 'check application', 'my application', 'application update'],
    answer:
      'You can track all your applications from the Applications page on your dashboard. Each application shows its current status — Pending, Reviewed, Shortlisted, or Rejected.',
  },
  {
    triggers: ['notification', 'alert', 'noti'],
    answer:
      'You will receive updates on your applications through the platform. Check your Applications page regularly for any status changes from employers.',
  },
  // Account management
  {
    triggers: ['delete account', 'remove account', 'close account', 'deactivate account'],
    answer:
      'To delete your account, please contact our support team via the Help page. Account deletions are processed by our admin team.',
  },
  // Employer job management
  {
    triggers: ['edit job', 'update job', 'change listing', 'modify job'],
    answer:
      'Employers can edit existing job listings from Manage Jobs. Click on the job you want to edit and update the details before saving.',
  },
  {
    triggers: ['close job', 'remove job', 'delete listing', 'end listing', 'take down job'],
    answer:
      'You can close or remove a job listing from Manage Jobs. Closed listings will no longer appear to job seekers.',
  },
  {
    triggers: ['reject', 'shortlist', 'accept applicant', 'hire', 'reject applicant', 'shortlist applicant'],
    answer:
      'From the Applicants page, you can shortlist, accept, or reject candidates for each of your job listings. Applicants are notified when their status changes.',
  },
  // Support & Contact
  {
    triggers: ['contact', 'support', 'email support', 'reach support', 'customer service', 'helpdesk'],
    answer:
      'You can reach our support team through the Help page. Fill in the contact form and our team will respond as soon as possible.',
  },
  // Pricing
  {
    triggers: ['free', 'cost', 'price', 'fee', 'charge', 'payment', 'bayar', 'how much'],
    answer:
      'EasyEarn is free to use for job seekers. Employers can post jobs and manage listings at no cost during the current phase.',
  },
  // Privacy & Data
  {
    triggers: ['privacy', 'data', 'personal information', 'pdpa', 'data protection', 'my data'],
    answer:
      'EasyEarn handles all user data in accordance with Malaysia\'s PDPA 2010. Your personal information is protected and not shared with third parties without your consent.',
  },
  // Mobile / App
  {
    triggers: ['mobile', 'phone', 'app', 'android', 'ios', 'download app'],
    answer:
      'EasyEarn is currently available as a web platform. You can access it through your mobile browser. A dedicated mobile app may be introduced in a future update.',
  },
  // Reports & Scam
  {
    triggers: ['report', 'scam', 'fake job', 'harassment', 'suspicious', 'fraud'],
    answer:
      'You can use the Report page to submit suspicious jobs, scam concerns, or abuse reports. Admin can review the case from the reports panel.',
  },
  // Resume
  {
    triggers: ['resume', 'cv'],
    answer:
      'Job seekers can open the Resume page to preview and download a generated resume based on their saved profile and work history.',
  },
  // Language
  {
    triggers: ['language', 'bahasa', 'malay', 'english'],
    answer:
      'EasyEarn offers a language selector with English, Bahasa Malaysia, Chinese (Simplified and Traditional), Tamil, and other listed languages. Choose a language from the selector in the page header.',
  },
  // Thanks & Farewell
  {
    triggers: ['thank', 'thanks', 'thank you', 'terima kasih', 'tq', 'ty'],
    answer:
      "You're welcome! Let me know if there's anything else I can help you with.",
  },
  {
    triggers: ['bye', 'goodbye', 'see you', 'later', 'ok thanks', 'ok bye', 'good bye'],
    answer:
      'Goodbye! Feel free to come back anytime if you have more questions. Good luck on EasyEarn! 👋',
  },
];

const roleReplies = {
  seeker: [
    {
      triggers: ['apply', 'application', 'quick apply', 'upload resume', 'attach resume'],
      answer:
        'In Saved Jobs, click Apply on a live listing with openings that you have not already applied to. You can also apply from a job listing. Your application will appear in Applications with its current status.',
    },
    {
      triggers: ['saved', 'save job', 'wishlist'],
      answer:
        'Use Save Job on the Jobs page. Your saved listings appear in the Saved Jobs tab, where you can apply to eligible live jobs or remove them.',
    },
    {
      triggers: ['interview'],
      answer:
        'Interview updates will appear after employers review applications and move candidates forward. Until then, Applications is the main place to track progress.',
    },
    {
      triggers: ['profile', 'skills', 'availability'],
      answer:
        'Keep your Job Seeker profile updated with contact details, skills, and availability so your resume and matching results stay accurate.',
    },
  ],
  employer: [
    {
      triggers: ['post', 'create job', 'manage job', 'listing'],
      answer:
        'Employers can create and manage listings from Manage Jobs. New jobs go in as pending until admin reviews and approves them.',
    },
    {
      triggers: ['applicant', 'application', 'candidate'],
      answer:
        'Open Applicants to review who applied to your jobs. That page shows applicant details, current status mix, and the roles they applied for.',
    },
    {
      triggers: ['verification', 'ssm', 'business verification'],
      answer:
        'In Verification, Individual Hirers do not need a registration number. Companies and Online Sellers must provide a registration number and the required documents. Admin review updates your employer verification status.',
    },
    {
      triggers: ['message', 'chat job seeker', 'contact applicant'],
      answer:
        'Use Messages to open conversations and contact job seekers. You can also start or continue applicant conversations from the employer workflow.',
    },
    {
      triggers: ['openings', 'vacancies', 'how many'],
      answer:
        'Set Openings when creating a job if one listing should hire more than one person. A job seeker can still apply only once to the same job.',
    },
  ],
  admin: [
    {
      triggers: ['verification', 'approve employer', 'review employer'],
      answer:
        'Open Verifications to review employer submissions, approve trusted employers, request recheck, or reject incomplete verification requests.',
    },
    {
      triggers: ['report', 'moderation'],
      answer:
        'Reports lets admin review user complaints, suspicious cases, and moderation notes. You can move items through review and resolution states there.',
    },
    {
      triggers: ['job', 'approve listing', 'flag listing'],
      answer:
        'Admin can moderate jobs from the Jobs page. Listings usually move through pending, approved, flagged, or removed states.',
    },
    {
      triggers: ['analytics', 'dashboard'],
      answer:
        'The admin dashboard and analytics pages summarize users, jobs, reports, and verification activity for platform oversight.',
    },
  ],
};

const roleConfig = {
  guest: {
    pill: 'Support',
    intro:
      "Hi! I'm EasyEarn Assistant. I can help with registration, jobs, applications, employer workflow, and reports. What do you need today?",
    quick: ['How do I register?', 'How to apply for a job?', 'How do employers post a job?', 'I want to report a scam'],
    hint: 'You are chatting with the EasyEarn Assistant. Ask about registration, jobs, applications, employer workflow, or reports.',
    hero: 'Ask about jobs, hiring tools, applications, verification, and platform features anytime.',
  },
  seeker: {
    pill: 'Job Seeker',
    intro:
      "Hi! I'm EasyEarn Assistant for job seekers. I can help with jobs, applications, saved jobs, resume updates, and profile questions.",
    quick: ['How do I apply?', 'How do I save a job?', 'How do I update my profile?', 'How do I upload resume?'],
    hint: 'You are chatting with the Job Seeker assistant. Ask about jobs, applications, saved jobs, profile, or resume.',
    hero: 'Get help with jobs, applications, saved roles, resume updates, and your job seeker profile.',
  },
  employer: {
    pill: 'Employer',
    intro:
      "Hi! I'm EasyEarn Assistant for employers. I can help with managing job listings, reviewing applicants, verification, and hiring workflow questions.",
    quick: ['How do I post a job?', 'Where can I see applicants?', 'How does employer verification work?', 'Can I hire multiple people for one job?'],
    hint: 'You are chatting with the Employer assistant. Ask about job postings, applicants, verification, or hiring workflow.',
    hero: 'Get help with posting jobs, reviewing applicants, verification, and employer dashboard tools.',
  },
  admin: {
    pill: 'Admin',
    intro:
      "Hi! I'm EasyEarn Assistant for admins. I can help with reports, verification review, job moderation, and analytics questions.",
    quick: ['How do I review reports?', 'How do I approve employers?', 'How do job approvals work?', 'What is on the analytics page?'],
    hint: 'You are chatting with the Admin assistant. Ask about moderation, verification, reports, jobs, or analytics.',
    hero: 'Get help with moderation, verification review, analytics, and admin workflow.',
  },
};

// Formats or checks role so later code can use a clean value.
function normalizeRole(role) {
  if (!role) {
    return 'guest';
  }

  const lower = String(role).toLowerCase();
  if (lower === 'jobseeker') {
    return 'seeker';
  }
  if (lower === 'seeker' || lower === 'employer' || lower === 'admin') {
    return lower;
  }
  return 'guest';
}

// Loads current config data so the page can display current information.
function getCurrentConfig() {
  return roleConfig[currentRole] || roleConfig.guest;
}

// Runs the role step for this page workflow.
async function detectRole() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      currentRole = 'guest';
      return;
    }

    const profile = await fetchProfile(user.id, user);
    currentRole = normalizeRole(profile?.role || user.user_metadata?.role);
  } catch (error) {
    console.warn('Unable to detect chatbot role:', error);
    currentRole = 'guest';
  }
}

// Loads knowledge base data so the page can display current information.
async function loadKnowledgeBase() {
  try {
    knowledgeBase = await fetchKnowledgeBase();
  } catch (error) {
    console.warn('Unable to load chatbot knowledge base:', error);
    knowledgeBase = [];
  }
}

// Creates message when the workflow needs a new record or message.
function addMessage(sender, message) {
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${sender}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = message;

  wrapper.appendChild(bubble);
  body.appendChild(wrapper);
  body.scrollTop = body.scrollHeight;
}

// Creates typing indicator when the workflow needs a new record or message.
function addTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'chat-message bot';
  indicator.dataset.typing = 'true';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = 'Typing...';

  indicator.appendChild(bubble);
  body.appendChild(indicator);
  body.scrollTop = body.scrollHeight;
  return indicator;
}

// Clears or removes typing indicator from the UI or database.
function removeTypingIndicator(indicator) {
  if (indicator && indicator.parentNode) {
    indicator.parentNode.removeChild(indicator);
  }
}

// Formats or checks service reply so later code can use a clean value.
function buildServiceReply(question) {
  const lower = question.toLowerCase();
  const roleSpecific = roleReplies[currentRole] || [];
  const allReplies = [...roleSpecific, ...generalReplies];

  const match = allReplies.find((entry) => entry.triggers.some((trigger) => lower.includes(trigger)));
  if (match) {
    return match.answer;
  }

  return FALLBACK_REPLY;
}

// Helper function for find knowledge reply used by this script.
function findKnowledgeReply(question) {
  const lower = question.toLowerCase();
  const entry = knowledgeBase.find((item) => {
    const inQuestion = item.question && item.question.toLowerCase().includes(lower);
    const inKeywords = Array.isArray(item.keywords)
      ? item.keywords.some((keyword) => lower.includes(String(keyword).toLowerCase()))
      : false;

    return inQuestion || inKeywords;
  });

  return entry?.answer || null;
}

// Helper function for find canned reply used by this script.
function findCannedReply(question) {
  return findKnowledgeReply(question) || buildServiceReply(question);
}

// Renders quick replies into the HTML so the user can see it.
function renderQuickReplies() {
  if (!quickContainer) {
    return;
  }

  const config = getCurrentConfig();
  quickContainer.innerHTML = '';
  config.quick.forEach((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.quick = label;
    button.textContent = label;
    quickContainer.appendChild(button);
  });
}

// Helper function for apply chatbot context used by this script.
function applyChatbotContext() {
  const config = getCurrentConfig();

  const initialBubble = body?.querySelector('.chat-message.bot .chat-bubble');
  if (initialBubble) {
    initialBubble.textContent = config.intro;
  }

  const hint = document.querySelector('.chatbot-hint');
  if (hint) {
    hint.textContent = config.hint;
  }

  const pill = document.querySelector('.chatbot-pill');
  if (pill) {
    pill.textContent = config.pill;
  }

  const heroParagraph = document.querySelector('.chatbot-hero .page-hero-inner p');
  if (heroParagraph) {
    heroParagraph.textContent = config.hero;
  }

  renderQuickReplies();
}

// Handles the send action triggered by the user.
async function handleSend(messageOverride = '') {
  // Helper function for message used by this script.
  const message = (messageOverride || input?.value || '').trim();
  if (!message) {
    return;
  }

  addMessage('user', message);
  if (input) {
    input.value = '';
  }

  const typingIndicator = addTypingIndicator();

  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });

  await loadKnowledgeBase();
  removeTypingIndicator(typingIndicator);
  const matched = Boolean(findKnowledgeReply(message));
  const reply = findCannedReply(message);
  addMessage('bot', reply);

  try {
    await logChatbotInteraction({
      question: message,
      answer: reply,
      matched,
      confidence_score: matched ? 1 : 0
    });
  } catch (error) {
    console.warn('Unable to save chatbot log:', error);
  }
}

// Sets up chatbot hero slides when this script is loaded.
function initChatbotHeroSlides() {
  const slides = Array.from(document.querySelectorAll('.chatbot-hero-slide'));
  if (slides.length <= 1) {
    return;
  }

  let activeIndex = 0;
  window.setInterval(() => {
    slides[activeIndex].classList.remove('is-active');
    activeIndex = (activeIndex + 1) % slides.length;
    slides[activeIndex].classList.add('is-active');
  }, 4500);
}

// Waits until the HTML has loaded before running page setup code.
document.addEventListener('DOMContentLoaded', async () => {
  initChatbotHeroSlides();
  await detectRole();
  await loadKnowledgeBase();
  applyChatbotContext();

  sendButton?.addEventListener('click', () => handleSend());
  input?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      handleSend();
    }
  });
  quickContainer?.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-quick]');
    if (target) {
      handleSend(target.dataset.quick || '');
    }
  });
});

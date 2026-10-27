/**
 * EasyEarn file note: Handles the floating chatbot page behavior and related user interactions.
 */
import { fetchKnowledgeBase, fetchProfile, getCurrentUser, logChatbotInteraction } from './supabase-data.js';

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
      'Register from the Register page with your email and password, then choose the correct role so EasyEarn opens the right dashboard for you.',
  },
  {
    triggers: ['login', 'log in', 'sign in'],
    answer:
      'Use the Login page with your email and password. The system will redirect you to your role dashboard after sign-in.',
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
    triggers: ['report', 'scam', 'fake job', 'suspicious', 'fraud'],
    answer:
      'Use the Report page if you need to report a suspicious listing, scam concern, or abusive behavior. Admin can review it from the reports panel.',
  },
  // Resume
  {
    triggers: ['resume', 'cv'],
    answer:
      'Job seekers can update profile details first, then open Resume to preview and download a PDF version of their resume.',
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
        'In Saved Jobs, click Apply on a live listing with openings that you have not already applied to. You can also apply from a job listing. Applications will show the current status after you apply.',
    },
    {
      triggers: ['saved', 'save job'],
      answer:
        'Use Save Job on the Jobs page. Your saved listings appear in the Saved Jobs tab, where you can apply to eligible live jobs or remove them.',
    },
    {
      triggers: ['interview'],
      answer:
        'Interviews will appear after employers review applications and move candidates forward. Until then, Applications is your main tracking page.',
    },
  ],
  employer: [
    {
      triggers: ['post', 'manage jobs', 'listing'],
      answer:
        'Employers manage listings from Manage Jobs. New postings start in pending review and become visible to job seekers after admin approval.',
    },
    {
      triggers: ['applicant', 'candidate', 'application'],
      answer:
        'Use Applicants to review who applied, which job they selected, and the current application mix across your listings.',
    },
    {
      triggers: ['verification', 'ssm'],
      answer:
        'In Verification, Individual Hirers do not need a registration number. Companies and Online Sellers must provide a registration number and the required documents. Admin review updates your employer verification status.',
    },
    {
      triggers: ['message', 'chat seeker', 'contact applicant'],
      answer:
        'Use Messages to open conversations and contact job seekers. You can also start or continue applicant conversations from the employer workflow.',
    },
  ],
  admin: [
    {
      triggers: ['verification', 'approve employer'],
      answer:
        'Open Verifications to review employer submissions, approve trusted employers, request recheck, or reject incomplete requests.',
    },
    {
      triggers: ['job', 'approve listing', 'flag listing'],
      answer:
        'Admin moderates job postings from Jobs. Listings move through pending, approved, flagged, or removed states.',
    },
    {
      triggers: ['report', 'moderation'],
      answer:
        'Use Reports to review user complaints, suspicious behavior, and moderation notes for the platform.',
    },
  ],
};

const roleConfig = {
  guest: {
    title: 'EasyEarn Assistant',
    intro: 'Hi! Ask me about registration, jobs, applications, employer workflow, or reports.',
    quick: ['How do I register?', 'How do I apply?', 'How do employers post a job?'],
  },
  seeker: {
    title: 'Job Seeker Assistant',
    intro: 'Hi! I can help with jobs, applications, saved roles, resume updates, and profile setup.',
    quick: ['How do I apply?', 'How do I save a job?', 'How do I upload resume?'],
  },
  employer: {
    title: 'Employer Assistant',
    intro: 'Hi! I can help with job listings, applicants, verification, and employer workflow questions.',
    quick: ['How do I post a job?', 'Where can I see applicants?', 'How does verification work?'],
  },
  admin: {
    title: 'Admin Assistant',
    intro: 'Hi! I can help with reports, job moderation, verification review, and analytics questions.',
    quick: ['How do I review reports?', 'How do I approve jobs?', 'How do I approve employers?'],
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
    const message = String(error?.message || error?.name || '').toLowerCase();
    if (message.includes('auth session missing')) {
      currentRole = 'guest';
      return;
    }

    console.warn('Unable to detect floating chatbot role:', error);
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

// Loads config data so the page can display current information.
function getConfig() {
  return roleConfig[currentRole] || roleConfig.guest;
}

// Helper function for find knowledge reply used by this script.
function findKnowledgeReply(message) {
  const lower = message.toLowerCase();
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
function findCannedReply(message) {
  const lower = message.toLowerCase();
  const combined = [...(roleReplies[currentRole] || []), ...generalReplies];
  const match = combined.find((entry) => entry.triggers.some((trigger) => lower.includes(trigger)));

  if (match) {
    return match.answer;
  }

  return FALLBACK_REPLY;
}

// Formats or checks reply so later code can use a clean value.
function buildReply(message) {
  return findKnowledgeReply(message) || findCannedReply(message);
}

// Creates chat UI when the workflow needs a new record or message.
function createChatUI() {
  const chatbot = document.createElement('div');
  chatbot.id = 'floating-chatbot';
  chatbot.innerHTML = `
    <button id="chatbot-toggle" aria-label="Open chatbot">💬</button>
    <div id="chatbot-window" class="hidden">
      <div class="chatbot-header">
        <h3>${getConfig().title}</h3>
        <button id="chatbot-close" type="button">x</button>
      </div>
      <div id="chatbot-messages">
        <div class="chatbot-message bot">${getConfig().intro}</div>
      </div>
      <div id="chatbot-quick-actions"></div>
      <div class="chatbot-input-row">
        <input id="chatbot-text" type="text" placeholder="Ask something...">
        <button id="chatbot-send-btn" type="button">Send</button>
      </div>
    </div>
  `;

  document.body.appendChild(chatbot);

  const style = document.createElement('style');
  style.textContent = `
    #floating-chatbot {
      position: fixed;
      bottom: 16px;
      right: 24px;
      z-index: 9999;
      font-family: inherit;
    }

    #chatbot-toggle {
      width: 64px;
      height: 64px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #1ba94c, #0f8b3b);
      color: #fff;
      cursor: pointer;
      box-shadow: 0 16px 30px rgba(27, 169, 76, 0.28);
      font-size: 28px;
      line-height: 1;
    }

    #chatbot-window {
      width: min(360px, calc(100vw - 32px));
      max-height: 560px;
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.22);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: absolute;
      bottom: 78px;
      right: 0;
    }

    #chatbot-window.hidden {
      display: none;
    }

    #chatbot-window .chatbot-header {
      padding: 16px 18px;
      background: #16a34a;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    #chatbot-window .chatbot-header h3 {
      margin: 0;
      font-size: 18px;
    }

    #chatbot-close {
      border: 0;
      background: rgba(255, 255, 255, 0.16);
      color: #fff;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      cursor: pointer;
    }

    #chatbot-messages {
      padding: 16px;
      overflow-y: auto;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 220px;
      max-height: 320px;
    }

    .chatbot-message {
      padding: 10px 12px;
      border-radius: 12px;
      line-height: 1.5;
      font-size: 14px;
      max-width: 88%;
      white-space: pre-wrap;
    }

    .chatbot-message.bot {
      background: #e7f7ee;
      color: #14532d;
      align-self: flex-start;
    }

    .chatbot-message.user {
      background: #16a34a;
      color: #fff;
      align-self: flex-end;
    }

    #chatbot-quick-actions {
      padding: 12px 16px 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      background: #fff;
    }

    .chatbot-quick-btn {
      border: 1px solid #dbe3ef;
      border-radius: 999px;
      padding: 8px 12px;
      background: #fff;
      cursor: pointer;
      font-size: 13px;
      color: #1e293b;
    }

    .chatbot-input-row {
      display: flex;
      gap: 10px;
      padding: 16px;
      background: #fff;
      border-top: 1px solid #e5e7eb;
    }

    #chatbot-text {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 12px 14px;
      font: inherit;
    }

    #chatbot-send-btn {
      border: 0;
      border-radius: 12px;
      background: #16a34a;
      color: #fff;
      padding: 12px 16px;
      cursor: pointer;
    }

    @media (max-width: 640px) {
      #floating-chatbot {
        right: 16px;
        bottom: 16px;
      }

      #chatbot-window {
        right: 0;
        bottom: 72px;
      }
    }
  `;
  document.head.appendChild(style);
}

// Renders quick buttons into the HTML so the user can see it.
function renderQuickButtons() {
  const quickActions = document.getElementById('chatbot-quick-actions');
  if (!quickActions) {
    return;
  }

  quickActions.innerHTML = '';
  getConfig().quick.forEach((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chatbot-quick-btn';
    button.textContent = label;
    // Connects this element event to the handler that should run next.
    button.addEventListener('click', () => handleSend(label));
    quickActions.appendChild(button);
  });
}

// Helper function for append message used by this script.
function appendMessage(role, text) {
  const messages = document.getElementById('chatbot-messages');
  if (!messages) {
    return;
  }

  const message = document.createElement('div');
  message.className = `chatbot-message ${role}`;
  message.textContent = text;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
}

// Handles the send action triggered by the user.
async function handleSend(forcedText = '') {
  const input = document.getElementById('chatbot-text');
  // Helper function for text used by this script.
  const text = (forcedText || input?.value || '').trim();
  if (!text) {
    return;
  }

  appendMessage('user', text);
  if (input) {
    input.value = '';
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 350);
  });

  await loadKnowledgeBase();
  const matched = Boolean(findKnowledgeReply(text));
  const reply = buildReply(text);
  appendMessage('bot', reply);

  try {
    await logChatbotInteraction({
      question: text,
      answer: reply,
      matched,
      confidence_score: matched ? 1 : 0
    });
  } catch (error) {
    console.warn('Unable to save floating chatbot log:', error);
  }
}

// Sets up events when this script is loaded.
function bindEvents() {
  const toggle = document.getElementById('chatbot-toggle');
  const close = document.getElementById('chatbot-close');
  const windowEl = document.getElementById('chatbot-window');
  const send = document.getElementById('chatbot-send-btn');
  const input = document.getElementById('chatbot-text');

  toggle?.addEventListener('click', () => {
    windowEl?.classList.toggle('hidden');
  });

  close?.addEventListener('click', () => {
    windowEl?.classList.add('hidden');
  });

  send?.addEventListener('click', () => handleSend());
  input?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      handleSend();
    }
  });
}

// Sets up floating chat when this script is loaded.
async function initFloatingChat() {
  // 1. Create UI first so it is visible immediately
  createChatUI();
  bindEvents();
  renderQuickButtons();

  // 2. Load dynamic data in background
  try {
    await detectRole();
    await loadKnowledgeBase();

    // 3. Update UI with detected role info
    const title = document.getElementById('chat-title');
    const intro = document.getElementById('chat-intro');
    if (title) title.textContent = getConfig().title;
    if (intro) intro.textContent = getConfig().intro;
    renderQuickButtons();
  } catch (e) {
    console.warn("Chatbot background loading encountered an issue.");
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initFloatingChat();
} else {
  // Waits until the HTML has loaded before running page setup code.
  document.addEventListener('DOMContentLoaded', initFloatingChat);
}

// ── First-Run Setup Wizard ─────────────────────────────────────────────────
// This module is loaded by index.html and called from app.js on DOMContentLoaded
// when system:get-setup-state returns { needsSetup: true }.
// It injects content into #setup-screen and manages a 4-step wizard UI.

(function () {
  'use strict';

  // ── Step definitions ──────────────────────────────────────────────────────
  const STEPS = [
    {
      id: 'step-welcome',
      icon: `<svg viewBox="0 0 48 48" fill="none" class="wizard-hero-icon">
        <defs>
          <linearGradient id="wiz-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#6366f1"/>
            <stop offset="100%" stop-color="#8b5cf6"/>
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#wiz-grad)"/>
        <path d="M12 14L24 8l12 6v14l-12 6-12-6V14z" stroke="white" stroke-width="2" fill="none"/>
        <path d="M24 20v12M18 23l6-3 6 3" stroke="white" stroke-width="1.5" fill="none"/>
      </svg>`,
      title: 'Welcome to EduTrack',
      subtitle: 'Let\'s set up your tutoring center in just a few steps.',
      fields: `
        <div class="wiz-form-group">
          <label class="wiz-label">Your Name (Owner) *</label>
          <input id="wiz-owner-name" class="wiz-input" type="text" placeholder="e.g. Ahmed Hassan" autocomplete="off" />
          <span class="wiz-hint">This will appear in the admin account.</span>
        </div>
        <div class="wiz-form-group">
          <label class="wiz-label">Center Name *</label>
          <input id="wiz-center-name" class="wiz-input" type="text" placeholder="e.g. Bright Minds Academy" autocomplete="off" />
          <span class="wiz-hint">Your main teaching center will be created automatically.</span>
        </div>`,
    },
    {
      id: 'step-admin',
      icon: `<svg viewBox="0 0 48 48" fill="none" class="wizard-hero-icon">
        <defs>
          <linearGradient id="wiz-grad2" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#06b6d4"/>
            <stop offset="100%" stop-color="#6366f1"/>
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#wiz-grad2)"/>
        <circle cx="24" cy="18" r="6" stroke="white" stroke-width="2" fill="none"/>
        <path d="M10 40c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="white" stroke-width="2" fill="none"/>
      </svg>`,
      title: 'Create Your Admin Account',
      subtitle: 'This replaces the default admin/admin123 credentials permanently.',
      fields: `
        <div class="wiz-form-group">
          <label class="wiz-label">Admin Username *</label>
          <input id="wiz-admin-user" class="wiz-input" type="text" placeholder="e.g. ahmed.admin" autocomplete="off" />
        </div>
        <div class="wiz-form-group">
          <label class="wiz-label">Password *</label>
          <div class="wiz-input-eye-wrap">
            <input id="wiz-admin-pass" class="wiz-input" type="password" placeholder="Min 6 characters" autocomplete="new-password" />
            <button type="button" class="wiz-eye-btn" id="wiz-toggle-pass" title="Show/hide password">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <div class="wiz-strength-bar" id="wiz-strength-bar">
            <div class="wiz-strength-fill" id="wiz-strength-fill"></div>
          </div>
          <span class="wiz-strength-label" id="wiz-strength-label"></span>
        </div>
        <div class="wiz-form-group">
          <label class="wiz-label">Confirm Password *</label>
          <input id="wiz-admin-confirm" class="wiz-input" type="password" placeholder="Repeat password" autocomplete="new-password" />
        </div>`,
    },
    {
      id: 'step-settings',
      icon: `<svg viewBox="0 0 48 48" fill="none" class="wizard-hero-icon">
        <defs>
          <linearGradient id="wiz-grad3" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#22c55e"/>
            <stop offset="100%" stop-color="#06b6d4"/>
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#wiz-grad3)"/>
        <circle cx="24" cy="24" r="8" stroke="white" stroke-width="2" fill="none"/>
        <path d="M24 4v4M24 40v4M4 24h4M40 24h4M9.17 9.17l2.83 2.83M35.17 35.17l2.83 2.83M9.17 38.83l2.83-2.83M35.17 12.83l2.83-2.83" stroke="white" stroke-width="2"/>
      </svg>`,
      title: 'Quick Settings',
      subtitle: 'These can be changed later in the WhatsApp settings page.',
      fields: `
        <div class="wiz-form-group">
          <label class="wiz-label">Country Code for WhatsApp</label>
          <div class="wiz-country-row">
            <span class="wiz-country-prefix">+</span>
            <input id="wiz-country-code" class="wiz-input" type="text" placeholder="20" value="20" autocomplete="off" maxlength="4" />
          </div>
          <span class="wiz-hint">e.g. 20 for Egypt, 966 for Saudi Arabia, 1 for USA</span>
        </div>
        <div class="wiz-form-group">
          <label class="wiz-label">First Academic Level (optional)</label>
          <input id="wiz-default-level" class="wiz-input" type="text" placeholder="e.g. Grade 10, Secondary 1" autocomplete="off" />
          <span class="wiz-hint">You can add more levels later in the Levels page.</span>
        </div>`,
    },
    {
      id: 'step-summary',
      icon: `<svg viewBox="0 0 48 48" fill="none" class="wizard-hero-icon">
        <defs>
          <linearGradient id="wiz-grad4" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#wiz-grad4)"/>
        <polyline points="12,26 20,34 36,16" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      title: 'All Set!',
      subtitle: 'Here\'s a summary of your setup. Click Launch to get started.',
      fields: `<div id="wiz-summary-content" class="wiz-summary"></div>`,
    },
  ];

  // ── Wizard state ──────────────────────────────────────────────────────────
  let currentStep = 0;

  // ── Password strength calculator ──────────────────────────────────────────
  function getPasswordStrength(password) {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const levels = [
      { label: '', color: '' },
      { label: 'Weak', color: '#ef4444' },
      { label: 'Fair', color: '#f59e0b' },
      { label: 'Good', color: '#06b6d4' },
      { label: 'Strong', color: '#22c55e' },
      { label: 'Very Strong', color: '#8b5cf6' },
    ];
    return { score, ...levels[score] };
  }

  // ── Render the wizard ─────────────────────────────────────────────────────
  function renderWizard() {
    const screen = document.getElementById('setup-screen');
    screen.innerHTML = `
      <div class="wiz-bg">
        <div class="wiz-glow wiz-glow-1"></div>
        <div class="wiz-glow wiz-glow-2"></div>
      </div>
      <div class="wiz-container">
        <div class="wiz-card" id="wiz-card">
          <!-- Step indicators -->
          <div class="wiz-steps" id="wiz-steps">
            ${STEPS.map((s, i) => `
              <div class="wiz-step-dot ${i === 0 ? 'active' : ''}" data-step="${i}">
                <div class="wiz-step-dot-inner"></div>
              </div>`).join('')}
          </div>

          <!-- Step content (animated by JS) -->
          <div class="wiz-step-body" id="wiz-step-body">
            ${renderStep(0)}
          </div>

          <!-- Navigation -->
          <div class="wiz-nav" id="wiz-nav">
            <button class="wiz-btn wiz-btn-ghost hidden" id="wiz-back-btn">← Back</button>
            <div class="wiz-step-counter" id="wiz-step-counter">Step 1 of ${STEPS.length}</div>
            <button class="wiz-btn wiz-btn-primary" id="wiz-next-btn">Continue →</button>
          </div>

          <div id="wiz-error" class="wiz-error hidden"></div>
        </div>
      </div>`;

    bindEvents();
  }

  function renderStep(index) {
    const step = STEPS[index];
    return `
      <div class="wiz-step-inner" id="${step.id}">
        <div class="wiz-hero">${step.icon}</div>
        <h2 class="wiz-title">${step.title}</h2>
        <p class="wiz-subtitle">${step.subtitle}</p>
        <div class="wiz-fields">${step.fields}</div>
      </div>`;
  }

  // ── Event binding ─────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('wiz-next-btn').addEventListener('click', handleNext);
    document.getElementById('wiz-back-btn').addEventListener('click', handleBack);

    // Password strength (re-bind after step 2 render)
    bindPasswordStrength();
  }

  function bindPasswordStrength() {
    const passInput = document.getElementById('wiz-admin-pass');
    const toggleBtn = document.getElementById('wiz-toggle-pass');
    if (!passInput) return;

    passInput.addEventListener('input', () => {
      const { score, label, color } = getPasswordStrength(passInput.value);
      const fill = document.getElementById('wiz-strength-fill');
      const labelEl = document.getElementById('wiz-strength-label');
      if (fill) {
        fill.style.width = `${(score / 5) * 100}%`;
        fill.style.background = color;
      }
      if (labelEl) {
        labelEl.textContent = label;
        labelEl.style.color = color;
      }
    });

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        passInput.type = passInput.type === 'password' ? 'text' : 'password';
      });
    }
  }

  // ── Navigation helpers ────────────────────────────────────────────────────
  function showError(msg) {
    const errEl = document.getElementById('wiz-error');
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
    errEl.style.animation = 'none';
    requestAnimationFrame(() => { errEl.style.animation = ''; });
  }

  function clearError() {
    const errEl = document.getElementById('wiz-error');
    if (errEl) errEl.classList.add('hidden');
  }

  function collectValues() {
    return {
      ownerName: (document.getElementById('wiz-owner-name') || {}).value || '',
      centerName: (document.getElementById('wiz-center-name') || {}).value || '',
      adminUsername: (document.getElementById('wiz-admin-user') || {}).value || '',
      adminPassword: (document.getElementById('wiz-admin-pass') || {}).value || '',
      adminConfirm: (document.getElementById('wiz-admin-confirm') || {}).value || '',
      countryCode: (document.getElementById('wiz-country-code') || {}).value || '20',
      defaultLevel: (document.getElementById('wiz-default-level') || {}).value || '',
    };
  }

  function validateStep(index) {
    const v = collectValues();
    clearError();
    if (index === 0) {
      if (!v.ownerName.trim()) { showError('Please enter your name.'); return false; }
      if (!v.centerName.trim()) { showError('Please enter the center name.'); return false; }
    }
    if (index === 1) {
      if (!v.adminUsername.trim()) { showError('Please enter a username.'); return false; }
      if (v.adminPassword.length < 6) { showError('Password must be at least 6 characters.'); return false; }
      if (v.adminPassword !== v.adminConfirm) { showError('Passwords do not match.'); return false; }
    }
    return true;
  }

  function updateStepIndicators(idx) {
    document.querySelectorAll('.wiz-step-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === idx);
      dot.classList.toggle('completed', i < idx);
    });
    const counter = document.getElementById('wiz-step-counter');
    if (counter) counter.textContent = `Step ${idx + 1} of ${STEPS.length}`;
  }

  function transitionToStep(newIndex, direction = 1) {
    const body = document.getElementById('wiz-step-body');
    const outClass = direction > 0 ? 'wiz-slide-out-left' : 'wiz-slide-out-right';
    const inClass  = direction > 0 ? 'wiz-slide-in-right' : 'wiz-slide-in-left';

    body.classList.add(outClass);
    setTimeout(() => {
      currentStep = newIndex;
      body.innerHTML = renderStep(newIndex);
      body.classList.remove(outClass);
      body.classList.add(inClass);
      bindPasswordStrength();
      updateStepIndicators(newIndex);

      // Populate summary on last step
      if (newIndex === STEPS.length - 1) renderSummary();

      // Update nav buttons
      const backBtn = document.getElementById('wiz-back-btn');
      const nextBtn = document.getElementById('wiz-next-btn');
      if (backBtn) backBtn.classList.toggle('hidden', newIndex === 0);
      if (nextBtn) {
        nextBtn.textContent = newIndex === STEPS.length - 1 ? '🚀 Launch EduTrack' : 'Continue →';
        nextBtn.classList.toggle('wiz-btn-launch', newIndex === STEPS.length - 1);
      }

      clearError();

      setTimeout(() => body.classList.remove(inClass), 350);
    }, 280);
  }

  function renderSummary() {
    const v = collectValues();
    const el = document.getElementById('wiz-summary-content');
    if (!el) return;
    el.innerHTML = `
      <div class="wiz-summary-row">
        <span class="wiz-summary-key">Owner</span>
        <span class="wiz-summary-val">${escHtml(v.ownerName)}</span>
      </div>
      <div class="wiz-summary-row">
        <span class="wiz-summary-key">Center</span>
        <span class="wiz-summary-val">${escHtml(v.centerName)}</span>
      </div>
      <div class="wiz-summary-row">
        <span class="wiz-summary-key">Admin Username</span>
        <span class="wiz-summary-val"><code>${escHtml(v.adminUsername)}</code></span>
      </div>
      <div class="wiz-summary-row">
        <span class="wiz-summary-key">Password</span>
        <span class="wiz-summary-val">●●●●●●</span>
      </div>
      <div class="wiz-summary-row">
        <span class="wiz-summary-key">WhatsApp Country Code</span>
        <span class="wiz-summary-val">+${escHtml(v.countryCode || '20')}</span>
      </div>
      <div class="wiz-summary-row">
        <span class="wiz-summary-key">First Academic Level</span>
        <span class="wiz-summary-val">${v.defaultLevel ? escHtml(v.defaultLevel) : '<em style="color:var(--text-muted)">Skipped</em>'}</span>
      </div>`;
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleBack() {
    if (currentStep === 0) return;
    transitionToStep(currentStep - 1, -1);
  }

  async function handleNext() {
    if (!validateStep(currentStep)) return;

    if (currentStep < STEPS.length - 1) {
      transitionToStep(currentStep + 1, 1);
      return;
    }

    // Final step — submit
    await submitSetup();
  }

  async function submitSetup() {
    const v = collectValues();
    const nextBtn = document.getElementById('wiz-next-btn');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Setting up…'; }

    try {
      const res = await window.api.system.completeSetup({
        ownerName: v.ownerName.trim(),
        centerName: v.centerName.trim(),
        adminUsername: v.adminUsername.trim(),
        adminPassword: v.adminPassword,
        countryCode: v.countryCode.trim() || '20',
        defaultLevel: v.defaultLevel.trim(),
      });

      if (!res.success) {
        showError(res.message || 'Setup failed. Please try again.');
        if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = '🚀 Launch EduTrack'; }
        return;
      }

      // Success — show celebration then reveal login
      showSuccessOverlay(() => {
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        // Pre-fill the username so the user can just type the password
        const userInput = document.getElementById('login-username');
        if (userInput) userInput.value = v.adminUsername.trim();
        const hintEl = document.querySelector('.login-hint');
        if (hintEl) hintEl.style.display = 'none';
      });
    } catch (err) {
      showError('An unexpected error occurred. Please restart the app.');
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = '🚀 Launch EduTrack'; }
    }
  }

  function showSuccessOverlay(callback) {
    const overlay = document.createElement('div');
    overlay.className = 'wiz-success-overlay';
    overlay.innerHTML = `
      <div class="wiz-success-card">
        <div class="wiz-success-icon">
          <svg viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" stroke="#22c55e" stroke-width="3" fill="none" opacity="0.3"/>
            <circle cx="32" cy="32" r="30" stroke="#22c55e" stroke-width="3" fill="none"
              class="wiz-success-ring"/>
            <polyline points="18,34 27,44 46,22" stroke="#22c55e" stroke-width="4"
              stroke-linecap="round" stroke-linejoin="round" class="wiz-success-check"/>
          </svg>
        </div>
        <h2 style="color:var(--green);font-size:20px;font-weight:800;margin:16px 0 8px">Setup Complete!</h2>
        <p style="color:var(--text-secondary);font-size:13px">Your EduTrack center is ready. Taking you to login…</p>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => { overlay.remove(); callback(); }, 2000);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.initSetupWizard = function () {
    renderWizard();
    document.getElementById('setup-screen').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('hidden');
  };
})();

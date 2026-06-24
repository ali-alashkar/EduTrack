// ── State ──────────────────────────────────────────────────────────────────
const State = {
  user: null,
  currentPage: 'dashboard',
};

// ── Toast ───────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icons[type]||icons.info}<span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

// ── Modal ───────────────────────────────────────────────────────────────────
function openModal({ title, body, footer = '', wide = false }) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML = footer;
  const modal = document.getElementById('modal');
  modal.classList.toggle('modal-wide', wide);
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ── Router ──────────────────────────────────────────────────────────────────
function navigate(page) {
  State.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  renderPage(page);
}

async function renderPage(page) {
  switch (page) {
    case 'dashboard':  await renderDashboard(); break;
    case 'levels':     await renderLevels();    break;
    case 'centers':    await renderCenters();   break;
    case 'students':   await renderStudents();  break;
    case 'groups':     await renderGroups();    break;
    case 'sessions':   await renderSessions();  break;
    case 'attendance': await renderAttendance();break;
    case 'quizzes':    await renderQuizzes();   break;
    case 'whatsapp':   await renderWhatsApp();  break;
    case 'users':      await renderUsers();     break;
    case 'backup':     await renderBackup();    break;
    case 'reports':    await renderReports();   break;
    case 'barcodes':   renderBarcodes();        break;
    case 'payments':   await renderPayments();  break;
    case 'import':     await renderImport();    break;
  }
}

document.querySelectorAll('.nav-item[data-page]').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.page));
});

// ── Auth ─────────────────────────────────────────────────────────────────────
document.getElementById('toggle-password').addEventListener('click', () => {
  const inp = document.getElementById('login-password');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  const res = await window.api.auth.login({ username, password });
  if (!res.success) {
    errEl.textContent = res.message;
    errEl.classList.remove('hidden');
    return;
  }
  State.user = res.user;
  document.getElementById('sidebar-user-name').textContent = res.user.name;
  document.getElementById('user-avatar-char').textContent = res.user.name[0].toUpperCase();
  const roleBadge = document.getElementById('sidebar-user-role');
  roleBadge.textContent = res.user.role;
  roleBadge.className = `user-role badge ${res.user.role === 'admin' ? 'badge-accent' : 'badge-purple'}`;

  // Show admin-only nav
  const isAdmin = res.user.role === 'admin';
  document.getElementById('admin-section').style.display = isAdmin ? '' : 'none';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? 'flex' : 'none';
  });

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  navigate('dashboard');

  // Phase 1: Check for default credentials and show warning banner (admins only)
  if (isAdmin) {
    try {
      const credCheck = await window.api.system.hasDefaultCredentials();
      const banner = document.getElementById('default-creds-banner');
      if (credCheck.hasDefault && banner) {
        banner.classList.remove('hidden');
        const changePwBtn = document.getElementById('default-creds-change-btn');
        if (changePwBtn) {
          changePwBtn.addEventListener('click', () => {
            // Navigate to Users page and open password change modal for current user
            navigate('users');
            // Small delay to ensure the page renders first
            setTimeout(() => changePassword(State.user.id, State.user.name), 300);
          });
        }
      } else if (banner) {
        banner.classList.add('hidden');
      }
    } catch (e) {
      console.error('Failed to check default credentials:', e);
    }
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  State.user = null;
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
});

// ── Title Bar Controls ───────────────────────────────────────────────────────
document.getElementById('btn-minimize').addEventListener('click', () => window.api.window.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => window.api.window.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.api.window.close());

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}
function el(id) { return document.getElementById(id); }
function confirmAction(msg) { return window.confirm(msg); }

// On Startup, check for data integrity issues, then setup state
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Step 1: Data integrity check (takes priority over everything)
    const corrupted = await window.api.system.getCorruptedFiles();
    if (corrupted && corrupted.length > 0) {
      // Hide all standard screens
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app-screen').classList.add('hidden');
      document.getElementById('setup-screen').classList.add('hidden');

      // Display Recovery Screen
      const recoveryScreen = document.getElementById('recovery-screen');
      recoveryScreen.classList.remove('hidden');

      // List corrupted files
      const listEl = document.getElementById('corrupted-files-list');
      listEl.innerHTML = corrupted.map(f => `<li>${f}</li>`).join('');

      // Recovery Action Handlers
      document.getElementById('recovery-btn-restore').addEventListener('click', async () => {
        const res = await window.api.backup.import();
        if (res.success) {
          toast('Backup restored successfully!', 'success');
          // Wait briefly for the toast to be seen before relaunching
          setTimeout(() => {
            window.api.system.relaunch();
          }, 1500);
        } else if (!res.canceled) {
          toast(`Restore failed: ${res.error}`, 'error');
        }
      });

      document.getElementById('recovery-btn-reset').addEventListener('click', async () => {
        if (window.confirm('Are you absolutely sure you want to reset all corrupted files? This will delete all existing data in those files and recreate them as empty tables. This action CANNOT be undone!')) {
          const res = await window.api.system.resetCorruptedFiles();
          if (res.success) {
            toast('Corrupted files have been reset successfully.', 'success');
            setTimeout(() => {
              window.api.system.relaunch();
            }, 1500);
          } else {
            toast(`Reset failed: ${res.error}`, 'error');
          }
        }
      });

      document.getElementById('recovery-btn-quit').addEventListener('click', () => {
        window.api.system.quit();
      });
      return; // Stop here — do not proceed to setup or login
    }

    // Step 2: First-run setup wizard check (Phase 1)
    try {
      const setupState = await window.api.system.getSetupState();
      if (setupState && setupState.needsSetup) {
        if (typeof window.initSetupWizard === 'function') {
          window.initSetupWizard();
        }
        return; // Stop here — wizard handles the rest
      }
    } catch (setupErr) {
      console.error('Failed to check setup state:', setupErr);
      // Non-fatal: fall through to normal login
    }

  } catch (err) {
    console.error('Failed to run startup data integrity check:', err);
  }
});


// ── EduTrack Update Notification UI ─────────────────────────────────────────

(function () {
  /**
   * Simple markdown parser for release notes
   */
  function formatReleaseNotes(raw) {
    if (!raw || !raw.trim()) {
      return '<p class="text-secondary" style="font-size:13px;font-style:italic;">No detailed release notes provided.</p>';
    }

    const lines = raw.split('\n');
    let html = '';
    let inList = false;

    for (let line of lines) {
      let trimmed = line.trim();
      if (!trimmed) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        continue;
      }

      // Headers (### or ## or #)
      if (/^#{1,4}\s+/.test(trimmed)) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        const text = trimmed.replace(/^#{1,4}\s+/, '');
        html += `<h4 class="update-notes-heading">${escapeHtml(text)}</h4>`;
        continue;
      }

      // Unordered list items (- or *)
      if (/^[-*]\s+/.test(trimmed)) {
        if (!inList) {
          html += '<ul class="update-notes-list">';
          inList = true;
        }
        const text = trimmed.replace(/^[-*]\s+/, '');
        html += `<li>${formatInlineStyles(text)}</li>`;
        continue;
      }

      // Standard paragraph
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p class="update-notes-p">${formatInlineStyles(trimmed)}</p>`;
    }

    if (inList) {
      html += '</ul>';
    }

    return html;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatInlineStyles(str) {
    let escaped = escapeHtml(str);
    // Bold: **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Code: `code`
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="update-code">$1</code>');
    return escaped;
  }

  /**
   * Display the Update Available Modal
   */
  window.showUpdateModal = function (info) {
    const formattedNotes = formatReleaseNotes(info.releaseNotes);
    const dateFormatted = info.publishedAt
      ? new Date(info.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : '';

    const body = `
      <div class="update-modal-content">
        <div class="update-modal-header-visual">
          <div class="update-badge-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <div>
            <h3 class="update-title">New Update Available!</h3>
            <p class="update-subtitle">A newer version of EduTrack is ready for download.</p>
          </div>
        </div>

        <div class="update-version-card">
          <div class="update-version-pill current">
            <span class="pill-label">Current Version</span>
            <span class="pill-val">v${escapeHtml(info.currentVersion || '1.0.0')}</span>
          </div>
          <div class="update-version-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </div>
          <div class="update-version-pill latest">
            <span class="pill-label">New Version</span>
            <span class="pill-val">v${escapeHtml(info.latestVersion)}</span>
          </div>
        </div>

        ${dateFormatted ? `<div class="update-release-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Released on ${dateFormatted}</div>` : ''}

        <div class="update-notes-container">
          <div class="update-notes-title">What's New in this release:</div>
          <div class="update-notes-body custom-scrollbar">
            ${formattedNotes}
          </div>
        </div>
      </div>
    `;

    const downloadUrl = (info.downloadUrl || info.htmlUrl || '').replace(/'/g, "\\'");

    const footer = `
      <button type="button" class="btn btn-secondary" onclick="closeModal()" id="btn-update-later">
        Later
      </button>
      <button type="button" class="btn btn-primary btn-glow" onclick="window.downloadAppUpdate('${downloadUrl}')" id="btn-update-now">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:6px;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Download Now
      </button>
    `;

    openModal({
      title: 'Software Update',
      body,
      footer,
      wide: true,
    });
  };

  /**
   * Action handler to open download URL and optionally close modal
   */
  window.downloadAppUpdate = async function (url) {
    try {
      if (window.api?.updates?.openDownload) {
        await window.api.updates.openDownload(url);
      } else if (window.api?.system?.openExternal) {
        await window.api.system.openExternal(url);
      }
      toast('Opening download link in your browser...', 'info');
      closeModal();
    } catch (err) {
      console.error('Failed to open download link:', err);
      toast('Failed to open download link: ' + err.message, 'error');
    }
  };

  /**
   * Manual check triggered by user button
   */
  window.checkForUpdatesManual = async function () {
    if (!window.api?.updates?.checkForUpdates) {
      toast('Update service is unavailable in this environment', 'error');
      return;
    }

    if (navigator.onLine === false) {
      toast('You are currently offline. Please check your internet connection.', 'error');
      return;
    }

    toast('Checking for updates...', 'info');
    try {
      const res = await window.api.updates.checkForUpdates();
      if (!res || !res.success) {
        toast(`Could not check updates: ${res?.error || 'No internet connection'}`, 'error');
        return;
      }

      if (res.updateAvailable) {
        window.showUpdateModal(res);
      } else {
        toast(`You are already running the latest version (v${res.currentVersion || '1.0.0'})!`, 'success');
      }
    } catch (err) {
      console.error('Error during manual update check:', err);
      toast('Failed to check for updates: ' + err.message, 'error');
    }
  };

  /**
   * Automatic background check on startup
   */
  async function performStartupCheck() {
    if (!window.api?.updates?.checkForUpdates) return;
    if (navigator.onLine === false) return; // Skip silently if offline on startup

    try {
      // Delay check slightly so startup rendering and data validation complete smoothly
      await new Promise(r => setTimeout(r, 2500));

      const res = await window.api.updates.checkForUpdates();
      if (res && res.success && res.updateAvailable) {
        window.showUpdateModal(res);
      }
    } catch (err) {
      // Silent failure on startup so user is not interrupted if offline
      console.warn('[Updater] Background startup check encountered an error:', err.message);
    }
  }

  // Check on startup
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', performStartupCheck);
  } else {
    performStartupCheck();
  }

  // Also check automatically when internet connectivity is restored
  window.addEventListener('online', () => {
    performStartupCheck();
  });
})();

// ── About & Contact Us ─────────────────────────────────────────────────────

function getContactIcon(label) {
  const key = (label || '').toLowerCase();
  if (key.includes('whatsapp')) {
    return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  }
  if (key.includes('github')) {
    return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>';
  }
  if (key.includes('facebook')) {
    return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';
  }
  if (key.includes('linkedin')) {
    return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
}

window.openDeveloperLink = async function(url) {
  if (!url) return;
  const res = await window.api.system.openExternal(url);
  if (res && !res.success) toast(res.error || 'Could not open link', 'error');
};

async function renderContact() {
  const info = DEVELOPER_INFO;
  let appInfo = { name: 'EduTrack', version: '1.0.0' };
  try {
    appInfo = await window.api.system.getAppInfo();
  } catch (_) {}

  const initial = (info.name || 'D')[0].toUpperCase();
  const hasEmail = info.email && !info.email.includes('example.com');
  const hasPhone = info.phone && !info.phone.includes('000 0000');

  const contactRows = [
    hasEmail ? { label: 'Email', value: info.email, action: `mailto:${info.email}`, icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' } : null,
    hasPhone ? { label: 'Phone', value: info.phone, action: `tel:${info.phone.replace(/\s/g, '')}`, icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' } : null,
    info.supportHours ? { label: 'Support Hours', value: info.supportHours, action: '', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' } : null,
  ].filter(Boolean);

  const linkCards = (info.links || []).map(link => `
    <button type="button" class="contact-link-card" onclick="openDeveloperLink('${link.url.replace(/'/g, "\\'")}')">
      <div class="contact-link-icon" style="color:${link.color || 'var(--accent)'}">${getContactIcon(link.label)}</div>
      <div class="contact-link-text">
        <strong>${link.label}</strong>
        <span>${link.description || 'Open link'}</span>
      </div>
      <svg class="contact-link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </button>
  `).join('');

  el('page-contact').innerHTML = `
    <div class="page-header">
      <div>
        <h2>Contact Us</h2>
        <p class="page-header-sub">Support, licensing, and product questions</p>
      </div>
    </div>

    <div class="contact-layout">
      <div class="card contact-profile-card">
        <div class="contact-profile-header">
          <div class="contact-avatar">${initial}</div>
          <div>
            <h3>${info.name}</h3>
            <p>${info.title}</p>
          </div>
        </div>
        <p class="contact-bio">${info.bio}</p>
        <div class="contact-app-meta">
          <span class="badge badge-accent">${appInfo.name} v${appInfo.version}</span>
        </div>
        ${appInfo.isTrial ? `
          <div class="trial-upgrade-banner" style="margin-top:16px; padding:14px; background:rgba(239,68,68,0.05); border:1px solid var(--red); border-radius:var(--radius-md);">
            <h4 style="color:var(--red); margin-bottom:4px; font-weight:700;">نسخة تجريبية (محدودة بـ 15 طالب)</h4>
            <p style="color:var(--text-secondary); font-size:12.5px; line-height:1.5; margin-bottom:12px;">
              بعض الميزات مثل النسخ الاحتياطي وتصدير البيانات إلى إكسل مقفلة، والحد الأقصى للطلاب هو 15 طالب فقط.
            </p>
            <button type="button" class="btn btn-sm btn-primary" onclick="openDeveloperLink('https://wa.me/201127718933?text=أريد شراء النسخة الكاملة من برنامج EduTrack')" style="background:var(--red); border-color:var(--red); color:white;">
              شراء النسخة الكاملة وتفعيل البرنامج
            </button>
          </div>
        ` : ''}
      </div>

      <div class="contact-details">
        ${contactRows.length ? `
          <div class="card">
            <div class="card-header"><span class="card-title">Direct Contact</span></div>
            <div class="card-body contact-rows">
              ${contactRows.map(row => `
                <div class="contact-row">
                  <div class="contact-row-icon">${row.icon}</div>
                  <div class="contact-row-content">
                    <span class="contact-row-label">${row.label}</span>
                    ${row.action
                      ? `<button type="button" class="contact-row-value contact-row-link" onclick="openDeveloperLink('${row.action.replace(/'/g, "\\'")}')">${row.value}</button>`
                      : `<span class="contact-row-value">${row.value}</span>`}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${linkCards ? `
          <div class="card" style="margin-top:16px">
            <div class="card-header"><span class="card-title">Connect Online</span></div>
            <div class="card-body contact-links-grid">${linkCards}</div>
          </div>
        ` : `
          <div class="card" style="margin-top:16px">
            <div class="card-body" style="color:var(--text-secondary);font-size:13px;line-height:1.6">
              Add your WhatsApp, Facebook, GitHub, and other links in <code>renderer/developer-info.js</code> before distributing the app.
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

window.showContactModal = function() {
  const info = DEVELOPER_INFO;
  const hasEmail = info.email && !info.email.includes('example.com');
  const hasPhone = info.phone && !info.phone.includes('000 0000');
  const links = (info.links || []).map(link =>
    `<button type="button" class="btn btn-secondary btn-sm" style="margin:4px" onclick="openDeveloperLink('${link.url.replace(/'/g, "\\'")}')">${link.label}</button>`
  ).join('');

  openModal({
    title: 'Contact Developer',
    body: `
      <div style="text-align:center;margin-bottom:16px">
        <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;margin-bottom:10px">${(info.name || 'D')[0].toUpperCase()}</div>
        <div style="font-size:18px;font-weight:700">${info.name}</div>
        <div style="color:var(--text-secondary);font-size:13px;margin-top:4px">${info.title}</div>
      </div>
      <p style="color:var(--text-secondary);font-size:13px;line-height:1.6;margin-bottom:16px">${info.bio}</p>
      ${hasEmail ? `<div style="margin-bottom:10px"><span style="color:var(--text-muted);font-size:12px">Email</span><br><button type="button" class="contact-row-link" onclick="openDeveloperLink('mailto:${info.email.replace(/'/g, "\\'")}')">${info.email}</button></div>` : ''}
      ${hasPhone ? `<div style="margin-bottom:10px"><span style="color:var(--text-muted);font-size:12px">Phone</span><br><button type="button" class="contact-row-link" onclick="openDeveloperLink('tel:${info.phone.replace(/\s/g, '').replace(/'/g, "\\'")}')">${info.phone}</button></div>` : ''}
      ${info.supportHours ? `<div style="margin-bottom:10px"><span style="color:var(--text-muted);font-size:12px">Support Hours</span><br><span>${info.supportHours}</span></div>` : ''}
      ${links ? `<div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:4px">${links}</div>` : ''}
    `,
    footer: '<button class="btn btn-secondary" onclick="closeModal()">Close</button>',
  });
};

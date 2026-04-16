(() => {
  function ensureStyles() {
    if (document.getElementById('profileUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'profileUiStyles';
    style.textContent = `
      .profile-ovl {
        position: fixed;
        inset: 0;
        background:
          radial-gradient(circle at top right, rgba(251, 191, 36, .15), transparent 28%),
          radial-gradient(circle at bottom left, rgba(59, 130, 246, .14), transparent 26%),
          rgba(15, 23, 42, .52);
        backdrop-filter: blur(12px);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1400;
        padding: 20px;
      }
      .profile-ovl.open { display: flex; }
      .profile-card {
        width: min(760px, 100%);
        max-height: 88vh;
        overflow: auto;
        background:
          linear-gradient(145deg, rgba(255,255,255,.96), rgba(248,250,252,.94));
        border-radius: 28px;
        box-shadow: 0 30px 80px rgba(15, 23, 42, .24);
        border: 1px solid rgba(255, 255, 255, .45);
        position: relative;
      }
      .profile-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at top right, rgba(251,191,36,.18), transparent 24%),
          radial-gradient(circle at bottom left, rgba(59,130,246,.12), transparent 26%);
        pointer-events: none;
      }
      .profile-head {
        padding: 24px 24px 16px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 1px solid rgba(148, 163, 184, .16);
        position: relative;
        z-index: 1;
      }
      .profile-title {
        font-size: 1.3rem;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -.02em;
      }
      .profile-sub {
        margin-top: 4px;
        color: #64748b;
        font-size: .82rem;
      }
      .profile-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        padding: 7px 12px;
        border-radius: 999px;
        font-size: .72rem;
        font-weight: 800;
        letter-spacing: .02em;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.35);
      }
      .profile-status.normal { background: #e2e8f0; color: #334155; }
      .profile-status.elite { background: #dbeafe; color: #1d4ed8; }
      .profile-status.gold { background: #fef3c7; color: #b45309; }
      .profile-status.platinum { background: #ede9fe; color: #6d28d9; }
      .profile-close {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1px solid rgba(148, 163, 184, .25);
        background: rgba(255,255,255,.75);
        cursor: pointer;
      }
      .profile-body {
        padding: 22px 24px;
        display: grid;
        grid-template-columns: 1.1fr 1fr;
        gap: 20px;
        position: relative;
        z-index: 1;
      }
      .profile-panel {
        background: rgba(255,255,255,.75);
        border: 1px solid rgba(148, 163, 184, .16);
        border-radius: 18px;
        padding: 18px;
      }
      .profile-label {
        font-size: .7rem;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: #64748b;
        margin-bottom: 6px;
      }
      .profile-value {
        color: #0f172a;
        font-size: .88rem;
        line-height: 1.5;
        word-break: break-word;
        margin-bottom: 10px;
      }
      .profile-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .profile-form input,
      .profile-form textarea {
        width: 100%;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, .26);
        background: rgba(255,255,255,.88);
        font: inherit;
        color: #0f172a;
        transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
      }
      .profile-form input:focus,
      .profile-form textarea:focus {
        outline: none;
        border-color: rgba(59, 130, 246, .55);
        box-shadow: 0 0 0 4px rgba(59, 130, 246, .12);
        transform: translateY(-1px);
      }
      .profile-form textarea {
        min-height: 102px;
        resize: vertical;
      }
      .profile-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 0 24px 24px;
        position: relative;
        z-index: 1;
      }
      .profile-btn {
        padding: 10px 16px;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, .22);
        background: rgba(255,255,255,.82);
        cursor: pointer;
        font-weight: 700;
        transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
      }
      .profile-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 18px rgba(15, 23, 42, .08);
      }
      .profile-btn.primary {
        background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
        color: #fff;
        border-color: transparent;
      }
      .profile-msg {
        padding: 0 24px 12px;
        color: #1d4ed8;
        font-size: .8rem;
        position: relative;
        z-index: 1;
      }
      @media (max-width: 760px) {
        .profile-body { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function statusClass(status) {
    return String(status || 'normal').toLowerCase();
  }

  function profileHtml(user) {
    const profile = user.profile || {};
    return `
      <div class="profile-head">
        <div>
          <div class="profile-title">${LibraryApp.escapeHtml(user.user_name)}</div>
          <div class="profile-sub">${LibraryApp.escapeHtml(user.email)} · ${LibraryApp.escapeHtml(user.userId)} · ${LibraryApp.escapeHtml(user.role)}</div>
          <div class="profile-status ${statusClass(user.profileStatus)}">Profile Status: ${LibraryApp.escapeHtml(user.profileStatus || 'Normal')}</div>
        </div>
        <button class="profile-close" type="button" aria-label="Close">✕</button>
      </div>
      <div class="profile-body">
        <div class="profile-panel">
          <div class="profile-label">Account Details</div>
          <div class="profile-value"><strong>Department:</strong> ${LibraryApp.escapeHtml(user.dept || '-')}</div>
          <div class="profile-value"><strong>Phone:</strong> ${LibraryApp.escapeHtml(user.phone || '-')}</div>
          <div class="profile-value"><strong>Joined:</strong> ${LibraryApp.formatDate(user.joined)}</div>
          <div class="profile-value"><strong>LinkedIn:</strong> ${LibraryApp.escapeHtml(profile.linkedin || '-')}</div>
          <div class="profile-value"><strong>Portfolio:</strong> ${LibraryApp.escapeHtml(profile.portfolio || '-')}</div>
          <div class="profile-label" style="margin-top:16px">My Goal</div>
          <div class="profile-value">${LibraryApp.escapeHtml(profile.goalText || 'No goal added yet.')}</div>
          <div class="profile-label" style="margin-top:16px">Motivational Words</div>
          <div class="profile-value">${LibraryApp.escapeHtml(profile.motivationalWords || 'No motivational words added yet.')}</div>
        </div>
        <div class="profile-panel">
          <div class="profile-label">Edit My Profile</div>
          <form class="profile-form" id="profileForm">
            <input id="profileLinkedin" placeholder="LinkedIn URL" value="${LibraryApp.escapeHtml(profile.linkedin || '')}">
            <input id="profilePortfolio" placeholder="Portfolio URL" value="${LibraryApp.escapeHtml(profile.portfolio || '')}">
            <textarea id="profileGoal" placeholder="Write your current goal">${LibraryApp.escapeHtml(profile.goalText || '')}</textarea>
            <textarea id="profileMotivation" placeholder="Add motivational words for your profile">${LibraryApp.escapeHtml(profile.motivationalWords || '')}</textarea>
          </form>
        </div>
      </div>
      <div class="profile-msg" id="profileSaveMsg"></div>
      <div class="profile-actions">
        <button class="profile-btn" type="button" id="profileLogoutBtn">Logout</button>
        <button class="profile-btn" type="button" id="profileCancelBtn">Cancel</button>
        <button class="profile-btn primary" type="button" id="profileSaveBtn">Save Profile</button>
      </div>
    `;
  }

  async function openProfileModal() {
    ensureStyles();
    const payload = await LibraryApp.request('/api/profile');
    const user = payload.user;
    let overlay = document.getElementById('profileOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'profileOverlay';
      overlay.className = 'profile-ovl';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `<div class="profile-card">${profileHtml(user)}</div>`;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    function close() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    }, { once: true });
    overlay.querySelector('.profile-close').onclick = close;
    overlay.querySelector('#profileCancelBtn').onclick = close;
    overlay.querySelector('#profileLogoutBtn').onclick = async () => {
      await LibraryApp.logout();
    };
    overlay.querySelector('#profileSaveBtn').onclick = async () => {
      const msg = overlay.querySelector('#profileSaveMsg');
      try {
        const saved = await LibraryApp.request('/api/profile', {
          method: 'PATCH',
          body: JSON.stringify({
            linkedin: overlay.querySelector('#profileLinkedin').value.trim(),
            portfolio: overlay.querySelector('#profilePortfolio').value.trim(),
            goalText: overlay.querySelector('#profileGoal').value.trim(),
            motivationalWords: overlay.querySelector('#profileMotivation').value.trim(),
          }),
        });
        msg.textContent = 'Profile updated successfully.';
        const updatedUser = saved.user;
        const nameNode = document.querySelector('.sb-uname, .sb-user-name');
        const roleNode = document.querySelector('.sb-urole, .sb-user-role');
        const avatarNode = document.querySelector('.sb-av, .sb-avatar');
        if (nameNode) nameNode.textContent = updatedUser.user_name;
        if (roleNode) roleNode.textContent = roleNode.classList.contains('sb-user-role') ? updatedUser.role : `${updatedUser.userId} · ${updatedUser.dept}`;
        if (avatarNode) avatarNode.textContent = LibraryApp.initials(updatedUser.user_name);
        setTimeout(close, 700);
      } catch (error) {
        msg.textContent = error.message || 'Unable to save profile.';
      }
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const profileBar = document.querySelector('.sb-user');
    if (!profileBar) return;
    profileBar.onclick = async (event) => {
      event.preventDefault();
      try {
        await openProfileModal();
      } catch (error) {
        alert(error.message || 'Unable to load profile.');
      }
    };
  });
})();



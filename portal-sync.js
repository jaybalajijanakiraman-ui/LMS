(() => {
  const pageName = window.location.pathname.split('/').pop();
  const expectedRole = pageName === 'faculty.html' ? 'Faculty' : pageName === 'librarian.html' ? 'Librarian' : 'Student';

  function setText(selector, value, index = 0) {
    const nodes = document.querySelectorAll(selector);
    if (nodes[index]) nodes[index].textContent = value;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setHtml(id, html) {
    const node = byId(id);
    if (node) node.innerHTML = html;
  }

  function setValue(id, value) {
    const node = byId(id);
    if (node) node.textContent = value;
  }

  function ensureNotificationStyles() {
    if (byId('liveNotificationStyles')) return;
    const style = document.createElement('style');
    style.id = 'liveNotificationStyles';
    style.textContent = `
      .live-notif-pop {
        position: fixed;
        top: 76px;
        right: 24px;
        width: min(380px, calc(100vw - 24px));
        max-height: min(70vh, 560px);
        overflow: auto;
        background: rgba(255,255,255,.98);
        border: 1px solid rgba(15,23,42,.12);
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(15,23,42,.18);
        padding: 14px;
        z-index: 1200;
        display: none;
      }
      .live-notif-pop.open { display: block; }
      .live-notif-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .live-notif-title {
        font-size: .95rem;
        font-weight: 700;
        color: #0f172a;
      }
      .live-notif-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .live-notif-item {
        display: flex;
        gap: 10px;
        padding: 12px;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid rgba(148,163,184,.22);
      }
      .live-notif-item.important {
        background: #fff7ed;
        border-color: rgba(249,115,22,.28);
      }
      .live-notif-item.persistent {
        box-shadow: inset 0 0 0 1px rgba(239,68,68,.12);
      }
      .live-notif-icon {
        width: 34px;
        height: 34px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        background: white;
      }
      .live-notif-body {
        min-width: 0;
        flex: 1;
      }
      .live-notif-text {
        font-size: .83rem;
        line-height: 1.45;
        color: #0f172a;
      }
      .live-notif-meta {
        margin-top: 4px;
        font-size: .72rem;
        color: #64748b;
      }
      .live-notif-pill {
        margin-top: 8px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 9px;
        border-radius: 999px;
        font-size: .68rem;
        font-weight: 700;
        background: #fee2e2;
        color: #b91c1c;
      }
      .live-notif-empty {
        padding: 20px 12px;
        text-align: center;
        color: #64748b;
        font-size: .82rem;
      }
      .live-notif-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1190;
        display: none;
      }
      .live-notif-backdrop.open { display: block; }
    `;
    document.head.appendChild(style);
  }

  function installNotificationCenter(notifications) {
    ensureNotificationStyles();

    const bellButton = document.querySelector('.tb-btn[title="Notifications"], .topbar-btn[title="Notifications"], .tb-btn');
    if (!bellButton) return;

    const existingPop = byId('liveNotificationPopup');
    const existingBackdrop = byId('liveNotificationBackdrop');
    if (existingPop) existingPop.remove();
    if (existingBackdrop) existingBackdrop.remove();

    const popup = document.createElement('div');
    popup.id = 'liveNotificationPopup';
    popup.className = 'live-notif-pop';

    const backdrop = document.createElement('div');
    backdrop.id = 'liveNotificationBackdrop';
    backdrop.className = 'live-notif-backdrop';

    const importantCount = notifications.filter((item) => item.important).length;
    popup.innerHTML = `
      <div class="live-notif-head">
        <div class="live-notif-title">Notifications</div>
        <button type="button" style="border:0;background:transparent;font-size:1rem;cursor:pointer;color:#64748b" aria-label="Close">✕</button>
      </div>
      <div style="font-size:.73rem;color:#64748b;margin-bottom:10px">${importantCount} important alert${importantCount === 1 ? '' : 's'}</div>
      <div class="live-notif-list">
        ${notifications.length ? notifications.map((item) => `
          <div class="live-notif-item ${item.important ? 'important' : ''} ${item.persistent ? 'persistent' : ''}">
            <div class="live-notif-icon">${item.icon}</div>
            <div class="live-notif-body">
              <div class="live-notif-text">${LibraryApp.escapeHtml(item.text)}</div>
              <div class="live-notif-meta">${LibraryApp.escapeHtml(item.ts || '')}</div>
              ${item.persistent ? `<div class="live-notif-pill">Persistent alert · Updates every login</div>` : ''}
            </div>
          </div>
        `).join('') : '<div class="live-notif-empty">No notifications right now.</div>'}
      </div>
    `;

    function closePopup() {
      popup.classList.remove('open');
      backdrop.classList.remove('open');
    }

    function togglePopup(event) {
      if (event) event.preventDefault();
      const open = popup.classList.contains('open');
      if (open) closePopup();
      else {
        popup.classList.add('open');
        backdrop.classList.add('open');
      }
    }

    popup.querySelector('button').addEventListener('click', closePopup);
    backdrop.addEventListener('click', closePopup);
    bellButton.onclick = togglePopup;
    bellButton.setAttribute('title', 'Notifications');

    document.body.appendChild(backdrop);
    document.body.appendChild(popup);

    if (importantCount > 0) {
      setTimeout(() => {
        popup.classList.add('open');
        backdrop.classList.add('open');
      }, 350);
    }
  }

  function renderStudent(data) {
    const user = data.user;
    const books = data.books || [];
    const transactions = data.transactions || [];
    const currentBooks = data.currentBooks || [];
    let discoverCategory = '';
    window.__portalSyncData = data;
    window.__renderStudentPortal = renderStudent;

    const formatRupees = (amount) => `\u20B9${Number(amount || 0).toFixed(0)}`;
    const dayLabel = (item) => {
      if (Number(item.dayDiff) < 0) return `${Math.abs(item.dayDiff)}d overdue`;
      if (Number(item.dayDiff) === 0) return 'Due today';
      return `${item.dayDiff}d left`;
    };

    setText('.sb-uname', user.user_name);
    setText('.sb-urole', `${user.userId} · ${user.dept}`);
    setText('.wb-name em', user.user_name);
    setText('.id-num', user.userId, 0);
    setText('.id-modal-name', user.user_name);
    setText('.id-modal-roll', `${user.userId} · ${user.dept}`);
    setText('.id-modal-num', `${user.userId}-${(user.dept || 'LIB').replace(/\s+/g, '').slice(0, 6).toUpperCase()}`);

    document.querySelectorAll('.scard-num')[0].textContent = String(data.stats.booksIssued || 0);
    document.querySelectorAll('.scard-num')[1].textContent = String(data.stats.dueSoon || 0);
    document.querySelectorAll('.scard-num')[2].textContent = '0';
    document.querySelectorAll('.scard-num')[3].textContent = String(data.stats.pendingFines || 0);

    if (byId('activityIssuedCount')) byId('activityIssuedCount').textContent = `${currentBooks.length} book${currentBooks.length === 1 ? '' : 's'} issued`;
    if (byId('idCardIssuedCount')) byId('idCardIssuedCount').textContent = `${currentBooks.length}/3`;
    if (byId('idCardStatus')) {
      byId('idCardStatus').textContent = user.profileStatus || 'Normal';
      byId('idCardStatus').style.color = Number(data.stats.pendingFines || 0) > 0 ? 'var(--rose)' : 'var(--emerald)';
    }

    const importantNotifications = (data.notifications || []).filter((item) => item.important);
    const alertBanners = byId('alertBanners');
    if (alertBanners) {
      alertBanners.innerHTML = importantNotifications.length
        ? importantNotifications.map((item) => `
          <div class="alert-band warn">
            <span class="ab-ico">${item.icon}</span>
            <span class="ab-msg">${LibraryApp.escapeHtml(item.text)}</span>
            <div class="ab-actions">
              <button class="btn btn-sm btn-rose" onclick="document.querySelector('.tb-btn[title=&quot;Notifications&quot;]')?.click()">View Alert</button>
            </div>
          </div>
        `).join('')
        : '';
    }

    byId('currentBooksCarousel').innerHTML = currentBooks.length
      ? currentBooks.map((item) => `
        <div class="book-card" onclick="openBookDetail('${String(item.bookId || item.id)}')">
          ${LibraryApp.renderBookCover(item, { className: 'book-cover' })}
          <div class="book-info">
            <div class="book-title">${LibraryApp.escapeHtml(item.bookTitle)}</div>
            <div class="book-author">${LibraryApp.escapeHtml(item.author || '')}</div>
            <div class="book-progress-wrap">
              <div class="bp-meta"><span style="color:${item.isOverdue ? 'var(--rose)' : 'var(--amber)'};font-weight:700">${dayLabel(item)}</span></div>
              <div class="bp-bar"><div class="bp-fill" style="width:100%;background:${item.isOverdue ? 'var(--rose)' : 'var(--violet)'}"></div></div>
            </div>
          </div>
        </div>
      `).join('')
      : `<div class="book-card" style="display:flex;align-items:center;justify-content:center;min-width:220px"><div style="padding:22px;text-align:center;color:var(--txt-3)">No books issued yet.</div></div>`;

    byId('recList').innerHTML = (data.recommendations || []).slice(0, 4).map((book) => `
      <div class="rec-card">
        ${LibraryApp.renderBookCover(book, { className: 'rec-cover' })}
        <div style="flex:1">
          <div class="rec-why">Shared catalog</div>
          <div class="rec-title">${LibraryApp.escapeHtml(book.title)}</div>
          <div class="rec-author">${LibraryApp.escapeHtml(book.author)}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();requestBook('${String(book.id)}')">Reserve</button>
      </div>
    `).join('') || '<div style="color:var(--txt-3)">No recommendations yet.</div>';

    const renderTimeline = (targetId) => {
      byId(targetId).innerHTML = (data.notifications || []).map((item) => `
        <div class="tline-item">
          <div class="tline-dot ${item.unread ? 'unread' : ''}">${item.icon}</div>
          <div class="tline-body">
            <div class="tline-msg">${LibraryApp.escapeHtml(item.text)}</div>
            <div class="tline-meta">${LibraryApp.escapeHtml(item.ts)}</div>
          </div>
        </div>
      `).join('');
    };

    renderTimeline('dashTimeline');
    renderTimeline('fullTimeline');
    installNotificationCenter(data.notifications || []);

    setHtml('issuedTbody', currentBooks.length
      ? currentBooks.map((item, index) => `
        <tr>
          <td><div style="font-weight:600;font-size:.82rem;color:var(--ink)">${LibraryApp.escapeHtml(item.bookTitle)}</div><div style="font-size:.7rem;color:var(--txt-4)">${LibraryApp.escapeHtml(item.author || '')}</div></td>
          <td>${LibraryApp.escapeHtml(item.checkout || '-')}</td>
          <td>${LibraryApp.escapeHtml(item.due || '-')}</td>
          <td><span style="background:${item.isOverdue ? 'var(--rose-bg)' : 'var(--emerald-bg)'};color:${item.isOverdue ? 'var(--rose)' : 'var(--emerald)'};padding:3px 9px;border-radius:99px;font-size:.7rem;font-weight:700">${dayLabel(item)}</span></td>
          <td style="display:flex;gap:6px;padding-top:9px">
            <button class="btn btn-outline btn-sm" onclick="openRenew(${index})">Renew</button>
            <button class="btn btn-sm" style="background:var(--rose-bg);color:var(--rose);border:1px solid rgba(244,63,94,.2)" onclick="toast('info','Return the book at the library desk.','INFO')">Return</button>
          </td>
        </tr>
      `).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--txt-3)">No issued books in the database yet.</td></tr>');

    const returnedTransactions = transactions.filter((item) => item.returned);
    setHtml('historyTbody', returnedTransactions.length
      ? returnedTransactions.map((item) => `
        <tr>
          <td><div style="font-weight:600;font-size:.82rem;color:var(--ink)">${LibraryApp.escapeHtml(item.bookTitle || '-')}</div><div style="font-size:.7rem;color:var(--txt-4)">${LibraryApp.escapeHtml(item.author || '')}</div></td>
          <td>${LibraryApp.escapeHtml(item.checkout || '-')}</td>
          <td>${LibraryApp.escapeHtml(item.returned || '-')}</td>
          <td style="font-weight:700;color:${Number(item.fine || 0) > 0 ? 'var(--rose)' : 'var(--emerald)'}">${formatRupees(item.fine || 0)}</td>
          <td>${LibraryApp.escapeHtml(item.status || 'Returned')}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--txt-3)">No borrowing history in the database yet.</td></tr>');

    const fineTransactions = transactions.filter((item) => Number(item.fine || 0) > 0);
    setHtml('payHistoryTbody', fineTransactions.length
      ? fineTransactions.map((item) => `
        <tr>
          <td style="font-size:.78rem;color:var(--txt-3)">${LibraryApp.escapeHtml(item.returned || item.checkout || '-')}</td>
          <td style="font-size:.82rem;font-weight:600;color:var(--ink)">${LibraryApp.escapeHtml(item.bookTitle || '-')}</td>
          <td style="font-size:.78rem;color:var(--txt-3)">${item.returned ? 'Returned late' : 'Active fine'}</td>
          <td style="font-size:.82rem;font-weight:700;color:var(--rose)">${formatRupees(item.fine || 0)}</td>
          <td style="font-size:.76rem;color:var(--txt-3)">${item.returned ? 'Library desk' : 'Pending'}</td>
          <td style="font-size:.76rem;color:${item.returned ? 'var(--emerald)' : 'var(--rose)'}">${item.returned ? 'Paid' : 'Pending'}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--txt-3)">No fine records in the database yet.</td></tr>');

    setHtml('spinesRow', [...currentBooks, ...returnedTransactions].slice(0, 8).map((item, index) => `
      <div class="spine ${item.isOverdue ? 'overdue' : ''}" style="height:${88 + (index % 4) * 10}px;background:${['#1e3a8a', '#065f46', '#7c2d12', '#4c1d95'][index % 4]}">
        <span>${LibraryApp.escapeHtml((item.bookTitle || '').slice(0, 18) || 'Book')}</span>
      </div>
    `).join('') || '<div style="padding:18px;color:var(--txt-3)">No books on your database shelf yet.</div>');

    window.setDiscoverCat = function setDiscoverCat(category, element) {
      discoverCategory = category;
      document.querySelectorAll('.ds-tab').forEach((tab) => tab.classList.remove('active'));
      if (element) element.classList.add('active');
      window.filterDiscover();
    };

    window.filterDiscover = function filterDiscover() {
      const query = byId('discoverSearch').value.toLowerCase();
      const availableOnly = Boolean(byId('availToggle')?.checked);
      const minYear = Number(document.querySelector('input[name="yearF"]:checked')?.value || 0);
      const minRating = Number(document.querySelector('input[name="ratingF"]:checked')?.value || 0);
      const hasRatings = books.some((book) => Number.isFinite(Number(book.rating)));
      const results = books.filter((book) =>
        (!query || `${book.title} ${book.author} ${book.isbn}`.toLowerCase().includes(query)) &&
        (!discoverCategory || book.category === discoverCategory) &&
        (!availableOnly || Number(book.availCopies || 0) > 0) &&
        (!minYear || Number(book.year || 0) >= minYear) &&
        (!minRating || !hasRatings || Number(book.rating || 0) >= minRating)
      );

      byId('discoverCount').textContent = `${results.length} book${results.length === 1 ? '' : 's'} found`;
      byId('booksGrid').innerHTML = results.length
        ? results.map((book) => `
          <div class="book-card-2" onclick="openBookDetail('${String(book.id)}')">
            ${LibraryApp.renderBookCover(book, { className: 'bc-cover' })}
            <div class="bc-body">
              <div class="bc-title">${LibraryApp.escapeHtml(book.title)}</div>
              <div class="bc-author">${LibraryApp.escapeHtml(book.author)}</div>
              <div class="bc-meta"><span>${LibraryApp.escapeHtml(book.category)}</span><span>${book.availCopies}/${book.totalCopies}</span></div>
              <div class="bc-actions" style="margin-top:10px">
                <button class="btn btn-violet btn-sm" style="flex:1" onclick="event.stopPropagation();requestBook('${String(book.id)}')">${Number(book.availCopies || 0) > 0 ? 'Reserve' : 'Waitlist'}</button>
                <button class="btn btn-outline btn-sm btn-icon" onclick="event.stopPropagation();openBookDetail('${String(book.id)}')">Info</button>
              </div>
            </div>
          </div>
        `).join('')
        : '<div style="color:var(--txt-3)">No books in the shared catalog yet.</div>';
    };

    window.renderStudentActivitySection = function renderStudentActivitySection() {
      renderTimeline('fullTimeline');
    };

    window.renderStudentFinesSection = function renderStudentFinesSection() {};

    const globalSearch = byId('globalSearch');
    if (globalSearch && !globalSearch.dataset.portalBound) {
      globalSearch.dataset.portalBound = 'true';
      globalSearch.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          const discover = document.querySelector('[data-sec=discover]');
          if (discover && typeof nav === 'function') nav('discover', discover);
          setTimeout(() => {
            byId('discoverSearch').value = event.target.value;
            window.filterDiscover();
          }, 120);
        }
      });
    }

    window.filterDiscover();
  }
  function renderFaculty(data) {
    window.__portalSyncData = data;
    window.__renderFacultyPortal = renderFaculty;
    const user = data.user;
    setText('.sb-uname', user.user_name);
    setText('.sb-urole', `${user.userId} · ${user.dept}`);

    byId('bookshelfGrid').innerHTML = (data.currentBooks || []).map((item) => `
      <div class="bk-card">
        <div class="bk-spine" style="background:#4f46e5"></div>
        <div class="bk-body">
          <div class="bk-title">${LibraryApp.escapeHtml(item.bookTitle)}</div>
          <div class="bk-author">${LibraryApp.escapeHtml(item.author || '')}</div>
          <div class="due-txt"><span>Due ${LibraryApp.escapeHtml(item.due)}</span></div>
        </div>
      </div>
    `).join('') || '<div style="color:var(--smoke)">No faculty-issued books yet.</div>';

    byId('arrivalsList').innerHTML = (data.books || []).slice(0, 6).map((book) => `
      <div class="arrival-card">
        ${LibraryApp.renderBookCover(book, { className: 'arrival-cover' })}
        <div style="flex:1">
          <div class="arrival-title">${LibraryApp.escapeHtml(book.title)}</div>
          <div class="arrival-author">${LibraryApp.escapeHtml(book.author)} · ${book.year}</div>
          <div class="arrival-doi">${LibraryApp.escapeHtml(book.category)} · ${book.availCopies}/${book.totalCopies} copies</div>
        </div>
      </div>
    `).join('') || '<div style="color:var(--smoke)">No catalog books yet.</div>';

    byId('studentActivity').innerHTML = (data.books || []).slice(0, 5).map((book, index) => `
      <div class="activity-bar">
        <div class="ab-rank ${index === 0 ? 'gold' : ''}">${index + 1}</div>
        <div class="ab-book">
          <div class="ab-title">${LibraryApp.escapeHtml(book.title)}</div>
          <div class="ab-rec">${LibraryApp.escapeHtml(book.category)}</div>
        </div>
        <div class="ab-bar-wrap">
          <div class="ab-bar"><div class="ab-fill" style="width:${Math.min(100, (book.totalCopies || 0) * 10)}%"></div></div>
          <div class="ab-count">${book.totalCopies} copies</div>
        </div>
      </div>
    `).join('');

    byId('notifFeed').innerHTML = (data.notifications || []).map((item) => `
      <div class="feed-item">
        <div class="feed-dot" style="background:var(--P400)"></div>
        <div style="flex:1">
          <div class="feed-txt">${item.icon} ${LibraryApp.escapeHtml(item.text)}</div>
          <div class="feed-ts">${LibraryApp.escapeHtml(item.ts)}</div>
        </div>
      </div>
    `).join('');
    installNotificationCenter(data.notifications || []);
    if (typeof window.refreshFacultyShellData === 'function') window.refreshFacultyShellData();
  }

  function renderLibrarian(data) {
    window.__portalSyncData = data;
    window.__renderLibrarianPortal = renderLibrarian;
    const user = data.user;
    const activeTransactions = data.activeTransactions || [];
    let librarianMode = 'return';
    let selectedMember = null;
    let queuedReturns = [];

    setText('.sb-uname', user.user_name);
    setText('.sb-urole', `${user.userId} · ${user.dept}`);

    byId('dueList').innerHTML = (data.dueItems || []).map((item) => `
      <div class="due-item">
        <div class="due-av" style="background:${item.isOverdue ? '#ef4444' : '#3b82f6'}">${LibraryApp.initials(item.userName || '')}</div>
        <div>
          <div class="due-name">${LibraryApp.escapeHtml(item.userName || '')}</div>
          <div class="due-book">${LibraryApp.escapeHtml(item.bookTitle)}</div>
        </div>
        <span class="pill due-days" style="background:${item.isOverdue ? 'var(--red-bg)' : 'var(--amber-bg)'};color:${item.isOverdue ? 'var(--red)' : 'var(--amber)'}">${item.isOverdue ? `${Math.abs(item.dayDiff)}d overdue` : 'Due today'}</span>
        <button class="btn btn-blue btn-sm" onclick="quickConfiscate('${item.id}')">Return</button>
      </div>
    `).join('') || '<div style="color:var(--slate-400)">No due or overdue books right now.</div>';

    byId('recentFeed').innerHTML = (data.notifications || []).map((item) => `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
        <div style="width:30px;height:30px;border-radius:8px;background:rgba(0,0,0,.04);display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">${item.icon}</div>
        <div style="flex:1">
          <div style="font-size:.79rem;font-weight:600;color:var(--slate-800)">${LibraryApp.escapeHtml(item.text)}</div>
          <div style="font-size:.7rem;color:var(--slate-400)">${LibraryApp.escapeHtml(item.ts)}</div>
        </div>
      </div>
    `).join('');

    if (byId('invTbody')) {
      byId('invTbody').innerHTML = (data.books || []).map((book) => `
        <tr>
          <td><div style="font-weight:600;font-size:.83rem;color:var(--slate-900);max-width:200px">${LibraryApp.escapeHtml(book.title)}</div><div style="font-size:.7rem;color:var(--slate-400)">${LibraryApp.escapeHtml(book.author)}</div></td>
          <td style="font-family:var(--font-mono)">${LibraryApp.escapeHtml(book.isbn)}</td>
          <td>${LibraryApp.escapeHtml(book.category)}</td>
          <td>${book.totalCopies}</td>
          <td>${book.availCopies}</td>
          <td>${LibraryApp.escapeHtml(book.location)}</td>
          <td>${LibraryApp.escapeHtml(book.status)}</td>
          <td><span class="pill p-green">Live</span></td>
        </tr>
      `).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--slate-400)">No books available yet.</td></tr>';
    }

    if (byId('rptTbody')) {
      byId('rptTbody').innerHTML = (data.recentTransactions || []).map((item) => `
        <tr>
          <td>${LibraryApp.escapeHtml(item.checkout || '-')}</td>
          <td><div style="font-weight:600;font-size:.81rem">${LibraryApp.escapeHtml(item.userName || data.user.user_name)}</div><div style="font-size:.68rem;color:var(--slate-400);font-family:var(--font-mono)">${LibraryApp.escapeHtml(item.userId || data.user.userId)}</div></td>
          <td style="font-size:.79rem">${LibraryApp.escapeHtml(item.bookTitle || '-')}</td>
          <td>${LibraryApp.escapeHtml(item.status || '-')}</td>
          <td>₹${Number(item.fine || 0)}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--slate-400)">No live transaction history yet.</td></tr>';
    }

    installNotificationCenter(data.notifications || []);

    function renderMemberCard(member, loans, stats = {}) {
      const card = byId('userInfoCard');
      const initials = LibraryApp.initials(member.user_name || member.email || '');
      card.innerHTML = `
        <div class="user-id-card">
          <div class="uid-av" style="background:#3b82f6">${initials}</div>
          <div>
            <div class="uid-name">${LibraryApp.escapeHtml(member.user_name)}</div>
            <div class="uid-id">${LibraryApp.escapeHtml(member.userId)}</div>
            <div class="uid-dept">${LibraryApp.escapeHtml(member.dept || '')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
          <div style="background:var(--surface-2);border-radius:var(--r-md);padding:10px;border:1px solid var(--border);text-align:center">
            <div style="font-size:1.2rem;font-weight:800;color:var(--slate-900)">${loans.length}</div>
            <div style="font-size:.68rem;color:var(--slate-500)">Books Held</div>
          </div>
          <div style="background:var(--surface-2);border-radius:var(--r-md);padding:10px;border:1px solid var(--border);text-align:center">
            <div style="font-size:1.2rem;font-weight:800;color:${loans.some((loan) => loan.isOverdue) ? 'var(--red)' : 'var(--emerald)'}">${loans.filter((loan) => loan.isOverdue).length}</div>
            <div style="font-size:.68rem;color:var(--slate-500)">Overdue</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
          <div style="background:var(--surface-2);border-radius:var(--r-md);padding:10px;border:1px solid var(--border);text-align:center">
            <div style="font-size:1.05rem;font-weight:800;color:var(--slate-900)">${stats.returnedCount || 0}</div>
            <div style="font-size:.68rem;color:var(--slate-500)">Returns</div>
          </div>
          <div style="background:var(--surface-2);border-radius:var(--r-md);padding:10px;border:1px solid var(--border);text-align:center">
            <div style="font-size:1.05rem;font-weight:800;color:${Number(stats.fineOutstanding || 0) > 0 ? 'var(--red)' : 'var(--emerald)'}">₹${Number(stats.fineOutstanding || 0).toFixed(0)}</div>
            <div style="font-size:.68rem;color:var(--slate-500)">Outstanding</div>
          </div>
          <div style="background:var(--surface-2);border-radius:var(--r-md);padding:10px;border:1px solid var(--border);text-align:center">
            <div style="font-size:1.05rem;font-weight:800;color:var(--slate-900)">${stats.reminderCount || 0}</div>
            <div style="font-size:.68rem;color:var(--slate-500)">Reminders</div>
          </div>
        </div>
      `;
    }

    function renderHeldBooks() {
      const section = byId('booksHeldSection');
      const list = byId('booksHeldList');
      section.style.display = selectedMember ? 'block' : 'none';
      if (!selectedMember) return;
      const loans = selectedMember.activeLoans || [];
      list.innerHTML = loans.length ? loans.map((loan) => `
        <div class="scanned-item ${loan.isOverdue ? 'err' : 'ret'}">
          <span class="si-ico">📖</span>
          <div class="si-info">
            <div class="si-title">${LibraryApp.escapeHtml(loan.bookTitle)}</div>
            <div class="si-sub">${LibraryApp.escapeHtml(loan.isbn || '')} · ${loan.isOverdue ? `${Math.abs(loan.dayDiff)} day(s) overdue` : `Due ${loan.due}`}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline btn-sm" onclick="renewLoan('${loan.id}')">Renew</button>
            <button class="btn btn-blue btn-sm" onclick="queueSingleReturn('${loan.id}')">Return</button>
          </div>
        </div>
      `).join('') : '<div style="text-align:center;padding:16px;color:var(--slate-400);font-size:.8rem">No active loans for this member.</div>';
    }

    function renderQueuedReturns() {
      const list = byId('scannedList');
      list.innerHTML = queuedReturns.length ? queuedReturns.map((loan, index) => `
        <div class="scanned-item ${loan.isOverdue ? 'err' : 'ret'}">
          <span class="si-ico">${loan.isOverdue ? '⏰' : '📥'}</span>
          <div class="si-info">
            <div class="si-title">${LibraryApp.escapeHtml(loan.bookTitle)}</div>
            <div class="si-sub">${loan.isOverdue ? `${Math.abs(loan.dayDiff)} day(s) overdue · Fine ₹${loan.fine}` : 'On time return'}</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="removeQueuedReturn(${index})">Remove</button>
        </div>
      `).join('') : '<div style="text-align:center;padding:20px;color:var(--slate-300);font-size:.83rem">No books scanned yet</div>';
      const button = byId('confirmTxBtn');
      button.disabled = !queuedReturns.length;
      button.style.opacity = queuedReturns.length ? '1' : '.5';
      button.textContent = queuedReturns.length ? `✅ Return ${queuedReturns.length} Book(s)` : '✅ Confirm Transaction';
    }

    function setModeText(mode) {
      librarianMode = mode;
      byId('mBtnIssue')?.classList.toggle('active', mode === 'issue');
      byId('mBtnReturn')?.classList.toggle('active', mode === 'return');
      byId('bookPanelTitle').textContent = mode === 'issue' ? '📤 Scan Books to Issue' : '📥 Scan Books to Return';
      byId('modeBanner').textContent = mode === 'issue'
        ? '📤 Issue mode is reserved for a later backend step. Use return mode for overdue clearance.'
        : '📥 Return Mode: queue books and process them to clear overdue notifications.';
    }

    window.setMode = function setMode(mode) {
      setModeText(mode);
      if (mode === 'issue') {
        queuedReturns = [];
        renderQueuedReturns();
      }
    };

    window.lookupStudent = async function lookupStudent(memberUserId) {
      const cleaned = String(memberUserId || '').trim();
      if (!cleaned) return;
      try {
        const result = await LibraryApp.request(`/api/librarian/users/${encodeURIComponent(cleaned)}`);
        selectedMember = result;
        renderMemberCard(result.user, result.activeLoans || [], result.stats || {});
        renderHeldBooks();
        if (typeof window.renderMemberHistory === 'function') window.renderMemberHistory(result);
      } catch (error) {
        selectedMember = null;
        byId('userInfoCard').innerHTML = `<div style="text-align:center;padding:20px;color:var(--red)">${LibraryApp.escapeHtml(error.message || 'Member not found.')}</div>`;
        byId('booksHeldSection').style.display = 'none';
        if (typeof window.renderMemberHistory === 'function') window.renderMemberHistory(null);
      }
    };

    window.renewLoan = async function renewLoan(transactionId) {
      try {
        await LibraryApp.request('/api/librarian/transactions/renew', {
          method: 'POST',
          body: JSON.stringify({ transactionId }),
        });
        const currentLookupId = selectedMember?.user?.userId;
        const refreshedPortalData = await LibraryApp.request('/api/portal-data');
        const refreshedOverview = await LibraryApp.request('/api/librarian/overview');
        renderLibrarian({ ...refreshedPortalData, ...refreshedOverview, user: refreshedOverview.currentUser });
        if (currentLookupId) setTimeout(() => window.lookupStudent(currentLookupId), 100);
        if (typeof window.toast === 'function') window.toast('ok', 'Loan renewed successfully.', '🔁');
      } catch (error) {
        alert(error.message || 'Unable to renew this loan.');
      }
    };

    function queueLoanById(transactionId) {
      if (!selectedMember) return;
      const loan = (selectedMember.activeLoans || []).find((item) => item.id === transactionId);
      if (!loan) return;
      if (queuedReturns.some((item) => item.id === loan.id)) return;
      queuedReturns.push(loan);
      renderQueuedReturns();
    }

    window.queueSingleReturn = function queueSingleReturn(transactionId) {
      queueLoanById(transactionId);
    };

    window.removeQueuedReturn = function removeQueuedReturn(index) {
      queuedReturns.splice(index, 1);
      renderQueuedReturns();
    };

    window.clearQueue = function clearQueue() {
      queuedReturns = [];
      renderQueuedReturns();
      const feedback = byId('circFeedback');
      if (feedback) feedback.innerHTML = '';
    };

    window.processIsbn = function processIsbn(rawIsbn) {
      if (librarianMode !== 'return') {
        alert('Issue mode backend is not added yet. Use Return Mode for overdue/book clearance.');
        return;
      }
      const isbn = String(rawIsbn || '').replace(/-/g, '').trim();
      byId('manualIsbn').value = '';
      byId('isbnInput').value = '';
      if (!selectedMember) {
        alert('Look up a member first.');
        return;
      }
      const loan = (selectedMember.activeLoans || []).find((item) => String(item.isbn || '').replace(/-/g, '') === isbn);
      if (!loan) {
        alert('That ISBN is not currently allocated to this member.');
        return;
      }
      queueLoanById(loan.id);
    };

    window.confirmTransaction = async function confirmTransaction() {
      if (!queuedReturns.length) return;
      try {
        await LibraryApp.request('/api/librarian/transactions/return', {
          method: 'POST',
          body: JSON.stringify({ transactionIds: queuedReturns.map((item) => item.id) }),
        });
        queuedReturns = [];
        const currentLookupId = selectedMember?.user?.userId;
        const refreshedPortalData = await LibraryApp.request('/api/portal-data');
        const refreshedOverview = await LibraryApp.request('/api/librarian/overview');
        renderLibrarian({ ...refreshedPortalData, ...refreshedOverview, user: refreshedOverview.currentUser });
        if (currentLookupId) {
          setTimeout(() => window.lookupStudent(currentLookupId), 100);
        }
      } catch (error) {
        alert(error.message || 'Unable to process return.');
      }
    };

    window.quickConfiscate = async function quickConfiscate(transactionId) {
      try {
        await LibraryApp.request('/api/librarian/transactions/return', {
          method: 'POST',
          body: JSON.stringify({ transactionIds: [transactionId] }),
        });
        const refreshedPortalData = await LibraryApp.request('/api/portal-data');
        const refreshedOverview = await LibraryApp.request('/api/librarian/overview');
        renderLibrarian({ ...refreshedPortalData, ...refreshedOverview, user: refreshedOverview.currentUser });
      } catch (error) {
        alert(error.message || 'Unable to process return.');
      }
    };

    function renderDeskQueue() {
      const list = byId('scannedList');
      if (!list) return;
      list.innerHTML = queuedReturns.length ? queuedReturns.map((item, index) => `
        <div class="scanned-item ${librarianMode === 'return' && item.isOverdue ? 'err' : librarianMode === 'return' ? 'ret' : ''}">
          <span class="si-ico">${librarianMode === 'return' ? (item.isOverdue ? 'â°' : 'ðŸ“¥') : 'ðŸ“¤'}</span>
          <div class="si-info">
            <div class="si-title">${LibraryApp.escapeHtml(item.bookTitle)}</div>
            <div class="si-sub">${librarianMode === 'return'
              ? (item.isOverdue ? `${Math.abs(item.dayDiff)} day(s) overdue - Fine â‚¹${item.fine}` : 'On time return')
              : `${LibraryApp.escapeHtml(item.isbn || '')} - ${item.availCopies}/${item.totalCopies} available`}</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="removeQueuedReturn(${index})">Remove</button>
        </div>
      `).join('') : '<div style="text-align:center;padding:20px;color:var(--slate-300);font-size:.83rem">No books scanned yet</div>';
      const button = byId('confirmTxBtn');
      if (!button) return;
      button.disabled = !queuedReturns.length;
      button.style.opacity = queuedReturns.length ? '1' : '.5';
      button.textContent = queuedReturns.length
        ? (librarianMode === 'return' ? `âœ… Return ${queuedReturns.length} Book(s)` : `âœ… Issue ${queuedReturns.length} Book(s)`)
        : 'âœ… Confirm Transaction';
    }

    function updateDeskMode(mode) {
      librarianMode = mode;
      byId('mBtnIssue')?.classList.toggle('active', mode === 'issue');
      byId('mBtnReturn')?.classList.toggle('active', mode === 'return');
      if (byId('bookPanelTitle')) byId('bookPanelTitle').textContent = mode === 'issue' ? 'ðŸ“¤ Scan Books to Issue' : 'ðŸ“¥ Scan Books to Return';
      if (byId('modeBanner')) {
        byId('modeBanner').textContent = mode === 'issue'
          ? 'ðŸ“¤ Issue Mode: queue catalog books for this member and confirm to create live issue records.'
          : 'ðŸ“¥ Return Mode: queue books and process them to clear overdue notifications.';
      }
      queuedReturns = [];
      renderDeskQueue();
    }

    function queueIssueBookByIsbn(isbn) {
      const book = (data.books || []).find((item) => !item.archived && Number(item.availCopies || 0) > 0 && String(item.isbn || '').replace(/-/g, '') === isbn);
      if (!book) {
        alert('That ISBN is not available in the live catalog.');
        return;
      }
      if (queuedReturns.some((item) => item.id === book.id)) return;
      queuedReturns.push(book);
      renderDeskQueue();
    }

    window.setMode = function setMode(mode) {
      updateDeskMode(mode);
    };

    window.queueSingleReturn = function queueSingleReturn(transactionId) {
      queueLoanById(transactionId);
      renderDeskQueue();
    };

    window.removeQueuedReturn = function removeQueuedReturn(index) {
      queuedReturns.splice(index, 1);
      renderDeskQueue();
    };

    window.clearQueue = function clearQueue() {
      queuedReturns = [];
      renderDeskQueue();
      const feedback = byId('circFeedback');
      if (feedback) feedback.innerHTML = '';
    };

    window.processIsbn = function processIsbn(rawIsbn) {
      const isbn = String(rawIsbn || '').replace(/-/g, '').trim();
      if (byId('manualIsbn')) byId('manualIsbn').value = '';
      if (byId('isbnInput')) byId('isbnInput').value = '';
      if (!selectedMember) {
        alert('Look up a member first.');
        return;
      }
      if (librarianMode === 'return') {
        const loan = (selectedMember.activeLoans || []).find((item) => String(item.isbn || '').replace(/-/g, '') === isbn);
        if (!loan) {
          alert('That ISBN is not currently allocated to this member.');
          return;
        }
        queueLoanById(loan.id);
        renderDeskQueue();
        return;
      }
      queueIssueBookByIsbn(isbn);
    };

    window.confirmTransaction = async function confirmTransaction() {
      if (!queuedReturns.length) return;
      try {
        const payload = librarianMode === 'return'
          ? await LibraryApp.request('/api/librarian/transactions/return', {
              method: 'POST',
              body: JSON.stringify({ transactionIds: queuedReturns.map((item) => item.id) }),
            })
          : await LibraryApp.request('/api/librarian/transactions/issue', {
              method: 'POST',
              body: JSON.stringify({
                userId: selectedMember?.user?.id || selectedMember?.user?.userId,
                bookIds: queuedReturns.map((item) => item.id),
                dueDate: byId('issueDueDate')?.value || '',
              }),
            });
        queuedReturns = [];
        const currentLookupId = selectedMember?.user?.userId;
        const refreshedPortalData = await LibraryApp.request('/api/portal-data');
        const refreshedOverview = await LibraryApp.request('/api/librarian/overview');
        renderLibrarian({ ...refreshedPortalData, ...refreshedOverview, user: refreshedOverview.currentUser });
        if (librarianMode === 'return' && payload?.processed?.some((item) => Number(item.fine || 0) > 0) && typeof window.handleFineTransactions === 'function') {
          window.handleFineTransactions(payload.processed.filter((item) => Number(item.fine || 0) > 0));
        } else if (typeof window.toast === 'function') {
          const count = librarianMode === 'return' ? payload?.processed?.length || 0 : payload?.issued?.length || 0;
          window.toast('ok', `${librarianMode === 'return' ? 'Returned' : 'Issued'} ${count} book${count === 1 ? '' : 's'} successfully.`, librarianMode === 'return' ? 'ðŸ“¥' : 'ðŸ“¤');
        }
        if (currentLookupId) {
          setTimeout(() => window.lookupStudent(currentLookupId), 100);
        }
      } catch (error) {
        alert(error.message || `Unable to process ${librarianMode}.`);
      }
    };

    window.quickConfiscate = async function quickConfiscate(transactionId) {
      try {
        const payload = await LibraryApp.request('/api/librarian/transactions/return', {
          method: 'POST',
          body: JSON.stringify({ transactionIds: [transactionId] }),
        });
        const refreshedPortalData = await LibraryApp.request('/api/portal-data');
        const refreshedOverview = await LibraryApp.request('/api/librarian/overview');
        renderLibrarian({ ...refreshedPortalData, ...refreshedOverview, user: refreshedOverview.currentUser });
        if (payload?.processed?.some((item) => Number(item.fine || 0) > 0) && typeof window.handleFineTransactions === 'function') {
          window.handleFineTransactions(payload.processed.filter((item) => Number(item.fine || 0) > 0));
        }
      } catch (error) {
        alert(error.message || 'Unable to process return.');
      }
    };

    updateDeskMode('return');
    renderDeskQueue();
    if (typeof window.refreshLibrarianShellData === 'function') window.refreshLibrarianShellData();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const session = await LibraryApp.requireSession(expectedRole);
    if (!session) return;
    if (pageName === 'librarian.html') {
      const [portalData, librarianData] = await Promise.all([
        LibraryApp.request('/api/portal-data'),
        LibraryApp.request('/api/librarian/overview'),
      ]);
      renderLibrarian({ ...portalData, ...librarianData, user: librarianData.currentUser });
      return;
    }
    const data = await LibraryApp.request('/api/portal-data');
    if (pageName === 'faculty.html') renderFaculty(data);
    else renderStudent(data);
  });
})();






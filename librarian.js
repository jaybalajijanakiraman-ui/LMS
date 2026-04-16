let dashChart = null;
let rptChart = null;
let rptPie = null;
let filteredInv = [];
let invPage = 1;
const invPPG = 8;
let filteredRpt = [];
let reportPreset = 'today';
let pendingFineAmount = 0;
let pendingFineTransactions = [];
let discardBookId = null;
let editingInventoryBookId = null;

const PAGES = {
    dashboard: { icon: '\u{1F3E0}', title: 'Librarian Desk', bc: 'Dashboard' },
    circulation: { icon: '\u{1F504}', title: 'Circulation Hub', bc: 'Issue & Return' },
    inventory: { icon: '\u{1F4D6}', title: 'Inventory Manager', bc: 'Books Catalog' },
    reports: { icon: '\u{1F4CA}', title: 'Reports & Logs', bc: 'Daily Activity' },
};

function byId(id) {
    return document.getElementById(id);
}

function getLibrarianData() {
    return window.__portalSyncData || { user: {}, books: [], dueItems: [], notifications: [], recentTransactions: [], activeTransactions: [], reportRows: [], deskNotifications: [], dashboardInsights: {}, undoState: {} };
}

function normalizeBook(book) {
    return {
        id: String(book.id || ''),
        title: book.title || 'Catalog Book',
        author: book.author || '',
        isbn: book.isbn || '-',
        category: book.category || 'Catalog',
        total: Number(book.totalCopies ?? 0),
        avail: Number(book.availCopies ?? 0),
        location: book.location || '-',
        status: book.status || (Number(book.availCopies || 0) > 0 ? 'Available' : 'Loaned'),
        condition: 'Live',
    };
}

function getInventoryBooks() {
    return (getLibrarianData().books || []).map(normalizeBook);
}

function getReportRows() {
    return (getLibrarianData().recentTransactions || []).map((item) => ({
        time: item.checkout || item.returned || '-',
        user: item.userName || getLibrarianData().user.user_name || 'Member',
        userId: item.userId || '-',
        book: item.bookTitle || '-',
        type: item.returned ? 'Returned' : 'Issued',
        due: item.due || '-',
        fine: Number(item.fine || 0),
        lib: item.processedBy || getLibrarianData().user.user_name || 'Librarian',
        date: item.returned || item.checkout || '',
    }));
}

function formatRupees(value) {
    return `\u20B9${Number(value || 0).toFixed(0)}`;
}

function getDeskActionTargets(entry = {}) {
    if (entry.section === 'circulation') {
        return {
            section: 'circulation',
            callback() {
                if (entry.userId && byId('studentIdInput')) {
                    byId('studentIdInput').value = entry.userId;
                    if (typeof window.lookupStudent === 'function') window.lookupStudent(entry.userId);
                }
            },
        };
    }
    if (entry.section === 'inventory') {
        return {
            section: 'inventory',
            callback() {
                if (entry.bookId) {
                    const book = getInventoryBooks().find((item) => item.id === entry.bookId);
                    if (book && byId('invSearch')) byId('invSearch').value = book.title;
                } else if (entry.query && byId('invSearch')) {
                    byId('invSearch').value = entry.query;
                }
                window.filterInv();
            },
        };
    }
    return {
        section: entry.section || 'reports',
        callback() {
            if (entry.type && byId('rptType')) byId('rptType').value = entry.type;
            if (entry.userId && byId('rptSearch')) byId('rptSearch').value = entry.userId;
            window.filterRpt();
        },
    };
}

function applyDeskAction(entry = {}) {
    const target = getDeskActionTargets(entry);
    window.nav(target.section, document.querySelector(`[data-sec="${target.section}"]`));
    window.closeM('deskNotifModal');
    setTimeout(() => target.callback?.(), 80);
}

function renderDeskInsights() {
    const insights = getLibrarianData().dashboardInsights || {};
    const row = byId('deskInsightRow');
    if (!row) return;
    const cards = [
        { title: 'Low Stock', value: insights.lowStockCount || 0, meta: (insights.lowStockBooks || []).slice(0, 2).map((book) => `${book.title} · ${book.available} left`).join('<br>') || 'No low-stock titles' },
        { title: 'Archived', value: insights.archivedCount || 0, meta: (insights.archivedCount || 0) ? 'Restore archived catalog records from inventory.' : 'No archived titles right now' },
        { title: 'Reminders Today', value: insights.remindersToday || 0, meta: (insights.overdueCount || 0) ? `${insights.overdueCount} overdue loan(s) still open` : 'No overdue backlog right now' },
        { title: 'Top Category', value: insights.topCategory?.name || 'None', meta: insights.topCategory ? `${insights.topCategory.count} active title(s) in catalog` : 'Catalog data is still building' },
    ];
    row.innerHTML = cards.map((card) => `
      <div class="insight-mini">
        <h4>${card.title}</h4>
        <div class="num">${card.value}</div>
        <div class="meta">${card.meta}</div>
      </div>
    `).join('');
}

function renderDeskNotificationsModal() {
    const body = byId('deskNotifBody');
    const notifications = getLibrarianData().deskNotifications || [];
    if (!body) return;
    window.__deskNotifActions = notifications;
    body.innerHTML = notifications.length ? notifications.map((item, index) => `
      <div class="mini-item" style="margin-bottom:10px">
        <div class="ttl">${item.icon || '🔔'} ${item.title}</div>
        <div class="sub">${item.message || ''}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-sm btn-slate" data-desk-index="${index}">${item.actionLabel || 'Open'}</button>
        </div>
      </div>
    `).join('') : '<div style="color:var(--slate-500)">No desk notifications right now.</div>';
    body.querySelectorAll('[data-desk-index]').forEach((button) => {
        button.addEventListener('click', () => {
            applyDeskAction((window.__deskNotifActions || [])[Number(button.dataset.deskIndex)] || {});
        });
    });
}

function renderMemberHistory(memberData) {
    const section = byId('memberHistorySection');
    const historyList = byId('memberHistoryList');
    const fineList = byId('memberFineList');
    const reminderList = byId('memberReminderList');
    if (!section || !historyList || !fineList || !reminderList) return;
    if (!memberData || !memberData.user) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    const returns = memberData.returnedHistory || [];
    const fines = memberData.fineHistory || [];
    const reminders = memberData.reminderHistory || [];
    historyList.innerHTML = returns.length ? returns.slice(0, 5).map((item) => `
      <div class="mini-item">
        <div class="ttl">${LibraryApp.escapeHtml(item.bookTitle || 'Book')}</div>
        <div class="sub">Returned ${LibraryApp.escapeHtml(item.returned || '-')} · ${LibraryApp.escapeHtml(item.status || 'Returned')}</div>
      </div>
    `).join('') : '<div style="color:var(--slate-500)">No return history yet.</div>';
    fineList.innerHTML = fines.length ? fines.slice(0, 5).map((item) => `
      <div class="mini-item">
        <div class="ttl">${LibraryApp.escapeHtml(item.bookTitle || 'Book')}</div>
        <div class="sub">${item.fineStatus || 'Pending'} · ${formatRupees(item.fine || item.finePaidAmount || item.fineWaivedAmount || 0)}</div>
      </div>
    `).join('') : '<div style="color:var(--slate-500)">No fine history.</div>';
    reminderList.innerHTML = reminders.length ? reminders.slice(0, 5).map((item) => `
      <div class="mini-item">
        <div class="ttl">${LibraryApp.escapeHtml(item.bookTitle || 'Reminder')}</div>
        <div class="sub">Sent ${LibraryApp.escapeHtml(String(item.createdAt || '').slice(0, 10) || '-')} · ${Math.abs(Number(item.dayDiff || 0))} day(s) ${Number(item.dayDiff || 0) < 0 ? 'overdue' : 'left'}</div>
      </div>
    `).join('') : '<div style="color:var(--slate-500)">No reminder history.</div>';
}
window.renderMemberHistory = renderMemberHistory;

window.nav = function nav(sec, el) {
    document.querySelectorAll('.sb-link').forEach((link) => link.classList.remove('active'));
    if (el) el.classList.add('active');
    else document.querySelector(`[data-sec="${sec}"]`)?.classList.add('active');
    document.querySelectorAll('.section').forEach((section) => section.classList.remove('active'));
    byId(`sec-${sec}`)?.classList.add('active');
    const page = PAGES[sec] || {};
    if (byId('tbIcon')) byId('tbIcon').textContent = page.icon || '\u{1F4CC}';
    if (byId('tbTitle')) byId('tbTitle').textContent = page.title || sec;
    if (byId('tbBc')) byId('tbBc').textContent = `/ ${page.bc || ''}`;
    if (sec === 'inventory') window.filterInv();
    if (sec === 'reports') window.filterRpt();
};

window.toggleSb = function toggleSb() {
    byId('sidebar')?.classList.toggle('collapsed');
};

window.openM = function openM(id) {
    const modal = byId(id);
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
};

window.closeM = function closeM(id) {
    const modal = byId(id);
    if (!modal) return;
    modal.classList.remove('open');
    if (!document.querySelector('.ovl.open')) document.body.style.overflow = '';
};

document.querySelectorAll('.ovl').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) window.closeM(overlay.id);
    });
});

window.toast = function toast(type, msg, icon = '\u2139') {
    const box = byId('toastBox');
    if (!box) return;
    const toastEl = document.createElement('div');
    const cls = { ok: 'toast-ok', err: 'toast-err', info: 'toast-info', warn: 'toast-warn' };
    toastEl.className = `toast ${cls[type] || 'toast-info'}`;
    toastEl.innerHTML = `<span class="ti">${icon}</span><span class="tm">${msg}</span><button class="tc" onclick="this.parentElement.remove()">\u00D7</button>`;
    box.appendChild(toastEl);
    setTimeout(() => {
        toastEl.style.opacity = '0';
        toastEl.style.transform = 'translateX(24px)';
        toastEl.style.transition = 'all .3s';
        setTimeout(() => toastEl.remove(), 320);
    }, 4500);
};

window.renderPgn = function renderPgn(cid, cur, total, cb) {
    const container = byId(cid);
    if (!container) return;
    if (total <= 1) {
        container.innerHTML = '';
        return;
    }
    let html = `<button class="pgn-btn" ${cur === 1 ? 'disabled' : ''} onclick="${cb.name}(${cur - 1})">&lt;</button>`;
    for (let page = 1; page <= total; page += 1) {
        if (page === 1 || page === total || Math.abs(page - cur) <= 1) {
            html += `<button class="pgn-btn ${page === cur ? 'active' : ''}" onclick="${cb.name}(${page})">${page}</button>`;
        } else if (Math.abs(page - cur) === 2) {
            html += '<span style="padding:0 3px;color:var(--slate-400);font-size:.75rem">...</span>';
        }
    }
    html += `<button class="pgn-btn" ${cur === total ? 'disabled' : ''} onclick="${cb.name}(${cur + 1})">&gt;</button>`;
    container.innerHTML = html;
};

window.handleOmni = function handleOmni(val) {
    const input = String(val || '').trim();
    if (!input) return;
    const books = getInventoryBooks();
    const compact = input.replace(/-/g, '');
    if (/^\d{10,13}$/.test(compact)) {
        const book = books.find((entry) => String(entry.isbn).replace(/-/g, '') === compact);
        if (book) window.toast('ok', `Found \"${book.title}\" - ${book.avail}/${book.total} copies available.`, '\uD83D\uDD0E');
        else window.toast('warn', `ISBN ${input} is not in the live catalog.`, '\u26A0');
        return;
    }
    if (/^(?:\d{2}VR|FAC-|ADM-|LIB-)/i.test(input)) {
        if (typeof window.lookupStudent === 'function') window.lookupStudent(input);
        return;
    }
    if (input.length > 2) {
        const results = books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(input.toLowerCase())).slice(0, 3);
        if (results.length) window.toast('ok', `Found ${results.length} live match${results.length === 1 ? '' : 'es'}: ${results.map((book) => book.title).join(', ')}`, '\uD83D\uDD0D');
        else window.toast('warn', `No live books match \"${input}\".`, '\u26A0');
    }
};

getReportRows = function getReportRows() {
    const data = getLibrarianData();
    if (Array.isArray(data.reportRows) && data.reportRows.length) {
        return data.reportRows;
    }
    const baseRows = (data.recentTransactions || []).map((item) => ({
        time: item.checkout || item.returned || '-',
        user: item.userName || data.user.user_name || 'Member',
        userId: item.userId || '-',
        book: item.bookTitle || '-',
        type: item.fineStatus === 'Paid' ? 'Fine Paid' : item.status === 'Lost' ? 'Lost' : item.returned ? 'Returned' : 'Issued',
        due: item.due || '-',
        fine: Number(item.fine || 0),
        lib: item.processedBy || data.user.user_name || 'Librarian',
        date: item.returned || item.checkout || '',
    }));
    const ledgerRows = (data.ledgerEntries || []).map((entry) => ({
        time: entry.createdAt || '-',
        user: entry.memberName || 'Member',
        userId: entry.memberId || '-',
        book: entry.bookTitle || 'Ledger Entry',
        type: 'Fine Paid',
        due: '-',
        fine: Number(entry.amount || 0),
        lib: entry.recordedBy || data.user.user_name || 'Librarian',
        date: entry.createdAt || '',
    }));
    return [...ledgerRows, ...baseRows];
};

function updateDashboardStats() {
    const data = getLibrarianData();
    const books = getInventoryBooks();
    const dueItems = data.dueItems || [];
    const activeTransactions = data.activeTransactions || [];
    const today = new Date().toISOString().slice(0, 10);
    const recentTransactions = getReportRows().filter((row) => String(row.date || '').slice(0, 10) === today);
    const activeFines = activeTransactions.filter((item) => Number(item.fine || 0) > 0);
    const activeFineAmount = activeFines.reduce((sum, item) => sum + Number(item.fine || 0), 0);
    const chips = document.querySelectorAll('.scard-chip');
    const labels = document.querySelectorAll('.scard-lbl');

    if (byId('s-due')) byId('s-due').textContent = String(dueItems.length);
    if (byId('s-new')) byId('s-new').textContent = String(books.length);
    if (byId('s-fine')) byId('s-fine').textContent = String(activeFines.length);
    if (byId('s-tx')) byId('s-tx').textContent = String(recentTransactions.length);

    if (chips[0]) chips[0].textContent = dueItems.some((item) => item.isOverdue) ? 'Overdue' : 'Live';
    if (chips[1]) chips[1].textContent = 'Catalog';
    if (chips[2]) chips[2].textContent = formatRupees(activeFineAmount);
    if (chips[3]) chips[3].textContent = 'Recent';

    if (labels[1]) labels[1].textContent = 'Catalog Titles';
    if (labels[2]) labels[2].textContent = 'Active Fine Records';
    if (labels[3]) labels[3].textContent = 'Recent Transactions';
    if (byId('badgeCirc')) byId('badgeCirc').textContent = String(dueItems.length || 0);
    if (byId('undoDeskBtn')) byId('undoDeskBtn').textContent = data.undoState?.available ? `↩️ ${data.undoState.label}` : '↩️ Undo Last';
    renderDeskInsights();
    renderDeskNotificationsModal();
}

function initDashChart() {
    const canvas = byId('dashChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const data = getLibrarianData();
    const chartData = [
        data.dueItems?.length || 0,
        data.activeTransactions?.length || 0,
        getInventoryBooks().length,
        getReportRows().filter((row) => row.type === 'Returned').length,
    ];
    if (dashChart) dashChart.destroy();
    dashChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Due / Overdue', 'Active Loans', 'Catalog Titles', 'Recent Returns'],
            datasets: [{
                label: 'Live Desk Snapshot',
                data: chartData,
                backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#7c3aed'],
                borderRadius: 8,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { font: { family: 'DM Sans', size: 11 }, usePointStyle: true } } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 } } },
                y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 10 }, precision: 0 } },
            },
        },
    });
}

function refreshReportCharts(rows) {
    if (typeof Chart === 'undefined') return;
    const barCanvas = byId('rptChart');
    const pieCanvas = byId('rptPie');
    if (!barCanvas || !pieCanvas) return;
    const issued = rows.filter((row) => row.type === 'Issued').length;
    const returned = rows.filter((row) => row.type === 'Returned').length;
    const fines = rows.filter((row) => row.fine > 0).length;
    if (rptChart) rptChart.destroy();
    rptChart = new Chart(barCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Issued', 'Returned', 'Fine Records'],
            datasets: [{
                label: 'Live Transactions',
                data: [issued, returned, fines],
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
                borderRadius: 8,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { font: { family: 'DM Sans', size: 11 }, usePointStyle: true } } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 } } },
                y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 10 }, precision: 0 } },
            },
        },
    });
    if (rptPie) rptPie.destroy();
    rptPie = new Chart(pieCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Issued', 'Returned', 'Fine Records'],
            datasets: [{ data: [issued, returned, fines], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'], borderColor: '#fff', borderWidth: 2 }],
        },
        options: { responsive: true, cutout: '60%', plugins: { legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 }, usePointStyle: true, padding: 10 } } } },
    });
}

window.selDP = function selDP(el, range) {
    reportPreset = range;
    document.querySelectorAll('.dpill').forEach((pill) => pill.classList.remove('active'));
    if (el) el.classList.add('active');
    window.filterRpt();
};

window.filterRpt = function filterRpt() {
    const rows = getReportRows();
    const query = String(byId('rptSearch')?.value || '').toLowerCase();
    const type = String(byId('rptType')?.value || '');
    const from = byId('rptFrom')?.value || '';
    const to = byId('rptTo')?.value || '';
    const today = new Date().toISOString().slice(0, 10);
    filteredRpt = rows.filter((row) => {
        const rowDate = String(row.date || '').slice(0, 10);
        const queryMatch = !query || `${row.user} ${row.book} ${row.userId}`.toLowerCase().includes(query);
        const typeMatch = !type
            || row.type === type
            || (type === 'Inventory' && String(row.type || '').startsWith('Inventory'))
            || (type === 'Fine Paid' && row.type === 'Fine Paid');
        let dateMatch = true;
        if (reportPreset === 'today') dateMatch = !rowDate || rowDate === today;
        else if (reportPreset === 'custom') dateMatch = (!from || !rowDate || rowDate >= from) && (!to || !rowDate || rowDate <= to);
        else if (from || to) dateMatch = (!from || !rowDate || rowDate >= from) && (!to || !rowDate || rowDate <= to);
        return queryMatch && typeMatch && dateMatch;
    });
    const issueCount = filteredRpt.filter((row) => row.type === 'Issued').length;
    const returnCount = filteredRpt.filter((row) => row.type === 'Returned').length;
    const fineTotal = filteredRpt.reduce((sum, row) => sum + Number(row.fine || 0), 0);
    if (byId('rTotalIssue')) byId('rTotalIssue').textContent = String(issueCount);
    if (byId('rTotalReturn')) byId('rTotalReturn').textContent = String(returnCount);
    if (byId('rTotalFine')) byId('rTotalFine').textContent = formatRupees(fineTotal);
    const tbody = byId('rptTbody');
    if (tbody) {
        tbody.innerHTML = filteredRpt.length ? filteredRpt.map((row) => `
        <tr>
          <td style="font-family:var(--font-mono);font-size:.78rem;color:var(--slate-600)">${row.time}</td>
          <td><div style="font-weight:600;font-size:.81rem">${row.user}</div><div style="font-size:.68rem;color:var(--slate-400);font-family:var(--font-mono)">${row.userId}</div></td>
          <td style="font-size:.79rem;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${row.book}</td>
          <td><span class="pill ${row.type === 'Returned' ? 'p-blue' : row.type === 'Reminder' ? 'p-amber' : String(row.type || '').startsWith('Inventory') ? 'p-slate' : row.type === 'Fine Ledger' || row.type === 'Fine Paid' || row.type === 'Fine Waived' ? 'p-red' : 'p-green'}">${row.type}</span></td>
          <td style="font-size:.78rem;color:var(--slate-500)">${row.due}</td>
          <td style="font-weight:700;color:${row.fine > 0 ? 'var(--red)' : 'var(--emerald)'}">${formatRupees(row.fine)}</td>
          <td style="font-size:.78rem;color:var(--slate-500)">${row.lib}</td>
        </tr>
      `).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--slate-400)">No live report rows match this filter.</td></tr>';
    }
    if (byId('rptCount')) byId('rptCount').textContent = `${filteredRpt.length} log entr${filteredRpt.length === 1 ? 'y' : 'ies'}`;
    refreshReportCharts(filteredRpt);
};

window.filterInv = function filterInv() {
    const books = getInventoryBooks();
    const query = String(byId('invSearch')?.value || '').toLowerCase();
    const category = String(byId('invCatF')?.value || '');
    const status = String(byId('invStatF')?.value || '');
    filteredInv = books.filter((book) =>
        (!query || `${book.title} ${book.author} ${book.isbn}`.toLowerCase().includes(query)) &&
        (!category || book.category === category) &&
        (!status || book.status === status)
    );
    invPage = 1;
    renderInvTable(1);
};

function renderInvTable(page) {
    invPage = page;
    const start = (page - 1) * invPPG;
    const rows = filteredInv.slice(start, start + invPPG);
    const tbody = byId('invTbody');
    if (!tbody) return;
    tbody.innerHTML = rows.length ? rows.map((book) => `
      <tr>
        <td><div style="font-weight:600;font-size:.83rem;color:var(--slate-900);max-width:200px">${book.title}</div><div style="font-size:.7rem;color:var(--slate-500)">${book.author}</div></td>
        <td style="font-family:var(--font-mono);font-size:.72rem;color:var(--slate-500)">${book.isbn}</td>
        <td><span class="pill p-slate" style="font-size:.64rem">${book.category}</span></td>
        <td style="font-size:.85rem;text-align:center"><span style="font-weight:700;color:${book.avail === 0 ? 'var(--red)' : 'var(--emerald)'}">${book.avail}</span><span style="color:var(--slate-400)"> / ${book.total}</span></td>
        <td style="font-family:var(--font-mono);font-size:.75rem;color:var(--slate-500)">${book.location}</td>
        <td><span class="pill p-green">${book.condition}</span></td>
        <td><span class="pill ${book.status === 'Available' ? 'p-green' : 'p-blue'}">${book.status}</span></td>
        <td style="text-align:right"><div style="display:flex;gap:6px;justify-content:flex-end"><button class="btn btn-outline btn-sm btn-icon" onclick="toast('info','Inventory edits are handled from the live catalog workflow.','\u270F')">\u270F Edit</button><button class="btn btn-danger btn-sm" onclick="openDiscard('${book.id}','${book.title.replace(/'/g, "&#39;")}')">\uD83D\uDDD1 Discard</button></div></td>
      </tr>
    `).join('') : '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--slate-400);font-size:.85rem">No live books match your filter.</td></tr>';
    if (byId('invCount')) byId('invCount').textContent = `${filteredInv.length} book${filteredInv.length === 1 ? '' : 's'}`;
    if (byId('invPaginInfo')) {
        const end = Math.min(start + invPPG, filteredInv.length);
        byId('invPaginInfo').textContent = filteredInv.length ? `Showing ${start + 1}-${end} of ${filteredInv.length}` : 'No records';
    }
    window.renderPgn('invPagination', page, Math.max(1, Math.ceil(filteredInv.length / invPPG)), renderInvTable);
}

function setInvField(id, value) {
    const el = byId(id);
    if (!el) return;
    el.textContent = value;
    el.classList.remove('empty');
    el.closest('.ifield')?.classList.add('filled');
}

window.clearScannerFields = function clearScannerFields() {
    ['if-title', 'if-author', 'if-publisher', 'if-category'].forEach((id) => {
        const el = byId(id);
        if (!el) return;
        el.textContent = 'Awaiting scan';
        el.classList.add('empty');
        el.closest('.ifield')?.classList.remove('filled');
    });
    if (byId('invIsbn')) byId('invIsbn').value = '';
    if (byId('if-edition')) byId('if-edition').value = '';
    if (byId('if-shelf')) byId('if-shelf').value = '';
    if (byId('invAddBtn')) {
        byId('invAddBtn').disabled = true;
        byId('invAddBtn').style.opacity = '.4';
    }
};

window.autoFillBook = function autoFillBook(isbn) {
    const compact = String(isbn || '').replace(/-/g, '');
    if (compact.length < 10) return;
    const book = getInventoryBooks().find((entry) => String(entry.isbn).replace(/-/g, '') === compact);
    if (!book) {
        window.toast('warn', `ISBN ${isbn} is not in the live catalog.`, '\u26A0');
        return;
    }
    setInvField('if-title', book.title);
    setInvField('if-author', book.author);
    setInvField('if-publisher', 'Live catalog record');
    setInvField('if-category', book.category);
    if (byId('if-shelf')) byId('if-shelf').value = book.location;
    if (byId('invAddBtn')) {
        byId('invAddBtn').disabled = false;
        byId('invAddBtn').style.opacity = '1';
    }
    window.toast('ok', `Loaded live catalog details for \"${book.title}\".`, '\uD83D\uDCD8');
};

window.addFromScanner = function addFromScanner() {
    window.toast('info', 'Inventory creation is not available for librarian accounts in the current API.', '\uD83D\uDCDA');
};

window.openAddBook = function openAddBook() {
    const body = byId('addBookBody');
    if (body) {
        body.innerHTML = '<div style="padding:16px;color:var(--slate-600);line-height:1.6">New book creation is currently handled through the administrator workflow. The librarian desk can still search and manage live inventory data.</div>';
    }
    window.openM('addBookModal');
};

window.saveNewBook = function saveNewBook() {
    window.closeM('addBookModal');
    window.toast('info', 'Book creation is not enabled for librarian accounts in the current backend.', '\uD83D\uDCD6');
};

window.openDiscard = function openDiscard(id, title) {
    discardBookId = id;
    document.querySelectorAll('.reason-opt').forEach((option) => option.classList.remove('selected'));
    if (byId('discardNotes')) byId('discardNotes').value = '';
    window.openM('discardModal');
    window.toast('info', `Discard review opened for \"${title}\".`, '\uD83D\uDDD1');
};

window.selectReason = function selectReason(el) {
    document.querySelectorAll('.reason-opt').forEach((option) => option.classList.remove('selected'));
    if (el) el.classList.add('selected');
};

window.confirmDiscard = function confirmDiscard() {
    const reason = document.querySelector('.reason-opt.selected input')?.value;
    if (!reason) {
        window.toast('err', 'Please select a discard reason.', '\u274C');
        return;
    }
    window.closeM('discardModal');
    window.toast('ok', `Discard note saved for item ${discardBookId || ''}: ${reason}.`, '\u2705');
};

window.payFine = function payFine() {
    window.closeM('fineModal');
    window.toast('ok', `Fine ${formatRupees(pendingFineAmount)} recorded locally.`, '\uD83D\uDCB0');
};

window.addToLedger = function addToLedger() {
    window.closeM('fineModal');
    window.toast('warn', `Fine ${formatRupees(pendingFineAmount)} added to outstanding ledger note.`, '\u26A0');
};

window.waveFine = function waveFine() {
    window.closeM('fineModal');
    window.openM('waiveModal');
};

window.confirmWaive = function confirmWaive() {
    const reason = byId('waiveReason')?.value;
    if (!reason) {
        window.toast('err', 'Please choose a waiver reason.', '\u274C');
        return;
    }
    window.closeM('waiveModal');
    window.toast('ok', `Fine ${formatRupees(pendingFineAmount)} waived with reason: ${reason}.`, '\u2705');
};

window.showLibrarianNotificationsToast = function showLibrarianNotificationsToast() {
    const data = getLibrarianData();
    const dueCount = data.dueItems?.length || 0;
    const notificationCount = data.notifications?.length || 0;
    window.toast('info', `${notificationCount} live notification${notificationCount === 1 ? '' : 's'} and ${dueCount} due item${dueCount === 1 ? '' : 's'} on the dashboard.`, '\uD83D\uDD14');
};

window.sendLibrarianReminders = function sendLibrarianReminders() {
    const dueCount = getLibrarianData().dueItems?.length || 0;
    window.toast('info', `Reminder workflow prepared for ${dueCount} due or overdue member${dueCount === 1 ? '' : 's'}.`, '\u23F0');
};

window.refreshLibrarianShellData = function refreshLibrarianShellData() {
    const books = getInventoryBooks();
    filteredInv = [...books];
    updateDashboardStats();
    initDashChart();
    renderInvTable(invPage || 1);
    if (byId('logDate')) {
        byId('logDate').textContent = 'Date: ' + new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    const bellButton = document.querySelector('.topbar-btn[title="Notifications"]');
    if (bellButton) bellButton.onclick = () => window.showLibrarianNotificationsToast();
    window.filterRpt();
};

window.runBulkInventoryAction = async function runBulkInventoryAction(action) {
    if (!filteredInv.length) {
        window.toast('warn', 'No filtered inventory rows are available for this bulk action.', '⚠');
        return;
    }
    const payload = {
        action,
        bookIds: filteredInv.map((book) => book.id),
    };
    if (action === 'move') {
        const location = window.prompt('Enter the shelf/location for the filtered books:');
        if (!location) return;
        payload.location = location;
    }
    if (action === 'categorize') {
        const category = window.prompt('Enter the category for the filtered books:');
        if (!category) return;
        payload.category = category;
    }
    try {
        const result = await LibraryApp.request('/api/librarian/books/bulk-update', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        window.toast('ok', `Bulk inventory action updated ${result.count} book${result.count === 1 ? '' : 's'}.`, '🧰');
        await reloadLibrarianLiveData({ preserveMode: true });
    } catch (error) {
        window.toast('err', error.message || 'Unable to complete the bulk inventory action.', '❌');
    }
};

async function reloadLibrarianLiveData(options = {}) {
    const lookupId = options.preserveLookup ? String(byId('studentIdInput')?.value || '').trim() : '';
    const mode = options.preserveMode && byId('mBtnIssue')?.classList.contains('active') ? 'issue' : 'return';
    const [portalData, librarianData] = await Promise.all([
        LibraryApp.request('/api/portal-data'),
        LibraryApp.request('/api/librarian/overview'),
    ]);
    if (typeof window.__renderLibrarianPortal === 'function') {
        window.__renderLibrarianPortal({ ...portalData, ...librarianData, user: librarianData.currentUser });
    }
    if (lookupId && typeof window.lookupStudent === 'function') {
        if (byId('studentIdInput')) byId('studentIdInput').value = lookupId;
        setTimeout(() => window.lookupStudent(lookupId), 120);
    }
    if (options.preserveMode && typeof window.setMode === 'function') {
        setTimeout(() => window.setMode(mode), 60);
    }
    return librarianData;
}

function getRawInventoryBook(id) {
    return (getLibrarianData().books || []).find((book) => String(book.id || '') === String(id || '')) || null;
}

function getInventoryStatusClass(status) {
    if (status === 'Archived') return 'p-slate';
    if (status === 'Available') return 'p-green';
    if (status === 'Loaned' || status === 'Issued') return 'p-blue';
    return 'p-red';
}

function renderBookForm(book = null) {
    return `
      <div class="form-row">
        <div class="fg">
          <label class="flbl">Title *</label>
          <input class="fc" id="abTitle" value="${LibraryApp.escapeHtml(book?.title || '')}" placeholder="Book title">
        </div>
        <div class="fg">
          <label class="flbl">Author *</label>
          <input class="fc" id="abAuthor" value="${LibraryApp.escapeHtml(book?.author || '')}" placeholder="Author name">
        </div>
      </div>
      <div class="form-row">
        <div class="fg">
          <label class="flbl">ISBN *</label>
          <input class="fc" id="abIsbn" value="${LibraryApp.escapeHtml(book?.isbn || '')}" placeholder="978-...">
        </div>
        <div class="fg">
          <label class="flbl">Category *</label>
          <select class="fc" id="abCategory">
            ${['Computer Science', 'Electronics', 'Mathematics', 'Management', 'Physics', 'General Fiction'].map((category) => `<option ${book?.category === category ? 'selected' : ''}>${category}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="fg">
          <label class="flbl">Year *</label>
          <input class="fc" id="abYear" type="number" value="${LibraryApp.escapeHtml(String(book?.year || new Date().getFullYear()))}" min="1900">
        </div>
        <div class="fg">
          <label class="flbl">Total Copies *</label>
          <input class="fc" id="abCopies" type="number" value="${LibraryApp.escapeHtml(String(book?.totalCopies || 1))}" min="1">
        </div>
      </div>
      <div class="fg">
        <label class="flbl">Shelf Location *</label>
        <input class="fc" id="abLocation" value="${LibraryApp.escapeHtml(book?.location || '')}" placeholder="A-2-S-3">
      </div>
      <div style="margin-top:12px;padding:12px 14px;border-radius:12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.18);font-size:.76rem;color:var(--slate-600);line-height:1.5">
        A default cover is assigned automatically from the selected category and will be used in student and faculty catalog views.
      </div>
    `;
}

renderInvTable = function renderInvTable(page) {
    invPage = page;
    const start = (page - 1) * invPPG;
    const rows = filteredInv.slice(start, start + invPPG);
    const tbody = byId('invTbody');
    if (!tbody) return;
    tbody.innerHTML = rows.length ? rows.map((book) => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:10px"><div style="width:34px;height:46px;flex-shrink:0">${LibraryApp.renderBookCover(book, { style: 'width:34px;height:46px;border-radius:6px' })}</div><div><div style="font-weight:600;font-size:.83rem;color:var(--slate-900);max-width:200px">${LibraryApp.escapeHtml(book.title)}</div><div style="font-size:.7rem;color:var(--slate-500)">${LibraryApp.escapeHtml(book.author)}</div></div></div></td>
        <td style="font-family:var(--font-mono);font-size:.72rem;color:var(--slate-500)">${LibraryApp.escapeHtml(book.isbn)}</td>
        <td><span class="pill p-slate" style="font-size:.64rem">${LibraryApp.escapeHtml(book.category)}</span></td>
        <td style="font-size:.85rem;text-align:center"><span style="font-weight:700;color:${book.avail === 0 ? 'var(--red)' : 'var(--emerald)'}">${book.avail}</span><span style="color:var(--slate-400)"> / ${book.total}</span></td>
        <td style="font-family:var(--font-mono);font-size:.75rem;color:var(--slate-500)">${LibraryApp.escapeHtml(book.location)}</td>
        <td><span class="pill ${book.avail > 0 ? 'p-green' : 'p-amber'}">${book.avail > 0 ? 'Live' : 'In Use'}</span></td>
        <td><span class="pill ${getInventoryStatusClass(book.status)}">${LibraryApp.escapeHtml(book.status)}</span></td>
        <td style="text-align:right"><div style="display:flex;gap:6px;justify-content:flex-end"><button class="btn btn-outline btn-sm btn-icon" onclick="openAddBook('${book.id}')">✏ Edit</button><button class="btn btn-outline btn-sm" onclick="toggleArchiveBook('${book.id}','${book.status}')">${book.status === 'Archived' ? '♻️ Restore' : '📦 Archive'}</button><button class="btn btn-danger btn-sm" onclick="openDiscard('${book.id}','${book.title.replace(/'/g, '&#39;')}')">🗑 Discard</button></div></td>
      </tr>
    `).join('') : '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--slate-400);font-size:.85rem">No live books match your filter.</td></tr>';
    if (byId('invCount')) byId('invCount').textContent = `${filteredInv.length} book${filteredInv.length === 1 ? '' : 's'}`;
    if (byId('invPaginInfo')) {
        const end = Math.min(start + invPPG, filteredInv.length);
        byId('invPaginInfo').textContent = filteredInv.length ? `Showing ${start + 1}-${end} of ${filteredInv.length}` : 'No records';
    }
    window.renderPgn('invPagination', page, Math.max(1, Math.ceil(filteredInv.length / invPPG)), renderInvTable);
};

window.addFromScanner = async function addFromScanner() {
    const isbn = String(byId('invIsbn')?.value || '').trim();
    const existing = getInventoryBooks().find((book) => String(book.isbn || '').replace(/-/g, '') === isbn.replace(/-/g, ''));
    if (!existing) {
        window.openAddBook();
        if (byId('abIsbn')) byId('abIsbn').value = isbn;
        if (byId('abLocation')) byId('abLocation').value = byId('if-shelf')?.value || '';
        if (byId('abTitle') && !byId('abTitle').value) byId('abTitle').focus();
        window.toast('info', 'ISBN not found in inventory. Complete the full form to add it.', '📚');
        return;
    }
    try {
        const raw = getRawInventoryBook(existing.id);
        await LibraryApp.request(`/api/librarian/books/${existing.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: raw.title,
                author: raw.author,
                isbn: raw.isbn,
                category: raw.category,
                year: raw.year,
                totalCopies: Number(raw.totalCopies || 0) + 1,
                location: byId('if-shelf')?.value || raw.location,
            }),
        });
        clearScannerFields();
        window.toast('ok', `Added one more copy of "${existing.title}" to inventory.`, '📚');
        await reloadLibrarianLiveData({ preserveMode: true });
    } catch (error) {
        window.toast('err', error.message || 'Unable to add this copy.', '❌');
    }
};

window.openAddBook = function openAddBook(bookId = '') {
    editingInventoryBookId = bookId || null;
    const rawBook = bookId ? getRawInventoryBook(bookId) : null;
    const body = byId('addBookBody');
    if (body) body.innerHTML = renderBookForm(rawBook);
    window.openM('addBookModal');
};

window.toggleArchiveBook = async function toggleArchiveBook(bookId, status) {
    const action = status === 'Archived' ? 'restore' : 'archive';
    try {
        await LibraryApp.request(`/api/librarian/books/${bookId}/${action}`, { method: 'POST' });
        window.toast('ok', `Inventory record ${action === 'restore' ? 'restored' : 'archived'} successfully.`, action === 'restore' ? '♻️' : '📦');
        await reloadLibrarianLiveData({ preserveMode: true });
    } catch (error) {
        window.toast('err', error.message || `Unable to ${action} this inventory record.`, '❌');
    }
};

window.saveNewBook = async function saveNewBook() {
    const payload = {
        title: String(byId('abTitle')?.value || '').trim(),
        author: String(byId('abAuthor')?.value || '').trim(),
        isbn: String(byId('abIsbn')?.value || '').trim(),
        category: String(byId('abCategory')?.value || '').trim(),
        year: Number(byId('abYear')?.value || 0),
        totalCopies: Number(byId('abCopies')?.value || 0),
        location: String(byId('abLocation')?.value || '').trim(),
    };
    try {
        const wasEditing = Boolean(editingInventoryBookId);
        if (wasEditing) {
            await LibraryApp.request(`/api/librarian/books/${editingInventoryBookId}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
        } else {
            await LibraryApp.request('/api/librarian/books', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
        }
        window.closeM('addBookModal');
        editingInventoryBookId = null;
        window.toast('ok', `Inventory ${wasEditing ? 'updated' : 'saved'} successfully.`, '💾');
        await reloadLibrarianLiveData({ preserveMode: true });
    } catch (error) {
        window.toast('err', error.message || 'Unable to save this inventory record.', '❌');
    }
};

window.confirmDiscard = async function confirmDiscard() {
    const reason = document.querySelector('.reason-opt.selected input')?.value;
    if (!reason) {
        window.toast('err', 'Please select a discard reason.', '❌');
        return;
    }
    try {
        await LibraryApp.request(`/api/librarian/books/${discardBookId}/discard`, {
            method: 'POST',
            body: JSON.stringify({
                reason,
                notes: String(byId('discardNotes')?.value || '').trim(),
            }),
        });
        window.closeM('discardModal');
        window.toast('ok', `Discard recorded with reason: ${reason}.`, '🗑');
        await reloadLibrarianLiveData({ preserveMode: true });
    } catch (error) {
        window.toast('err', error.message || 'Unable to discard this copy.', '❌');
    }
};

window.handleFineTransactions = function handleFineTransactions(transactions) {
    pendingFineTransactions = Array.isArray(transactions) ? transactions : [];
    pendingFineAmount = pendingFineTransactions.reduce((sum, item) => sum + Number(item.fine || 0), 0);
    if (byId('finePaymentMode')) byId('finePaymentMode').value = '';
    if (byId('fineReceiptNumber')) byId('fineReceiptNumber').value = '';
    const body = byId('fineModalBody');
    if (body) {
        body.innerHTML = pendingFineTransactions.length ? `
        <div style="display:grid;gap:10px">
          ${pendingFineTransactions.map((item) => `<div style="padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)">
            <div style="font-weight:700;color:var(--slate-900)">${LibraryApp.escapeHtml(item.bookTitle || 'Book')}</div>
            <div style="font-size:.78rem;color:var(--slate-500)">${LibraryApp.escapeHtml(item.userName || '')} - ${LibraryApp.escapeHtml(item.userId || '')}</div>
            <div style="font-size:.82rem;color:var(--red);margin-top:4px">Fine ${formatRupees(item.fine)} - ${item.fineStatus || 'Pending'}</div>
          </div>`).join('')}
          <div style="padding-top:6px;font-weight:800;color:var(--slate-900)">Total Fine: ${formatRupees(pendingFineAmount)}</div>
        </div>`
            : '<div style="color:var(--slate-500)">No pending fine records.</div>';
    }
    window.openM('fineModal');
};

async function settleFine(action, extra = {}) {
    if (!pendingFineTransactions.length) {
        window.toast('warn', 'No fine records are selected.', '⚠');
        return;
    }
    if (action === 'paid' && !byId('finePaymentMode')?.value) {
        window.toast('warn', 'Choose a payment mode before recording payment.', '⚠');
        return;
    }
    try {
        const payload = await LibraryApp.request('/api/librarian/fines/settle', {
            method: 'POST',
            body: JSON.stringify({
                action,
                transactionIds: pendingFineTransactions.map((item) => item.id),
                paymentMode: byId('finePaymentMode')?.value || '',
                receiptNumber: byId('fineReceiptNumber')?.value || '',
                ...extra,
            }),
        });
        pendingFineTransactions = [];
        pendingFineAmount = 0;
        window.closeM('waiveModal');
        window.closeM('fineModal');
        window.toast('ok', `${payload.processed.length} fine record${payload.processed.length === 1 ? '' : 's'} updated.`, action === 'ledger' ? '📒' : action === 'waive' ? '🤝' : '💰');
        await reloadLibrarianLiveData({ preserveLookup: true, preserveMode: true });
    } catch (error) {
        window.toast('err', error.message || 'Unable to update fine records.', '❌');
    }
}

window.payFine = function payFine() {
    settleFine('paid');
};

window.addToLedger = function addToLedger() {
    settleFine('ledger');
};

window.waveFine = function waveFine() {
    window.closeM('fineModal');
    window.openM('waiveModal');
};

window.confirmWaive = function confirmWaive() {
    const reason = byId('waiveReason')?.value;
    if (!reason) {
        window.toast('err', 'Please choose a waiver reason.', '❌');
        return;
    }
    settleFine('waive', {
        reason,
        notes: String(byId('waiveNotes')?.value || '').trim(),
    });
};

window.showLibrarianNotificationsToast = function showLibrarianNotificationsToast() {
    renderDeskNotificationsModal();
    window.openM('deskNotifModal');
};

window.sendLibrarianReminders = async function sendLibrarianReminders() {
    try {
        const dueIds = (getLibrarianData().dueItems || []).map((item) => item.id);
        const payload = await LibraryApp.request('/api/librarian/reminders', {
            method: 'POST',
            body: JSON.stringify({ transactionIds: dueIds }),
        });
        window.toast('ok', `Prepared ${payload.count} reminder notice${payload.count === 1 ? '' : 's'}.`, '📧');
        await reloadLibrarianLiveData({ preserveMode: true });
    } catch (error) {
        window.toast('err', error.message || 'Unable to prepare reminders.', '❌');
    }
};

window.handleOmni = function handleOmni(val) {
    const input = String(val || '').trim();
    const resultsBox = byId('omniResults');
    if (resultsBox) {
        resultsBox.innerHTML = '';
        resultsBox.classList.remove('open');
    }
    if (!input) return;
    const books = getInventoryBooks();
    const reportRows = getReportRows();
    const members = [...new Map(reportRows.map((row) => [row.userId, { userId: row.userId, user: row.user }])).values()].filter((entry) => entry.userId && entry.userId !== '-');
    const compact = input.replace(/-/g, '');
    const openResults = [];
    if (/^\d{10,13}$/.test(compact)) {
        const book = books.find((entry) => String(entry.isbn).replace(/-/g, '') === compact);
        if (book) {
            openResults.push({
                icon: '📘', title: book.title, subtitle: `${book.isbn} · ${book.status}`, run() {
                    window.nav('inventory', document.querySelector('[data-sec=inventory]'));
                    if (byId('invSearch')) byId('invSearch').value = input;
                    window.filterInv();
                }
            });
        }
        if (!book) window.toast('warn', `ISBN ${input} is not in the live catalog.`, '⚠');
    } else if (/^(?:\d{2}VR|STD-|FAC-|ADM-|LIB-)/i.test(input)) {
        openResults.push(...members.filter((entry) => entry.userId.toLowerCase().includes(input.toLowerCase())).slice(0, 4).map((entry) => ({
            icon: '👤',
            title: entry.user,
            subtitle: entry.userId,
            run() {
                window.nav('circulation', document.querySelector('[data-sec=circulation]'));
                if (byId('studentIdInput')) byId('studentIdInput').value = entry.userId;
                if (typeof window.lookupStudent === 'function') window.lookupStudent(entry.userId);
            },
        })));
    } else if (input.length > 2) {
        openResults.push(...books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(input.toLowerCase())).slice(0, 4).map((book) => ({
            icon: '🔍',
            title: book.title,
            subtitle: `${book.author} · ${book.status}`,
            run() {
                window.nav('inventory', document.querySelector('[data-sec=inventory]'));
                if (byId('invSearch')) byId('invSearch').value = input;
                window.filterInv();
            },
        })));
        openResults.push(...members.filter((entry) => entry.user.toLowerCase().includes(input.toLowerCase())).slice(0, 2).map((entry) => ({
            icon: '👤',
            title: entry.user,
            subtitle: entry.userId,
            run() {
                window.nav('circulation', document.querySelector('[data-sec=circulation]'));
                if (byId('studentIdInput')) byId('studentIdInput').value = entry.userId;
                if (typeof window.lookupStudent === 'function') window.lookupStudent(entry.userId);
            },
        })));
    }
    if (resultsBox && openResults.length) {
        resultsBox.classList.add('open');
        resultsBox.innerHTML = openResults.map((item, index) => `
        <div class="omni-result">
          <div>
            <div style="font-weight:700">${item.icon} ${LibraryApp.escapeHtml(item.title)}</div>
            <div style="font-size:.74rem;color:rgba(255,255,255,.6)">${LibraryApp.escapeHtml(item.subtitle)}</div>
          </div>
          <button class="btn btn-sm btn-outline" data-omni-index="${index}" style="background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.18)">Open</button>
        </div>
      `).join('');
        resultsBox.querySelectorAll('[data-omni-index]').forEach((button) => {
            button.addEventListener('click', () => openResults[Number(button.dataset.omniIndex)]?.run());
        });
        return;
    }
    if (/^\d{10,13}$/.test(compact)) {
        return;
    }
    if (input.length > 2) window.toast('warn', `No live results match "${input}".`, '⚠');
};

window.exportLibrarianCsv = function exportLibrarianCsv() {
    const headers = ['Time', 'User', 'User ID', 'Book', 'Type', 'Due Date', 'Fine', 'Librarian'];
    const rows = filteredRpt.map((row) => [row.time, row.user, row.userId, row.book, row.type, row.due, row.fine, row.lib]);
    const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'librarian-report.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    window.toast('ok', `Exported ${rows.length} report row${rows.length === 1 ? '' : 's'}.`, '📥');
};

window.undoLastDeskAction = async function undoLastDeskAction() {
    try {
        const payload = await LibraryApp.request('/api/librarian/undo-last', { method: 'POST' });
        window.toast('ok', payload.summary || 'Last desk action was undone.', '↩️');
        await reloadLibrarianLiveData({ preserveLookup: true, preserveMode: true });
    } catch (error) {
        window.toast('warn', error.message || 'There is nothing to undo right now.', '↩️');
    }
};

document.addEventListener('keydown', (event) => {
    if (event.altKey) {
        if (event.key === 's' || event.key === 'S') {
            event.preventDefault();
            window.nav('dashboard', document.querySelector('[data-sec=dashboard]'));
            setTimeout(() => byId('omniInput')?.focus(), 100);
        }
        if (event.key === 'i' || event.key === 'I') {
            event.preventDefault();
            window.nav('circulation', document.querySelector('[data-sec=circulation]'));
            setTimeout(() => { if (typeof window.setMode === 'function') window.setMode('issue'); }, 100);
        }
        if (event.key === 'r' || event.key === 'R') {
            event.preventDefault();
            window.nav('circulation', document.querySelector('[data-sec=circulation]'));
            setTimeout(() => { if (typeof window.setMode === 'function') window.setMode('return'); }, 100);
        }
    }
    if (event.key === 'Escape') document.querySelectorAll('.ovl.open').forEach((overlay) => window.closeM(overlay.id));
});

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().slice(0, 10);
    if (byId('rptFrom')) byId('rptFrom').value = today;
    if (byId('rptTo')) byId('rptTo').value = today;
    if (byId('issueDueDate')) byId('issueDueDate').value = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    byId('omniInput')?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.target.value = '';
            byId('omniResults')?.classList.remove('open');
            if (byId('omniResults')) byId('omniResults').innerHTML = '';
            event.target.blur();
        }
        if (event.key === 'Enter') window.handleOmni(event.target.value);
    });
    window.refreshLibrarianShellData();
});
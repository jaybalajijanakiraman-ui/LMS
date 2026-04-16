const COLORS = ['#3b82f6', '#c9a84c', '#14b8a6', '#8b5cf6', '#ef4444', '#22c55e', '#f59e0b', '#0ea5e9'];
const ROLE_COLORS = { Student: '#3b82f6', Faculty: '#22c55e', Librarian: '#c9a84c', Administrator: '#ef4444' };

const ADMIN_STATE = {
  auditLog: [],
  books: [],
  currentReport: 'user-growth',
  currentReportRange: '7d',
  currentUser: null,
  filteredAudit: [],
  filteredBooks: [],
  filteredTx: [],
  filteredUsers: [],
  insights: [],
  meta: { refreshedAt: '', refreshReason: 'load', userSort: { key: 'joined', dir: 'desc' } },
  notifications: [],
  pendingApprovals: [],
  reportData: null,
  searchResults: { total: 0, users: [], books: [], transactions: [] },
  stats: { totalUsers: 0, totalBooks: 0, activeLoans: 0, overdue: 0 },
  system: { lastBackupTime: '-' },
  transactions: [],
  users: [],
};

let editingUserId = null;
let editingBookId = null;
let currentBookId = null;
let activityFeedLimit = 6;
let reportMainChart = null;
let reportPieChart = null;
let trendChart = null;
let catChart = null;
let userPage = 1;
let bookPage = 1;
let auditPage = 1;
let userSortState = { key: 'joined', dir: 'desc' };
let resetPasswordUserId = null;
let searchDebounce = 0;
const USERS_PER_PAGE = 8;
const BOOKS_PER_PAGE = 8;
const AUDIT_PER_PAGE = 8;

function setInventoryAddAction() {
  const inventoryHeader = document.querySelector('#sec-inventory .section-header .btn.btn-primary');
  if (inventoryHeader) inventoryHeader.setAttribute('onclick', 'openBookForm()');
}

function navigate(section, el) {
  document.querySelectorAll('.sb-item').forEach((item) => item.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.section').forEach((item) => item.classList.remove('active'));
  document.getElementById(`sec-${section}`)?.classList.add('active');

  const titles = {
    dashboard: ['\uD83C\uDFE0', 'Dashboard', '/ Overview'],
    users: ['\uD83D\uDC65', 'User Management', '/ Accounts & Roles'],
    inventory: ['\uD83D\uDCDA', 'Library Inventory', '/ Books & Resources'],
    transactions: ['\uD83D\uDD04', 'Transactions', '/ Loans & Returns'],
    reports: ['\uD83D\uDCCA', 'Reports & Analytics', '/ Insights'],
    system: ['\u2699', 'System Maintenance', '/ Backup & Settings'],
    audit: ['\uD83E\uDDFE', 'Audit Log', '/ Activity History'],
  };

  const [icon, title, breadcrumb] = titles[section] || ['\uD83D\uDCCC', section, '/'];
  document.getElementById('topbarIcon').textContent = icon;
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('topbarBreadcrumb').textContent = breadcrumb;

  if (section === 'users') renderUserTable(userPage);
  if (section === 'inventory') renderBookTable(bookPage);
  if (section === 'transactions') renderTxTable();
  if (section === 'reports') initReports();
  if (section === 'audit') renderAuditLog(auditPage);
}

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('collapsed'); }

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

let confirmCallback = null;
function confirmAction(title, msg, icon, callback) {
  document.getElementById('confirmIcon').textContent = icon || '\u26A0';
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').innerHTML = msg;
  confirmCallback = callback;
  document.getElementById('confirmOkBtn').onclick = () => {
    closeModal('confirmOverlay');
    if (confirmCallback) confirmCallback();
  };
  openModal('confirmOverlay');
}

function showToast(type, msg, icon = '\u2139') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">\u00D7</button>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(24px)';
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

function renderPagination(containerId, currentPage, totalPages, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  let html = `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${callback.name}(${currentPage - 1})">\u2039</button>`;
  for (let index = 1; index <= totalPages; index += 1) {
    if (index === 1 || index === totalPages || Math.abs(index - currentPage) <= 1) {
      html += `<button class="page-btn ${index === currentPage ? 'active' : ''}" onclick="${callback.name}(${index})">${index}</button>`;
    } else if (Math.abs(index - currentPage) === 2) {
      html += '<span style="padding:0 4px;color:var(--text-muted);font-size:.8rem">\u2026</span>';
    }
  }
  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${callback.name}(${currentPage + 1})">\u203A</button>`;
  container.innerHTML = html;
}

function updateStats() {
  document.getElementById('stat-users').textContent = Number(ADMIN_STATE.stats.totalUsers || 0).toLocaleString('en-IN');
  document.getElementById('stat-books').textContent = Number(ADMIN_STATE.stats.totalBooks || 0).toLocaleString('en-IN');
  document.getElementById('stat-loans').textContent = Number(ADMIN_STATE.stats.activeLoans || 0).toLocaleString('en-IN');
  document.getElementById('stat-overdue').textContent = Number(ADMIN_STATE.stats.overdue || 0).toLocaleString('en-IN');
}

function goToSection(section) {
  const target = document.querySelector(`[data-section=${section}]`);
  navigate(section, target);
}

function updateClock() {
  const clock = document.getElementById('live-time');
  if (!clock) return;
  const date = new Date();
  clock.textContent = `${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • ${date.toLocaleTimeString('en-IN')}`;
}

function renderInsights() {
  const container = document.getElementById('dashboardInsights');
  if (!container) return;
  const insights = ADMIN_STATE.insights || [];
  container.innerHTML = insights.length ? insights.map((item) => `
    <div class="insight-card tone-${LibraryApp.escapeHtml(item.tone || 'blue')}">
      <div class="insight-label">${LibraryApp.escapeHtml(item.label)}</div>
      <div class="insight-value">${LibraryApp.escapeHtml(String(item.value ?? 0))}</div>
      <div class="insight-detail">${LibraryApp.escapeHtml(item.detail || '')}</div>
    </div>`).join('') : '';
}

function renderActivityFeed() {
  const feed = document.getElementById('activityFeed');
  const entries = ADMIN_STATE.auditLog.slice(0, activityFeedLimit);
  feed.innerHTML = entries.length ? entries.map((item) => `
    <div class="feed-item">
      <div class="feed-dot" style="background:${item.status >= 400 ? 'var(--red)' : 'var(--blue)'}"></div>
      <div>
        <div class="feed-text">${LibraryApp.escapeHtml(item.action)}</div>
        <div class="feed-meta">${LibraryApp.escapeHtml(item.user)} \u2022 ${LibraryApp.escapeHtml(item.ts)}</div>
      </div>
    </div>`).join('') : '<div class="empty-state"><div class="es-icon">\uD83D\uDCED</div><p>No admin activity yet.</p></div>';
}

function renderPendingApprovals() {
  const pending = [
    { title: `Catalog books currently available: ${ADMIN_STATE.books.length}`, subtitle: 'Live catalog availability', icon: '📚' },
    { title: `Members who can log in: ${Math.max(ADMIN_STATE.users.filter((user) => user.status === 'Active').length - 1, 0)}`, subtitle: 'Active member accounts', icon: '👥' },
    { title: `Current active loans: ${ADMIN_STATE.stats.activeLoans}`, subtitle: ADMIN_STATE.stats.overdue ? `${ADMIN_STATE.stats.overdue} overdue need attention` : 'No overdue items right now', icon: '🔄' },
  ];
  const countNode = document.getElementById('pendingCount');
  if (countNode) countNode.textContent = `${pending.length} live item${pending.length === 1 ? '' : 's'} need attention`;
  document.getElementById('pendingApprovals').innerHTML = pending.map((item, index) => `
    <div class="approval-item">
      <div class="approval-icon" style="background:rgba(59,130,246,.1)">${item.icon}</div>
      <div class="approval-info">
        <div class="approval-title">${LibraryApp.escapeHtml(item.title)}</div>
        <div class="approval-sub">${LibraryApp.escapeHtml(item.subtitle)}</div>
      </div>
    </div>`).join('');
}

function applyOverview(payload) {
  ADMIN_STATE.currentUser = payload.currentUser;
  ADMIN_STATE.users = payload.users || [];
  ADMIN_STATE.books = payload.books || [];
  ADMIN_STATE.transactions = payload.transactions || [];
  ADMIN_STATE.auditLog = payload.auditLog || [];
  ADMIN_STATE.meta = payload.meta || ADMIN_STATE.meta;
  ADMIN_STATE.stats = payload.stats || ADMIN_STATE.stats;
  ADMIN_STATE.system = payload.system || ADMIN_STATE.system;
  ADMIN_STATE.filteredUsers = [...ADMIN_STATE.users];
  ADMIN_STATE.filteredBooks = [...ADMIN_STATE.books];
  ADMIN_STATE.filteredTx = [...ADMIN_STATE.transactions];
  ADMIN_STATE.filteredAudit = [...ADMIN_STATE.auditLog];
  if (payload.meta?.userSort) userSortState = payload.meta.userSort;
  document.getElementById('lastBackupTime').textContent = ADMIN_STATE.system.lastBackupTime || '-';

  const userName = document.querySelector('.sb-user-name');
  const userRole = document.querySelector('.sb-user-role');
  const avatar = document.querySelector('.sb-avatar');
  if (userName) userName.textContent = ADMIN_STATE.currentUser.user_name;
  if (userRole) userRole.textContent = ADMIN_STATE.currentUser.role;
  if (avatar) avatar.textContent = LibraryApp.initials(ADMIN_STATE.currentUser.user_name) || 'AD';

  updateStats();
  updateClock();
  renderActivityFeed();
  renderPendingApprovals();
  renderSystemStatus();
  initTrendChart();
  initCatChart();
  syncSystemForm();
  populateRestorePoints();
  populateIssueOptions();
  renderUserTable(1);
  renderBookTable(1);
  renderTxTable();
  renderAuditLog(1);
  initReports();
}

async function loadOverview() {
  const params = new URLSearchParams({
    userSortKey: userSortState.key,
    userSortDir: userSortState.dir,
  });
  const payload = await LibraryApp.request(`/api/admin/overview?${params.toString()}`);
  applyOverview(payload);
  return payload;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function syncSystemForm() {
  const system = ADMIN_STATE.system || {};
  const schedule = system.backupSchedule || {};
  const setValue = (id, value) => {
    const field = document.getElementById(id);
    if (field) field.value = value;
  };
  const setChecked = (id, value) => {
    const field = document.getElementById(id);
    if (field) field.checked = Boolean(value);
  };

  setValue('sysLoanPeriod', Number(system.loanPeriodDays || 14));
  setValue('sysMaxBooks', Number(system.maxBooksPerStudent || 3));
  setValue('sysFineRate', Number(system.fineRate || 2));
  setValue('sysRenewalLimit', Number(system.renewalLimit || 2));
  setChecked('dailyBackupToggle', schedule.daily);
  setChecked('weeklyBackupToggle', schedule.weekly);
  setChecked('monthlyBackupToggle', schedule.monthly);
}

function populateRestorePoints() {
  const select = document.getElementById('restorePoint');
  const meta = document.getElementById('backupMeta');
  const restorePoints = ADMIN_STATE.system.restorePoints || [];
  if (select) {
    select.innerHTML = restorePoints.length
      ? restorePoints.map((item) => `<option value="${LibraryApp.escapeHtml(item.id)}">${LibraryApp.formatDate(item.createdAt)} • ${LibraryApp.escapeHtml(item.label || 'Backup')} • ${formatBytes(item.sizeBytes)}</option>`).join('')
      : '<option value="">No restore points available</option>';
  }
  if (meta) {
    meta.textContent = restorePoints.length
      ? `${formatBytes(restorePoints[0].sizeBytes)} • ${restorePoints.length} restore point${restorePoints.length === 1 ? '' : 's'}`
      : 'No restore points yet';
  }
}

function renderSystemStatus() {
  const container = document.getElementById('systemStatus');
  if (!container) return;
  const services = [
    { name: 'Admin API', status: 'Connected', pill: 'pill-green', pulse: 'pulse-green' },
    { name: 'Shared Catalog', status: `${ADMIN_STATE.books.length} titles`, pill: 'pill-blue', pulse: 'pulse-green' },
    { name: 'Backup Store', status: `${(ADMIN_STATE.system.restorePoints || []).length} snapshots`, pill: 'pill-amber', pulse: 'pulse-amber' },
    { name: 'Loan Monitor', status: ADMIN_STATE.stats.overdue ? `${ADMIN_STATE.stats.overdue} overdue` : 'Clear', pill: ADMIN_STATE.stats.overdue ? 'pill-red' : 'pill-green', pulse: ADMIN_STATE.stats.overdue ? 'pulse-amber' : 'pulse-green' },
  ];
  container.innerHTML = services.map((service) => `
    <div class="status-row">
      <span class="status-name"><span class="pulse ${service.pulse}"></span>${LibraryApp.escapeHtml(service.name)}</span>
      <span class="status-pill ${service.pill}">${LibraryApp.escapeHtml(service.status)}</span>
    </div>`).join('');
}

function buildMonthlySeries(monthCount) {
  const now = new Date();
  const buckets = Array.from({ length: monthCount }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (monthCount - index - 1), 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: start.toLocaleDateString('en-IN', { month: 'short', year: monthCount > 6 ? '2-digit' : undefined }),
      issued: 0,
      returned: 0,
    };
  });
  ADMIN_STATE.transactions.forEach((item) => {
    const checkoutKey = String(item.checkout || '').slice(0, 7);
    const returnKey = String(item.returned || '').slice(0, 7);
    const checkoutBucket = buckets.find((bucket) => bucket.key === checkoutKey);
    if (checkoutBucket) checkoutBucket.issued += 1;
    const returnBucket = buckets.find((bucket) => bucket.key === returnKey);
    if (returnBucket) returnBucket.returned += 1;
  });
  return buckets;
}

function initTrendChart(range = 'Last 6 Months') {
  const canvas = document.getElementById('trendChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const normalized = String(range || 'Last 6 Months');
  const monthCount = normalized.includes('12') ? 12 : normalized.includes('Year') ? Math.max(new Date().getMonth() + 1, 1) : 6;
  const series = buildMonthlySeries(monthCount);
  const data = {
    labels: series.map((bucket) => bucket.label),
    datasets: [
      { label: 'Issued', data: series.map((bucket) => bucket.issued), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.18)', tension: 0.35, fill: true },
      { label: 'Returned', data: series.map((bucket) => bucket.returned), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.12)', tension: 0.35, fill: true },
    ],
  };
  if (!trendChart) {
    trendChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data,
      options: {
        responsive: true,
        plugins: { legend: { labels: { font: { family: 'DM Sans', size: 11 }, usePointStyle: true } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 } } },
          y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { precision: 0, font: { family: 'DM Sans', size: 10 } } },
        },
      },
    });
  } else {
    trendChart.data = data;
    trendChart.update();
  }
}

function updateTrendChart(range) {
  initTrendChart(range);
}

function initCatChart() {
  const canvas = document.getElementById('catChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const grouped = ADMIN_STATE.books.reduce((acc, book) => {
    acc[book.category] = (acc[book.category] || 0) + Number(book.totalCopies || 0);
    return acc;
  }, {});
  const labels = Object.keys(grouped).length ? Object.keys(grouped) : ['No Books'];
  const values = Object.keys(grouped).length ? Object.values(grouped) : [1];
  if (!catChart) {
    catChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: COLORS, borderColor: '#fff', borderWidth: 2 }],
      },
      options: {
        responsive: true,
        cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, usePointStyle: true } } },
      },
    });
  } else {
    catChart.data.labels = labels;
    catChart.data.datasets[0].data = values;
    catChart.update();
  }
}

function populateIssueOptions() {
  const userSelect = document.getElementById('issueUser');
  const bookSelect = document.getElementById('issueBook');
  if (userSelect) {
    const borrowers = ADMIN_STATE.users.filter((user) => user.role !== 'Administrator');
    userSelect.innerHTML = borrowers.map((user) => `<option value="${LibraryApp.escapeHtml(user.id)}">${LibraryApp.escapeHtml(user.user_name)} • ${LibraryApp.escapeHtml(user.userId)} • ${LibraryApp.escapeHtml(user.role)}</option>`).join('');
  }
  if (bookSelect) {
    const availableBooks = ADMIN_STATE.books.filter((book) => Number(book.availCopies || 0) > 0);
    bookSelect.innerHTML = availableBooks.length
      ? availableBooks.map((book) => `<option value="${LibraryApp.escapeHtml(book.id)}">${LibraryApp.escapeHtml(book.title)} • ${book.availCopies}/${book.totalCopies} available</option>`).join('')
      : '<option value="">No available books</option>';
  }
  updateIssuePreview();
}
function filterUsers() {
  const query = document.getElementById('userSearch').value.toLowerCase();
  const role = document.getElementById('roleFilter').value;
  const status = document.getElementById('statusFilter').value;
  ADMIN_STATE.filteredUsers = ADMIN_STATE.users.filter((user) =>
    (!query || `${user.user_name} ${user.userId} ${user.email}`.toLowerCase().includes(query)) &&
    (!role || user.role === role) &&
    (!status || user.status === status)
  );
  renderUserTable(1);
}

function renderUserTable(page) {
  userPage = page;
  const start = (page - 1) * USERS_PER_PAGE;
  const users = ADMIN_STATE.filteredUsers.slice(start, start + USERS_PER_PAGE);
  const tbody = document.getElementById('userTableBody');

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="es-icon">\uD83D\uDC65</div><p>No users match your filters.</p></div></td></tr>';
  } else {
    tbody.innerHTML = users.map((user) => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="u-avatar" style="background:${ROLE_COLORS[user.role] || '#64748b'}">${LibraryApp.initials(user.user_name)}</div>
            <div>
              <div class="u-name">${LibraryApp.escapeHtml(user.user_name)}</div>
              <div class="u-email">${LibraryApp.escapeHtml(user.email)}</div>
            </div>
          </div>
        </td>
        <td><span style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(user.userId)}</span></td>
        <td><span class="status-pill ${user.role === 'Administrator' ? 'pill-red' : user.role === 'Librarian' ? 'pill-amber' : user.role === 'Faculty' ? 'pill-teal' : 'pill-blue'}">${LibraryApp.escapeHtml(user.role)}</span></td>
        <td style="font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(user.dept)}</td>
        <td><span class="status-pill ${user.status === 'Active' ? 'pill-green' : user.status === 'Suspended' ? 'pill-red' : 'pill-navy'}">${LibraryApp.escapeHtml(user.status)}</span></td>
        <td style="font-size:.78rem;color:var(--text-muted)">${LibraryApp.formatDate(user.joined)}</td>
        <td style="text-align:right">
          <div class="kebab-wrap">
            <button class="kebab-btn" onclick="toggleKebab(event,'kb-${user.id}')">\u22EE</button>
            <div class="kebab-menu" id="kb-${user.id}">
              <div class="kebab-item" onclick="editUser('${user.id}')">\u270F Edit Details</div>
              <div class="kebab-item" onclick="toggleStatus('${user.id}')">${user.status === 'Active' ? '\u23F8 Deactivate' : '\u2705 Activate'}</div>
              <div class="kebab-divider"></div>
              <div class="kebab-item danger" onclick="deleteUser('${user.id}')">\uD83D\uDDD1 Delete Account</div>
            </div>
          </div>
        </td>
      </tr>`).join('');
  }

  document.getElementById('userCount').textContent = `${ADMIN_STATE.filteredUsers.length} users`;
  document.getElementById('userPaginInfo').textContent = ADMIN_STATE.filteredUsers.length ? `Showing ${start + 1}-${Math.min(start + USERS_PER_PAGE, ADMIN_STATE.filteredUsers.length)} of ${ADMIN_STATE.filteredUsers.length} users` : 'Showing 0 users';
  renderPagination('userPagination', page, Math.ceil(ADMIN_STATE.filteredUsers.length / USERS_PER_PAGE), renderUserTable);
}

function sortTable(table, key) {
  if (table !== 'users') return;
  const nextSort = {
    key,
    dir: userSortState.key === key && userSortState.dir === 'asc' ? 'desc' : 'asc',
  };
  userSortState = nextSort;
  loadOverview()
    .then(() => showToast('success', `Users sorted by ${key} (${nextSort.dir}).`, '\uD83D\uDDC2'))
    .catch((error) => showToast('error', error.message || 'Unable to sort users.', '\u26A0'));
}

function openUserModal(clear = true) {
  if (clear) {
    editingUserId = null;
    document.getElementById('userModalTitle').textContent = 'Add New User';
    ['mFirstName', 'mLastName', 'mUserId', 'mEmail', 'mPhone', 'mPassword', 'mConfirmPassword'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.value = '';
    });
    document.getElementById('mRole').value = '';
    document.getElementById('mStatus').value = 'Active';
  }
  openModal('userModal');
}

function editUser(id) {
  closeAllKebabs();
  const user = ADMIN_STATE.users.find((item) => item.id === id);
  if (!user) return;
  editingUserId = id;
  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('mFirstName').value = user.firstName || '';
  document.getElementById('mLastName').value = user.lastName || '';
  document.getElementById('mUserId').value = user.userId || '';
  document.getElementById('mEmail').value = user.email || '';
  document.getElementById('mPhone').value = user.phone || '';
  document.getElementById('mRole').value = user.role || '';
  document.getElementById('mDept').value = user.dept || '';
  document.getElementById('mStatus').value = user.status || 'Active';
  document.getElementById('mPassword').value = '';
  document.getElementById('mConfirmPassword').value = '';
  openModal('userModal');
}

async function saveUser() {
  const firstName = document.getElementById('mFirstName').value.trim();
  const lastName = document.getElementById('mLastName').value.trim();
  const userId = document.getElementById('mUserId').value.trim();
  const email = document.getElementById('mEmail').value.trim();
  const phone = document.getElementById('mPhone').value.trim();
  const role = document.getElementById('mRole').value;
  const dept = document.getElementById('mDept').value;
  const status = document.getElementById('mStatus').value;
  const password = document.getElementById('mPassword').value;
  const confirmPassword = document.getElementById('mConfirmPassword').value;

  if (!firstName || !lastName || !userId || !email || !role || !dept) {
    showToast('error', 'Please fill all required member fields.', '\u26A0');
    return;
  }
  if (!editingUserId && !password) {
    showToast('error', 'Please set a password for the new member.', '\uD83D\uDD12');
    return;
  }
  if ((password || confirmPassword) && password !== confirmPassword) {
    showToast('error', 'Passwords do not match.', '\uD83D\uDD10');
    return;
  }

  const body = { firstName, lastName, userId, email, phone, role, dept, status };
  if (password) body.password = password;

  try {
    if (editingUserId) {
      await LibraryApp.request(`/api/users/${editingUserId}`, { method: 'PUT', body: JSON.stringify(body) });
      showToast('success', 'Member account updated successfully.', '\u2705');
    } else {
      await LibraryApp.request('/api/users', { method: 'POST', body: JSON.stringify({ ...body, password }) });
      showToast('success', 'Member account created successfully.', '\uD83D\uDC64');
    }
    closeModal('userModal');
    await loadOverview();
  } catch (error) {
    showToast('error', error.message || 'Unable to save member.', '\u26A0');
  }
}

async function toggleStatus(id) {
  closeAllKebabs();
  const user = ADMIN_STATE.users.find((item) => item.id === id);
  if (!user) return;
  const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
  try {
    await LibraryApp.request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ ...user, status: nextStatus }) });
    showToast('success', `Account marked ${nextStatus}.`, '\uD83D\uDD04');
    await loadOverview();
  } catch (error) {
    showToast('error', error.message || 'Unable to update status.', '\u26A0');
  }
}

async function deleteUser(id) {
  closeAllKebabs();
  const user = ADMIN_STATE.users.find((item) => item.id === id);
  if (!user) return;
  confirmAction('Delete Account', `Delete <strong>${LibraryApp.escapeHtml(user.user_name)}</strong>? This will remove the member\'s login access.`, '\uD83D\uDDD1', async () => {
    try {
      await LibraryApp.request(`/api/users/${id}`, { method: 'DELETE' });
      showToast('success', 'Member deleted successfully.', '\uD83D\uDDD1');
      await loadOverview();
    } catch (error) {
      showToast('error', error.message || 'Unable to delete member.', '\u26A0');
    }
  });
}

function filterBooks() {
  const query = document.getElementById('bookSearch').value.toLowerCase();
  const category = document.getElementById('catFilter').value;
  const status = document.getElementById('availFilter').value;
  ADMIN_STATE.filteredBooks = ADMIN_STATE.books.filter((book) =>
    (!query || `${book.title} ${book.author} ${book.isbn}`.toLowerCase().includes(query)) &&
    (!category || book.category === category) &&
    (!status || book.status === status)
  );
  renderBookTable(1);
}

function renderBookTable(page) {
  bookPage = page;
  const start = (page - 1) * BOOKS_PER_PAGE;
  const books = ADMIN_STATE.filteredBooks.slice(start, start + BOOKS_PER_PAGE);
  const tbody = document.getElementById('bookTableBody');

  if (!books.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="es-icon">\uD83D\uDCDA</div><p>No books found in the shared catalog yet.</p></div></td></tr>';
  } else {
    tbody.innerHTML = books.map((book) => {
      const progress = book.totalCopies ? Math.round((book.availCopies / book.totalCopies) * 100) : 0;
      const coverColor = COLORS[Math.abs(book.title.length) % COLORS.length];
      return `
        <tr style="cursor:pointer" onclick="viewBook('${book.id}')">
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="book-cover-placeholder" style="background:${coverColor}22;color:${coverColor};width:40px;height:54px;font-size:1.2rem">\uD83D\uDCD8</div>
              <div>
                <div style="font-weight:600;font-size:.85rem;color:var(--navy);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${LibraryApp.escapeHtml(book.title)}</div>
                <div style="font-size:.73rem;color:var(--text-muted)">${LibraryApp.escapeHtml(book.author)} \u2022 ${LibraryApp.escapeHtml(String(book.year))}</div>
              </div>
            </div>
          </td>
          <td style="font-family:var(--font-mono);font-size:.72rem;color:var(--text-sec)">${LibraryApp.escapeHtml(book.isbn)}</td>
          <td><span class="status-pill pill-blue" style="font-size:.66rem">${LibraryApp.escapeHtml(book.category)}</span></td>
          <td style="font-size:.85rem;text-align:center">${book.totalCopies}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:.85rem;font-weight:600;color:${book.availCopies === 0 ? 'var(--red)' : 'var(--green)'}">${book.availCopies}</span>
              <div class="progress-bar" style="width:50px"><div class="progress-fill" style="width:${progress}%;background:${book.availCopies === 0 ? 'var(--red)' : 'var(--green)'}"></div></div>
            </div>
          </td>
          <td style="font-family:var(--font-mono);font-size:.75rem;color:var(--text-sec)">${LibraryApp.escapeHtml(book.location)}</td>
          <td><span class="status-pill ${book.status === 'Available' ? 'pill-green' : 'pill-amber'}">${LibraryApp.escapeHtml(book.status)}</span></td>
          <td style="text-align:right;padding-right:16px"><button class="btn btn-outline btn-sm" onclick="event.stopPropagation();viewBook('${book.id}')">\uD83D\uDC41</button></td>
        </tr>`;
    }).join('');
  }

  document.getElementById('bookCount').textContent = `${ADMIN_STATE.filteredBooks.length} books`;
  document.getElementById('bookPaginInfo').textContent = ADMIN_STATE.filteredBooks.length ? `Showing ${start + 1}-${Math.min(start + BOOKS_PER_PAGE, ADMIN_STATE.filteredBooks.length)} of ${ADMIN_STATE.filteredBooks.length} books` : 'Showing 0 books';
  renderPagination('bookPagination', page, Math.ceil(ADMIN_STATE.filteredBooks.length / BOOKS_PER_PAGE), renderBookTable);
}
function openBookForm(bookId = '') {
  const book = bookId ? ADMIN_STATE.books.find((item) => item.id === bookId) : null;
  editingBookId = book ? book.id : null;
  document.getElementById('bookModalTitle').textContent = book ? 'Edit Book' : 'Add New Book';
  document.getElementById('bookModalBody').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Title *</label><input class="form-control" id="bTitle" placeholder="Book title" value="${LibraryApp.escapeHtml(book?.title || '')}"></div>
      <div class="form-group"><label class="form-label">Author *</label><input class="form-control" id="bAuthor" placeholder="Author name" value="${LibraryApp.escapeHtml(book?.author || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">ISBN *</label><input class="form-control" id="bIsbn" placeholder="978-..." value="${LibraryApp.escapeHtml(book?.isbn || '')}"></div>
      <div class="form-group"><label class="form-label">Category *</label><select class="form-control" id="bCategory"><option ${book?.category === 'Computer Science' ? 'selected' : ''}>Computer Science</option><option ${book?.category === 'Electronics' ? 'selected' : ''}>Electronics</option><option ${book?.category === 'Mathematics' ? 'selected' : ''}>Mathematics</option><option ${book?.category === 'Management' ? 'selected' : ''}>Management</option><option ${book?.category === 'Physics' ? 'selected' : ''}>Physics</option><option ${book?.category === 'General Fiction' ? 'selected' : ''}>General Fiction</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Year *</label><input class="form-control" id="bYear" type="number" placeholder="2026" value="${LibraryApp.escapeHtml(String(book?.year || ''))}"></div>
      <div class="form-group"><label class="form-label">Copies *</label><input class="form-control" id="bCopies" type="number" min="1" value="${LibraryApp.escapeHtml(String(book?.totalCopies || 1))}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Shelf Location *</label><input class="form-control" id="bLocation" placeholder="A-1-S-1" value="${LibraryApp.escapeHtml(book?.location || '')}"></div>
    </div>`;
  document.querySelector('#bookModal .modal-footer').innerHTML = `<button class="btn btn-outline" onclick="closeModal('bookModal')">Cancel</button><button class="btn btn-primary" onclick="saveBook()">\uD83D\uDCBE ${book ? 'Save Changes' : 'Save Book'}</button>`;
  openModal('bookModal');
}

async function saveBook() {
  const title = document.getElementById('bTitle').value.trim();
  const author = document.getElementById('bAuthor').value.trim();
  const isbn = document.getElementById('bIsbn').value.trim();
  const category = document.getElementById('bCategory').value.trim();
  const year = Number(document.getElementById('bYear').value);
  const totalCopies = Number(document.getElementById('bCopies').value);
  const location = document.getElementById('bLocation').value.trim();
  try {
    const path = editingBookId ? `/api/books/${editingBookId}` : '/api/books';
    const method = editingBookId ? 'PUT' : 'POST';
    await LibraryApp.request(path, { method, body: JSON.stringify({ title, author, isbn, category, year, totalCopies, location }) });
    closeModal('bookModal');
    showToast('success', editingBookId ? 'Book details updated successfully.' : 'Book added to the shared catalog.', editingBookId ? '\u2705' : '\uD83D\uDCDA');
    editingBookId = null;
    await loadOverview();
  } catch (error) {
    showToast('error', error.message || 'Unable to save book.', '\u26A0');
  }
}

function viewBook(id) {
  const book = ADMIN_STATE.books.find((item) => item.id === id);
  if (!book) return;
  currentBookId = id;
  const coverColor = COLORS[Math.abs(book.title.length) % COLORS.length];
  document.getElementById('bookModalTitle').textContent = book.title;
  document.getElementById('bookModalBody').innerHTML = `
    <div style="display:flex;gap:20px;margin-bottom:16px">
      <div style="width:80px;height:110px;border-radius:8px;background:${coverColor}22;display:flex;align-items:center;justify-content:center;font-size:2.5rem;flex-shrink:0">\uD83D\uDCD6</div>
      <div>
        <div style="font-family:var(--font-display);font-size:1.2rem;font-weight:700;color:var(--navy);margin-bottom:4px">${LibraryApp.escapeHtml(book.title)}</div>
        <div style="font-size:.85rem;color:var(--text-sec);margin-bottom:6px">By <strong>${LibraryApp.escapeHtml(book.author)}</strong> \u2022 ${LibraryApp.escapeHtml(String(book.year))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="status-pill pill-blue">${LibraryApp.escapeHtml(book.category)}</span><span class="status-pill ${book.status === 'Available' ? 'pill-green' : 'pill-amber'}">${LibraryApp.escapeHtml(book.status)}</span></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${[['ISBN', book.isbn], ['Location', book.location], ['Total Copies', book.totalCopies], ['Available', book.availCopies]].map(([label, value]) => `<div style="background:var(--surface-2);border-radius:var(--radius-md);padding:10px 14px;border:1px solid var(--border-soft)"><div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:3px">${label}</div><div style="font-size:.88rem;font-weight:600;color:var(--navy)">${LibraryApp.escapeHtml(String(value))}</div></div>`).join('')}
    </div>`;
  document.querySelector('#bookModal .modal-footer').innerHTML = '<button class="btn btn-outline" onclick="closeModal(\'bookModal\')">Close</button><button class="btn btn-primary" onclick="editCurrentBook()">\u270F Edit Record</button>';
  openModal('bookModal');
}

function editCurrentBook() {
  if (!currentBookId) {
    showToast('info', 'Select a book record first.', '\uD83D\uDCDA');
    return;
  }
  openBookForm(currentBookId);
}

function filterTx() {
  const query = document.getElementById('txSearch').value.toLowerCase();
  const status = document.getElementById('txFilter').value;
  ADMIN_STATE.filteredTx = ADMIN_STATE.transactions.filter((item) =>
    (!query || `${item.userName} ${item.bookTitle} ${item.id}`.toLowerCase().includes(query)) &&
    (!status || item.status === status)
  );
  renderTxTable();
}

function openIssueModal() {
  populateIssueOptions();
  const dueField = document.getElementById('issueDueDate');
  if (dueField && !dueField.value) {
    const due = new Date();
    due.setDate(due.getDate() + Number(ADMIN_STATE.system.loanPeriodDays || 14));
    dueField.value = due.toISOString().slice(0, 10);
  }
  updateIssuePreview();
  openModal('issueModal');
}

function updateIssuePreview() {
  const preview = document.getElementById('issuePreview');
  if (!preview) return;
  const userId = document.getElementById('issueUser')?.value;
  const bookId = document.getElementById('issueBook')?.value;
  const dueDate = document.getElementById('issueDueDate')?.value;
  const user = ADMIN_STATE.users.find((item) => item.id === userId);
  const book = ADMIN_STATE.books.find((item) => item.id === bookId);
  if (!user || !book) {
    preview.textContent = 'Select a borrower and book to preview this issue.';
    return;
  }
  preview.textContent = `${user.user_name} • ${book.title} • Due ${LibraryApp.formatDate(dueDate || '') || dueDate || 'not set'}`;
}

async function saveIssueTransaction() {
  const userId = document.getElementById('issueUser')?.value;
  const bookId = document.getElementById('issueBook')?.value;
  const dueDate = document.getElementById('issueDueDate')?.value;
  if (!userId || !bookId) {
    showToast('error', 'Please choose both a borrower and a book.', '\u26A0');
    return;
  }
  try {
    await LibraryApp.request('/api/admin/transactions/issue', {
      method: 'POST',
      body: JSON.stringify({ userId, bookId, dueDate }),
    });
    closeModal('issueModal');
    showToast('success', 'Book issued successfully.', '\uD83D\uDCE4');
    await loadOverview();
  } catch (error) {
    showToast('error', error.message || 'Unable to issue this book.', '\u26A0');
  }
}

function renderTxTable() {
  const tbody = document.getElementById('txTableBody');
  if (!ADMIN_STATE.filteredTx.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="es-icon">\uD83D\uDD04</div><p>No transactions available yet.</p></div></td></tr>';
  } else {
    tbody.innerHTML = ADMIN_STATE.filteredTx.map((item) => `
      <tr>
        <td style="font-family:var(--font-mono);font-size:.75rem;color:var(--navy)">${LibraryApp.escapeHtml(item.id || '-')}</td>
        <td><div style="font-weight:600;font-size:.83rem">${LibraryApp.escapeHtml(item.userName || '-')}</div><div style="font-size:.72rem;color:var(--text-muted)">${LibraryApp.escapeHtml(item.userId || '-')}</div></td>
        <td style="font-size:.82rem">${LibraryApp.escapeHtml(item.bookTitle || '-')}</td>
        <td style="font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(item.checkout || '-')}</td>
        <td style="font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(item.due || '-')}</td>
        <td style="font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(item.returned || '-')}</td>
        <td style="font-weight:700;color:${Number(item.fine || 0) > 0 ? 'var(--red)' : 'var(--green)'}">\u20B9${Number(item.fine || 0)}</td>
        <td><span class="status-pill ${item.status === 'Returned' ? 'pill-green' : item.status === 'Overdue' ? 'pill-red' : 'pill-blue'}">${LibraryApp.escapeHtml(item.status || 'Borrowed')}</span></td>
      </tr>`).join('');
  }
  const txInfo = document.querySelector('#sec-transactions .card-footer span');
  if (txInfo) {
    txInfo.textContent = ADMIN_STATE.filteredTx.length ? `Showing ${Math.min(ADMIN_STATE.filteredTx.length, ADMIN_STATE.transactions.length)} of ${ADMIN_STATE.transactions.length} transactions` : 'Showing 0 transactions';
  }
}

function isWithinRange(dateValue, range) {
  if (!dateValue) return range !== 'custom';
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  if (range === '7d') start.setDate(today.getDate() - 6);
  else if (range === '30d') start.setDate(today.getDate() - 29);
  else if (range === '3m') start.setMonth(today.getMonth() - 3);
  else if (range === '6m') start.setMonth(today.getMonth() - 6);
  else if (range === '1y') start.setMonth(0, 1);
  else if (range === 'custom') {
    const from = document.getElementById('customDateFrom')?.value;
    const to = document.getElementById('customDateTo')?.value;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && target < fromDate) return false;
    if (toDate && target > toDate) return false;
    return true;
  } else {
    return true;
  }
  return target >= start && target <= today;
}

function getReportSourceData() {
  const range = ADMIN_STATE.currentReportRange || '7d';
  return {
    users: ADMIN_STATE.users.filter((user) => isWithinRange(user.joined, range)),
    transactions: ADMIN_STATE.transactions.filter((item) => isWithinRange(item.checkout || item.returned, range)),
    books: ADMIN_STATE.books,
  };
}

function getReportConfig(type) {
  const source = getReportSourceData();
  const usersByRole = source.users.reduce((acc, user) => { acc[user.role] = (acc[user.role] || 0) + 1; return acc; }, {});
  const booksByCategory = source.books.reduce((acc, book) => { acc[book.category] = (acc[book.category] || 0) + Number(book.totalCopies || 0); return acc; }, {});
  const bookCounts = source.transactions.reduce((acc, item) => {
    const key = item.bookTitle || 'Unknown Book';
    acc[key] = acc[key] || { count: 0, member: item.userName || '-' };
    acc[key].count += 1;
    return acc;
  }, {});
  const topBooks = Object.entries(bookCounts).sort((left, right) => right[1].count - left[1].count).slice(0, 6);
  const finesTotal = source.transactions.reduce((sum, item) => sum + Number(item.fine || 0), 0);
  const reportMap = {
    'user-growth': { title: '\uD83D\uDC65 User Distribution', labels: Object.keys(usersByRole).length ? Object.keys(usersByRole) : ['Administrator'], values: Object.keys(usersByRole).length ? Object.values(usersByRole) : [1], tableHeads: ['Role', 'Members'], tableRows: Object.entries(usersByRole).length ? Object.entries(usersByRole) : [['Administrator', 1]] },
    'most-borrowed': { title: '\uD83C\uDFC6 Most Borrowed Books', labels: topBooks.length ? topBooks.map(([title]) => title) : ['No Borrowing Yet'], values: topBooks.length ? topBooks.map(([, data]) => data.count) : [0], tableHeads: ['Book', 'Borrows', 'Recent Borrower'], tableRows: topBooks.length ? topBooks.map(([title, data]) => [title, data.count, data.member]) : [['No Borrowing Yet', 0, '-']] },
    'inventory-value': { title: '\uD83D\uDCDA Inventory by Category', labels: Object.keys(booksByCategory), values: Object.values(booksByCategory), tableHeads: ['Category', 'Copies'], tableRows: Object.entries(booksByCategory) },
    fines: { title: '\u2696 Fine Summary', labels: ['Collected'], values: [finesTotal], tableHeads: ['Metric', 'Value'], tableRows: [['Total Fines', `\u20B9${finesTotal}`]] },
  };
  return reportMap[type] || reportMap['user-growth'];
}

function initReports() {
  const config = getReportConfig(ADMIN_STATE.currentReport);
  document.getElementById('reportChartTitle').textContent = config.title;
  document.getElementById('reportTableHead').innerHTML = `<tr>${config.tableHeads.map((item) => `<th>${item}</th>`).join('')}</tr>`;
  document.getElementById('reportTableBody').innerHTML = config.tableRows.length ? config.tableRows.map((row) => `<tr>${row.map((cell) => `<td>${LibraryApp.escapeHtml(String(cell))}</td>`).join('')}</tr>`).join('') : '<tr><td colspan="4">No report data available.</td></tr>';
  if (typeof Chart === 'undefined') return;
  const mainData = { labels: config.labels.length ? config.labels : ['No Data'], datasets: [{ label: config.title, data: config.values.length ? config.values : [0], backgroundColor: COLORS.map((color) => `${color}aa`), borderColor: COLORS, borderWidth: 2, borderRadius: 6 }] };
  if (!reportMainChart) {
    reportMainChart = new Chart(document.getElementById('reportMainChart').getContext('2d'), { type: 'bar', data: mainData, options: { responsive: true, plugins: { legend: { display: false } } } });
  } else {
    reportMainChart.data = mainData;
    reportMainChart.update();
  }
  if (!reportPieChart) {
    reportPieChart = new Chart(document.getElementById('reportPieChart').getContext('2d'), { type: 'pie', data: { labels: mainData.labels, datasets: [{ data: mainData.datasets[0].data, backgroundColor: COLORS }] }, options: { responsive: true } });
  } else {
    reportPieChart.data.labels = mainData.labels;
    reportPieChart.data.datasets[0].data = mainData.datasets[0].data;
    reportPieChart.update();
  }
}
function selectReport(type, button) {
  ADMIN_STATE.currentReport = type;
  document.querySelectorAll('.report-type-btn').forEach((item) => item.classList.remove('active'));
  button?.classList.add('active');
  initReports();
}

function selectDateRange(button, range) {
  document.querySelectorAll('.date-pill').forEach((item) => item.classList.remove('active'));
  button?.classList.add('active');
  ADMIN_STATE.currentReportRange = range || '7d';
  initReports();
}

function applyCustomDateRange() {
  ADMIN_STATE.currentReportRange = 'custom';
  document.querySelectorAll('.date-pill').forEach((item) => item.classList.remove('active'));
  initReports();
}

function exportRowsAsCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportCurrentViewAsPdf(title, html) {
  const printWindow = window.open('', '_blank', 'width=960,height=720');
  if (!printWindow) {
    showToast('error', 'Allow popups to export this view as PDF.', '\u26A0');
    return;
  }
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${LibraryApp.escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}h1{font-size:20px;margin-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:13px}th{background:#f8fafc}</style></head><body><h1>${LibraryApp.escapeHtml(title)}</h1>${html}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function exportReport(format) {
  const inAudit = document.getElementById('sec-audit')?.classList.contains('active');
  if (inAudit) {
    const headers = ['Timestamp', 'Method', 'User', 'Action', 'Status'];
    const rows = ADMIN_STATE.filteredAudit.map((item) => [item.ts, item.method, item.user, item.action, item.status]);
    if (format === 'csv') {
      exportRowsAsCsv('audit-log.csv', headers, rows);
    } else {
      const html = `<table><thead><tr>${headers.map((header) => `<th>${LibraryApp.escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${LibraryApp.escapeHtml(String(cell))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      exportCurrentViewAsPdf('Audit Log', html);
    }
    showToast('success', `Exported ${rows.length} audit log row(s).`, '\uD83D\uDCE4');
    return;
  }

  const config = getReportConfig(ADMIN_STATE.currentReport);
  if (format === 'csv') {
    exportRowsAsCsv(`${ADMIN_STATE.currentReport}.csv`, config.tableHeads, config.tableRows);
  } else {
    const html = `<table><thead><tr>${config.tableHeads.map((header) => `<th>${LibraryApp.escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${config.tableRows.map((row) => `<tr>${row.map((cell) => `<td>${LibraryApp.escapeHtml(String(cell))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    exportCurrentViewAsPdf(config.title, html);
  }
  showToast('success', `${config.title} exported successfully.`, '\uD83D\uDCE4');
}

function filterAudit() {
  const query = document.getElementById('auditSearch').value.toLowerCase();
  const method = document.getElementById('auditMethod').value;
  ADMIN_STATE.filteredAudit = ADMIN_STATE.auditLog.filter((item) => (!query || `${item.user} ${item.action}`.toLowerCase().includes(query)) && (!method || item.method === method));
  renderAuditLog(1);
}

function renderAuditLog(page) {
  auditPage = page;
  const start = (page - 1) * AUDIT_PER_PAGE;
  const rows = ADMIN_STATE.filteredAudit.slice(start, start + AUDIT_PER_PAGE);
  const container = document.getElementById('auditTableBody');
  container.innerHTML = rows.length ? rows.map((item) => `
    <div class="audit-row">
      <span class="audit-ts">${LibraryApp.escapeHtml(item.ts)}</span>
      <span class="audit-method method-${String(item.method || '').toLowerCase()}">${LibraryApp.escapeHtml(item.method)}</span>
      <span style="font-size:.78rem;font-weight:600;color:var(--navy)">${LibraryApp.escapeHtml(item.user)}</span>
      <span style="font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(item.action)}</span>
      <span class="status-pill ${item.status >= 400 ? 'pill-red' : 'pill-green'}" style="font-size:.65rem;font-family:var(--font-mono)">${item.status}</span>
    </div>`).join('') : '<div class="empty-state"><div class="es-icon">\uD83E\uDDFE</div><p>No audit entries match your filters.</p></div>';
  document.getElementById('auditCount').textContent = `${ADMIN_STATE.filteredAudit.length} log entries`;
  renderPagination('auditPagination', page, Math.ceil(ADMIN_STATE.filteredAudit.length / AUDIT_PER_PAGE), renderAuditLog);
}

async function performBackup() {
  try {
    const payload = await LibraryApp.request('/api/system/backup', { method: 'POST' });
    document.getElementById('lastBackupTime').textContent = payload.lastBackupTime;
    ADMIN_STATE.system.restorePoints = payload.restorePoints || ADMIN_STATE.system.restorePoints || [];
    populateRestorePoints();
    showToast('success', 'Backup completed successfully.', '\uD83D\uDCBE');
    await loadOverview();
  } catch (error) {
    showToast('error', error.message || 'Backup failed.', '\u26A0');
  }
}

function quickBackup() { performBackup(); }

function checkRestoreConfirm() {
  const value = document.getElementById('restoreConfirm').value;
  const button = document.getElementById('restoreBtn');
  if (!button) return;
  const enabled = value === 'CONFIRM' && Boolean(document.getElementById('restorePoint')?.value);
  button.disabled = !enabled;
  button.style.opacity = enabled ? '1' : '.4';
}

async function confirmRestore() {
  const backupId = document.getElementById('restorePoint')?.value;
  if (!backupId) {
    showToast('error', 'Select a restore point first.', '\u26A0');
    return;
  }
  try {
    const payload = await LibraryApp.request('/api/system/restore', {
      method: 'POST',
      body: JSON.stringify({ backupId }),
    });
    document.getElementById('restoreConfirm').value = '';
    checkRestoreConfirm();
    showToast('success', `Database restored from ${payload.restoredFrom.label || 'selected backup'}.`, '\uD83D\uDEE1');
    await loadOverview();
  } catch (error) {
    showToast('error', error.message || 'Restore failed.', '\u26A0');
  }
}

async function saveSystemConfig(options = {}) {
  const quiet = Boolean(options.quiet);
  const body = {
    loanPeriodDays: Number(document.getElementById('sysLoanPeriod')?.value || 14),
    maxBooksPerStudent: Number(document.getElementById('sysMaxBooks')?.value || 3),
    fineRate: Number(document.getElementById('sysFineRate')?.value || 2),
    renewalLimit: Number(document.getElementById('sysRenewalLimit')?.value || 2),
    backupSchedule: {
      daily: Boolean(document.getElementById('dailyBackupToggle')?.checked),
      weekly: Boolean(document.getElementById('weeklyBackupToggle')?.checked),
      monthly: Boolean(document.getElementById('monthlyBackupToggle')?.checked),
    },
  };
  try {
    const payload = await LibraryApp.request('/api/system/config', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    ADMIN_STATE.system = payload.system || ADMIN_STATE.system;
    syncSystemForm();
    if (!quiet) showToast('success', 'System configuration saved successfully.', '\u2699');
  } catch (error) {
    showToast('error', error.message || 'Unable to save configuration.', '\u26A0');
  }
}

function scheduleChanged(name, toggle) {
  saveSystemConfig({ quiet: true });
  showToast(toggle.checked ? 'success' : 'info', `${name} schedule ${toggle.checked ? 'enabled' : 'disabled'}.`, '\u23F0');
}

function refreshDashboard() {
  const params = new URLSearchParams({
    userSortKey: userSortState.key,
    userSortDir: userSortState.dir,
    refresh: '1',
  });
  LibraryApp.request(`/api/admin/overview?${params.toString()}`)
    .then((payload) => {
      applyOverview(payload);
      const stamp = payload.meta?.refreshedAt ? new Date(payload.meta.refreshedAt).toLocaleTimeString('en-IN') : 'just now';
      showToast('success', `Dashboard refreshed from backend at ${stamp}.`, '\u21BB');
    })
    .catch((error) => showToast('error', error.message || 'Unable to refresh dashboard.', '\u26A0'));
}

function loadMoreActivity() {
  activityFeedLimit = Math.min(activityFeedLimit + 6, ADMIN_STATE.auditLog.length || activityFeedLimit + 6);
  renderActivityFeed();
  showToast('info', `Showing ${Math.min(activityFeedLimit, ADMIN_STATE.auditLog.length)} activity entries.`, '\uD83D\uDCDC');
}

function openPendingApprovals() {
  navigate('dashboard', document.querySelector('[data-section=dashboard]'));
  const pending = document.getElementById('pendingApprovals');
  pending?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast('info', `${document.querySelectorAll('#pendingApprovals .approval-item').length} live approval summaries loaded.`, '\uD83D\uDD14');
}

function handleGlobalSearch(value) {
  const query = String(value || '').trim().toLowerCase();
  if (!query) return;
  const matches = [
    ...ADMIN_STATE.users.filter((user) => `${user.user_name} ${user.userId}`.toLowerCase().includes(query)).map((user) => `\uD83D\uDC64 ${user.user_name}`),
    ...ADMIN_STATE.books.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(query)).map((book) => `\uD83D\uDCDA ${book.title}`),
  ].slice(0, 4);
  if (matches.length) showToast('info', matches.join(' \u2022 '), '\uD83D\uDD0E');
}

function jumpToNotificationSection(section) {
  closeModal('notificationsModal');
  goToSection(section || 'dashboard');
  if (section === 'dashboard') {
    document.getElementById('pendingApprovals')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function renderNotifications() {
  const container = document.getElementById('notificationsList');
  if (!container) return;
  const notifications = ADMIN_STATE.notifications || [];
  container.innerHTML = notifications.length ? notifications.map((item) => `
    <div class="admin-note tone-${LibraryApp.escapeHtml(item.tone || 'info')}">
      <div class="admin-note-icon">${LibraryApp.escapeHtml(item.icon || '\uD83D\uDD14')}</div>
      <div class="admin-note-copy">
        <div class="admin-note-title">${LibraryApp.escapeHtml(item.title)}</div>
        <div class="admin-note-msg">${LibraryApp.escapeHtml(item.message || '')}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="jumpToNotificationSection('${LibraryApp.escapeHtml(item.section || 'dashboard')}')">Open</button>
    </div>`).join('') : '<div class="empty-state"><div class="es-icon">\u2705</div><p>No new notifications right now.</p></div>';
}

function openNotifications() {
  renderNotifications();
  openModal('notificationsModal');
}

function renderPendingApprovals() {
  const pending = ADMIN_STATE.pendingApprovals || [];
  const countNode = document.getElementById('pendingCount');
  if (countNode) countNode.textContent = `${pending.length} live item${pending.length === 1 ? '' : 's'} need attention`;
  const container = document.getElementById('pendingApprovals');
  if (!container) return;
  container.innerHTML = pending.length ? pending.map((item) => `
    <div class="approval-item" onclick="jumpToNotificationSection('${LibraryApp.escapeHtml(item.section || 'dashboard')}')">
      <div class="approval-icon" style="background:rgba(59,130,246,.1)">${item.icon}</div>
      <div class="approval-info">
        <div class="approval-title">${LibraryApp.escapeHtml(item.title)}</div>
        <div class="approval-sub">${LibraryApp.escapeHtml(item.subtitle)}</div>
      </div>
    </div>`).join('') : '<div class="empty-state"><div class="es-icon">\u2705</div><p>No pending admin actions right now.</p></div>';
}

function applyOverview(payload) {
  ADMIN_STATE.currentUser = payload.currentUser;
  ADMIN_STATE.users = payload.users || [];
  ADMIN_STATE.books = payload.books || [];
  ADMIN_STATE.transactions = payload.transactions || [];
  ADMIN_STATE.auditLog = payload.auditLog || [];
  ADMIN_STATE.insights = payload.insights || [];
  ADMIN_STATE.notifications = payload.notifications || [];
  ADMIN_STATE.pendingApprovals = payload.pendingApprovals || [];
  ADMIN_STATE.meta = payload.meta || ADMIN_STATE.meta;
  ADMIN_STATE.stats = payload.stats || ADMIN_STATE.stats;
  ADMIN_STATE.system = payload.system || ADMIN_STATE.system;
  ADMIN_STATE.filteredUsers = [...ADMIN_STATE.users];
  ADMIN_STATE.filteredBooks = [...ADMIN_STATE.books];
  ADMIN_STATE.filteredTx = [...ADMIN_STATE.transactions];
  ADMIN_STATE.filteredAudit = [...ADMIN_STATE.auditLog];
  if (payload.meta?.userSort) userSortState = payload.meta.userSort;

  const lastBackupNode = document.getElementById('lastBackupTime');
  const lastRestoreNode = document.getElementById('lastRestoreTime');
  if (lastBackupNode) lastBackupNode.textContent = ADMIN_STATE.system.lastBackupTime || '-';
  if (lastRestoreNode) lastRestoreNode.textContent = ADMIN_STATE.system.lastRestoreTime || 'Never restored';

  const userName = document.querySelector('.sb-user-name');
  const userRole = document.querySelector('.sb-user-role');
  const avatar = document.querySelector('.sb-avatar');
  if (userName) userName.textContent = ADMIN_STATE.currentUser.user_name;
  if (userRole) userRole.textContent = ADMIN_STATE.currentUser.role;
  if (avatar) avatar.textContent = LibraryApp.initials(ADMIN_STATE.currentUser.user_name) || 'AD';

  updateStats();
  updateClock();
  renderInsights();
  renderActivityFeed();
  renderNotifications();
  renderPendingApprovals();
  renderSystemStatus();
  initTrendChart();
  initCatChart();
  syncSystemForm();
  populateRestorePoints();
  populateIssueOptions();
  renderUserTable(1);
  renderBookTable(1);
  renderTxTable();
  renderAuditLog(1);
  initReports();
}

function syncSystemForm() {
  const system = ADMIN_STATE.system || {};
  const schedule = system.backupSchedule || {};
  const setValue = (id, value) => {
    const field = document.getElementById(id);
    if (field) field.value = value;
  };
  const setChecked = (id, value) => {
    const field = document.getElementById(id);
    if (field) field.checked = Boolean(value);
  };
  setValue('sysLoanPeriod', Number(system.loanPeriodDays || 14));
  setValue('sysMaxBooks', Number(system.maxBooksPerStudent || 3));
  setValue('sysFineRate', Number(system.fineRate || 2));
  setValue('sysRenewalLimit', Number(system.renewalLimit || 2));
  setValue('sysAuditRetention', Number(system.auditRetentionDays || 90));
  setValue('sysBackupLimit', Number(system.backupHistoryLimit || 12));
  setChecked('dailyBackupToggle', schedule.daily);
  setChecked('weeklyBackupToggle', schedule.weekly);
  setChecked('monthlyBackupToggle', schedule.monthly);
}

function populateRestorePoints() {
  const select = document.getElementById('restorePoint');
  const meta = document.getElementById('backupMeta');
  const history = document.getElementById('restoreHistoryList');
  const restorePoints = ADMIN_STATE.system.restorePoints || [];
  if (select) {
    select.innerHTML = restorePoints.length
      ? restorePoints.map((item) => `<option value="${LibraryApp.escapeHtml(item.id)}">${LibraryApp.formatDate(item.createdAt)} â€¢ ${LibraryApp.escapeHtml(item.label || 'Backup')} â€¢ ${formatBytes(item.sizeBytes)}</option>`).join('')
      : '<option value="">No restore points available</option>';
  }
  if (meta) {
    meta.textContent = restorePoints.length
      ? `${formatBytes(restorePoints[0].sizeBytes)} â€¢ ${restorePoints.length} restore point${restorePoints.length === 1 ? '' : 's'}`
      : 'No restore points yet';
  }
  if (history) {
    history.innerHTML = restorePoints.length ? restorePoints.map((item) => `
      <div class="restore-entry">
        <div>
          <div class="restore-entry-title">${LibraryApp.escapeHtml(item.label || 'Backup')}</div>
          <div class="restore-entry-meta">${LibraryApp.formatDate(item.createdAt)} â€¢ ${formatBytes(item.sizeBytes)}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('restorePoint').value='${LibraryApp.escapeHtml(item.id)}';checkRestoreConfirm();goToSection('system')">Select</button>
      </div>`).join('') : '<div class="empty-state"><div class="es-icon">\uD83D\uDCBE</div><p>No restore history is available yet.</p></div>';
  }
  checkRestoreConfirm();
}

function populateIssueOptions() {
  const userSelect = document.getElementById('issueUser');
  const bookSelect = document.getElementById('issueBook');
  if (userSelect) {
    const borrowers = ADMIN_STATE.users.filter((user) => user.role !== 'Administrator' && user.status === 'Active');
    userSelect.innerHTML = borrowers.length
      ? borrowers.map((user) => `<option value="${LibraryApp.escapeHtml(user.id)}">${LibraryApp.escapeHtml(user.user_name)} â€¢ ${LibraryApp.escapeHtml(user.userId)} â€¢ ${LibraryApp.escapeHtml(user.role)}</option>`).join('')
      : '<option value="">No active borrowers</option>';
  }
  if (bookSelect) {
    const availableBooks = ADMIN_STATE.books.filter((book) => !book.archived && Number(book.availCopies || 0) > 0);
    bookSelect.innerHTML = availableBooks.length
      ? availableBooks.map((book) => `<option value="${LibraryApp.escapeHtml(book.id)}">${LibraryApp.escapeHtml(book.title)} â€¢ ${book.availCopies}/${book.totalCopies} available</option>`).join('')
      : '<option value="">No available books</option>';
  }
  updateIssuePreview();
}

function renderUserTable(page) {
  userPage = page;
  const start = (page - 1) * USERS_PER_PAGE;
  const users = ADMIN_STATE.filteredUsers.slice(start, start + USERS_PER_PAGE);
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="es-icon">\uD83D\uDC65</div><p>No users match your filters.</p></div></td></tr>';
  } else {
    tbody.innerHTML = users.map((user) => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="u-avatar" style="background:${ROLE_COLORS[user.role] || '#64748b'}">${LibraryApp.initials(user.user_name)}</div>
            <div>
              <div class="u-name">${LibraryApp.escapeHtml(user.user_name)}</div>
              <div class="u-email">${LibraryApp.escapeHtml(user.email)}</div>
            </div>
          </div>
        </td>
        <td><span style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(user.userId)}</span></td>
        <td><span class="status-pill ${user.role === 'Administrator' ? 'pill-red' : user.role === 'Librarian' ? 'pill-amber' : user.role === 'Faculty' ? 'pill-teal' : 'pill-blue'}">${LibraryApp.escapeHtml(user.role)}</span></td>
        <td style="font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(user.dept)}</td>
        <td><span class="status-pill ${user.status === 'Active' ? 'pill-green' : user.status === 'Suspended' ? 'pill-red' : 'pill-navy'}">${LibraryApp.escapeHtml(user.status)}</span></td>
        <td style="font-size:.78rem;color:var(--text-muted)">${LibraryApp.formatDate(user.joined)}</td>
        <td style="text-align:right">
          <div class="kebab-wrap">
            <button class="kebab-btn" onclick="toggleKebab(event,'kb-${user.id}')">\u22EE</button>
            <div class="kebab-menu" id="kb-${user.id}">
              <div class="kebab-item" onclick="editUser('${user.id}')">\u270F Edit Details</div>
              <div class="kebab-item" onclick="openResetPasswordModal('${user.id}')">\uD83D\uDD10 Reset Password</div>
              <div class="kebab-item" onclick="toggleStatus('${user.id}')">${user.status === 'Active' ? '\u23F8 Deactivate' : '\u2705 Activate'}</div>
              <div class="kebab-divider"></div>
              <div class="kebab-item danger" onclick="deleteUser('${user.id}')">\uD83D\uDDD1 Delete Account</div>
            </div>
          </div>
        </td>
      </tr>`).join('');
  }
  document.getElementById('userCount').textContent = `${ADMIN_STATE.filteredUsers.length} users`;
  document.getElementById('userPaginInfo').textContent = ADMIN_STATE.filteredUsers.length ? `Showing ${start + 1}-${Math.min(start + USERS_PER_PAGE, ADMIN_STATE.filteredUsers.length)} of ${ADMIN_STATE.filteredUsers.length} users` : 'Showing 0 users';
  renderPagination('userPagination', page, Math.ceil(ADMIN_STATE.filteredUsers.length / USERS_PER_PAGE), renderUserTable);
}

function openResetPasswordModal(id) {
  closeAllKebabs();
  const user = ADMIN_STATE.users.find((item) => item.id === id);
  if (!user) return;
  resetPasswordUserId = id;
  document.getElementById('passwordModalTitle').textContent = `Reset Password for ${user.user_name}`;
  document.getElementById('resetPasswordValue').value = '';
  document.getElementById('resetPasswordConfirm').value = '';
  openModal('passwordModal');
}

async function submitPasswordReset() {
  if (!resetPasswordUserId) return;
  const password = document.getElementById('resetPasswordValue').value;
  const confirmPassword = document.getElementById('resetPasswordConfirm').value;
  if (!password || password.length < 4) {
    showToast('error', 'Please enter a password with at least 4 characters.', '\u26A0');
    return;
  }
  if (password !== confirmPassword) {
    showToast('error', 'Passwords do not match.', '\u26A0');
    return;
  }
  try {
    await LibraryApp.request(`/api/users/${resetPasswordUserId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    closeModal('passwordModal');
    resetPasswordUserId = null;
    showToast('success', 'Password reset successfully.', '\uD83D\uDD10');
  } catch (error) {
    showToast('error', error.message || 'Unable to reset password.', '\u26A0');
  }
}

function viewBook(id) {
  const book = ADMIN_STATE.books.find((item) => item.id === id);
  if (!book) return;
  currentBookId = id;
  const coverColor = COLORS[Math.abs(book.title.length) % COLORS.length];
  const statusClass = book.status === 'Available' ? 'pill-green' : book.status === 'Archived' ? 'pill-navy' : 'pill-amber';
  document.getElementById('bookModalTitle').textContent = book.title;
  document.getElementById('bookModalBody').innerHTML = `
    <div style="display:flex;gap:20px;margin-bottom:16px">
      <div style="width:80px;height:110px;border-radius:8px;background:${coverColor}22;display:flex;align-items:center;justify-content:center;font-size:2.5rem;flex-shrink:0">\uD83D\uDCD6</div>
      <div>
        <div style="font-family:var(--font-display);font-size:1.2rem;font-weight:700;color:var(--navy);margin-bottom:4px">${LibraryApp.escapeHtml(book.title)}</div>
        <div style="font-size:.85rem;color:var(--text-sec);margin-bottom:6px">By <strong>${LibraryApp.escapeHtml(book.author)}</strong> \u2022 ${LibraryApp.escapeHtml(String(book.year))}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="status-pill pill-blue">${LibraryApp.escapeHtml(book.category)}</span><span class="status-pill ${statusClass}">${LibraryApp.escapeHtml(book.status)}</span></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${[['ISBN', book.isbn], ['Location', book.location], ['Total Copies', book.totalCopies], ['Available', book.availCopies]].map(([label, value]) => `<div style="background:var(--surface-2);border-radius:var(--radius-md);padding:10px 14px;border:1px solid var(--border-soft)"><div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:3px">${label}</div><div style="font-size:.88rem;font-weight:600;color:var(--navy)">${LibraryApp.escapeHtml(String(value))}</div></div>`).join('')}
    </div>
    ${book.archived ? '<div style="margin-top:14px;padding:10px 12px;border-radius:12px;background:rgba(15,23,42,.06);font-size:.8rem;color:var(--text-sec)">This title is archived and hidden from member portals.</div>' : ''}`;
  document.querySelector('#bookModal .modal-footer').innerHTML = `
    <button class="btn btn-outline" onclick="closeModal('bookModal')">Close</button>
    <button class="btn btn-outline" onclick="toggleBookArchive('${book.id}', ${book.archived ? 'false' : 'true'})">${book.archived ? '\u267B Restore' : '\uD83D\uDCE6 Archive'}</button>
    <button class="btn btn-primary" onclick="editCurrentBook()">\u270F Edit Record</button>
    <button class="btn btn-danger" onclick="deleteBookRecord('${book.id}')">\uD83D\uDDD1 Delete</button>`;
  openModal('bookModal');
}

function toggleBookArchive(id, archived) {
  const book = ADMIN_STATE.books.find((item) => item.id === id);
  if (!book) return;
  confirmAction(archived ? 'Archive Book' : 'Restore Book', `${archived ? 'Archive' : 'Restore'} <strong>${LibraryApp.escapeHtml(book.title)}</strong>?`, archived ? '\uD83D\uDCE6' : '\u267B', async () => {
    try {
      await LibraryApp.request(`/api/books/${id}/archive`, {
        method: 'POST',
        body: JSON.stringify({ archived }),
      });
      closeModal('bookModal');
      showToast('success', archived ? 'Book archived successfully.' : 'Book restored successfully.', archived ? '\uD83D\uDCE6' : '\u267B');
      await loadOverview();
    } catch (error) {
      showToast('error', error.message || 'Unable to update this book.', '\u26A0');
    }
  });
}

function deleteBookRecord(id) {
  const book = ADMIN_STATE.books.find((item) => item.id === id);
  if (!book) return;
  confirmAction('Delete Book', `Delete <strong>${LibraryApp.escapeHtml(book.title)}</strong>? Books with transaction history will need to be archived instead.`, '\uD83D\uDDD1', async () => {
    try {
      await LibraryApp.request(`/api/books/${id}`, { method: 'DELETE' });
      closeModal('bookModal');
      showToast('success', 'Book deleted successfully.', '\uD83D\uDDD1');
      await loadOverview();
    } catch (error) {
      showToast('error', error.message || 'Unable to delete this book.', '\u26A0');
    }
  });
}

async function transactionAction(action, transactionId) {
  const transaction = ADMIN_STATE.transactions.find((item) => item.id === transactionId);
  if (!transaction) return;
  const config = {
    return: {
      endpoint: '/api/admin/transactions/return',
      body: { transactionId },
      success: 'Transaction returned successfully.',
      confirm: `Return <strong>${LibraryApp.escapeHtml(transaction.bookTitle || transaction.id)}</strong> for ${LibraryApp.escapeHtml(transaction.userName || transaction.userId)}?`,
      icon: '\uD83D\uDCE5',
    },
    renew: {
      endpoint: '/api/admin/transactions/renew',
      body: { transactionId },
      success: 'Transaction renewed successfully.',
      confirm: `Renew <strong>${LibraryApp.escapeHtml(transaction.bookTitle || transaction.id)}</strong> for ${LibraryApp.escapeHtml(transaction.userName || transaction.userId)}?`,
      icon: '\uD83D\uDD04',
    },
    lost: {
      endpoint: '/api/admin/transactions/mark-lost',
      body: { transactionId },
      success: 'Transaction marked as lost.',
      confirm: `Mark <strong>${LibraryApp.escapeHtml(transaction.bookTitle || transaction.id)}</strong> as lost? This reduces catalog copies.`,
      icon: '\u26A0',
    },
    waive: {
      endpoint: '/api/admin/transactions/waive-fine',
      body: { transactionId },
      success: 'Fine waived successfully.',
      confirm: `Waive the fine for <strong>${LibraryApp.escapeHtml(transaction.bookTitle || transaction.id)}</strong>?`,
      icon: '\u2696',
    },
  }[action];
  if (!config) return;
  confirmAction(action === 'waive' ? 'Waive Fine' : action === 'lost' ? 'Mark Lost' : action === 'renew' ? 'Renew Loan' : 'Return Book', config.confirm, config.icon, async () => {
    try {
      await LibraryApp.request(config.endpoint, {
        method: 'POST',
        body: JSON.stringify(config.body),
      });
      showToast('success', config.success, config.icon);
      await loadOverview();
    } catch (error) {
      showToast('error', error.message || 'Unable to update this transaction.', '\u26A0');
    }
  });
}

function renderTxTable() {
  const tbody = document.getElementById('txTableBody');
  if (!tbody) return;
  if (!ADMIN_STATE.filteredTx.length) {
    tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="es-icon">\uD83D\uDD04</div><p>No transactions available yet.</p></div></td></tr>';
  } else {
    tbody.innerHTML = ADMIN_STATE.filteredTx.map((item) => {
      const statusClass = item.status === 'Returned' ? 'pill-green' : item.status === 'Overdue' || item.status === 'Lost' ? 'pill-red' : 'pill-blue';
      const canAct = item.status === 'Borrowed' || item.status === 'Overdue';
      return `
      <tr>
        <td style="font-family:var(--font-mono);font-size:.75rem;color:var(--navy)">${LibraryApp.escapeHtml(item.id || '-')}</td>
        <td><div style="font-weight:600;font-size:.83rem">${LibraryApp.escapeHtml(item.userName || '-')}</div><div style="font-size:.72rem;color:var(--text-muted)">${LibraryApp.escapeHtml(item.userId || '-')}</div></td>
        <td style="font-size:.82rem">${LibraryApp.escapeHtml(item.bookTitle || '-')}</td>
        <td style="font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(item.checkout || '-')}</td>
        <td style="font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(item.due || '-')}</td>
        <td style="font-size:.78rem;color:var(--text-sec)">${LibraryApp.escapeHtml(item.returned || '-')}</td>
        <td style="font-weight:700;color:${Number(item.fine || 0) > 0 ? 'var(--red)' : 'var(--green)'}">\u20B9${Number(item.fine || 0)}</td>
        <td><span class="status-pill ${statusClass}">${LibraryApp.escapeHtml(item.status || 'Borrowed')}</span></td>
        <td style="text-align:right">
          <div class="action-chip-wrap">
            ${canAct ? `<button class="action-chip" onclick="transactionAction('return','${item.id}')">\uD83D\uDCE5 Return</button>` : ''}
            ${item.status === 'Borrowed' ? `<button class="action-chip" onclick="transactionAction('renew','${item.id}')">\uD83D\uDD04 Renew</button>` : ''}
            ${canAct ? `<button class="action-chip danger" onclick="transactionAction('lost','${item.id}')">\u26A0 Lost</button>` : ''}
            ${Number(item.fine || 0) > 0 ? `<button class="action-chip" onclick="transactionAction('waive','${item.id}')">\u2696 Waive</button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  }
  const txInfo = document.getElementById('txCount');
  if (txInfo) {
    txInfo.textContent = ADMIN_STATE.filteredTx.length ? `Showing ${Math.min(ADMIN_STATE.filteredTx.length, ADMIN_STATE.transactions.length)} of ${ADMIN_STATE.transactions.length} transactions` : 'Showing 0 transactions';
  }
}

async function loadReportData() {
  const params = new URLSearchParams({
    type: ADMIN_STATE.currentReport,
    range: ADMIN_STATE.currentReportRange || '7d',
  });
  if (ADMIN_STATE.currentReportRange === 'custom') {
    const from = document.getElementById('customDateFrom')?.value;
    const to = document.getElementById('customDateTo')?.value;
    if (from) params.set('from', from);
    if (to) params.set('to', to);
  }
  const payload = await LibraryApp.request(`/api/admin/reports?${params.toString()}`);
  ADMIN_STATE.reportData = payload;
  const meta = document.getElementById('reportMeta');
  if (meta) meta.textContent = `Backend report generated at ${new Date(payload.generatedAt).toLocaleString('en-IN')}.`;
  document.getElementById('reportChartTitle').textContent = payload.title;
  document.getElementById('reportTableHead').innerHTML = `<tr>${payload.headers.map((item) => `<th>${LibraryApp.escapeHtml(item)}</th>`).join('')}</tr>`;
  document.getElementById('reportTableBody').innerHTML = payload.rows.length ? payload.rows.map((row) => `<tr>${row.map((cell) => `<td>${LibraryApp.escapeHtml(String(cell))}</td>`).join('')}</tr>`).join('') : '<tr><td colspan="4">No report data available.</td></tr>';
  if (typeof Chart === 'undefined') return;
  const mainData = {
    labels: payload.labels.length ? payload.labels : ['No Data'],
    datasets: [{ label: payload.title, data: payload.values.length ? payload.values : [0], backgroundColor: COLORS.map((color) => `${color}aa`), borderColor: COLORS, borderWidth: 2, borderRadius: 6 }],
  };
  if (!reportMainChart) {
    reportMainChart = new Chart(document.getElementById('reportMainChart').getContext('2d'), { type: 'bar', data: mainData, options: { responsive: true, plugins: { legend: { display: false } } } });
  } else {
    reportMainChart.data = mainData;
    reportMainChart.update();
  }
  const pieData = {
    labels: payload.pieLabels.length ? payload.pieLabels : ['No Data'],
    datasets: [{ data: payload.pieValues.length ? payload.pieValues : [0], backgroundColor: COLORS }],
  };
  if (!reportPieChart) {
    reportPieChart = new Chart(document.getElementById('reportPieChart').getContext('2d'), { type: 'pie', data: pieData, options: { responsive: true } });
  } else {
    reportPieChart.data = pieData;
    reportPieChart.update();
  }
}

function initReports() {
  loadReportData().catch((error) => {
    const meta = document.getElementById('reportMeta');
    if (meta) meta.textContent = error.message || 'Unable to load report data.';
  });
}

function selectReport(type, button) {
  ADMIN_STATE.currentReport = type;
  document.querySelectorAll('.report-type-btn').forEach((item) => item.classList.remove('active'));
  button?.classList.add('active');
  initReports();
}

function selectDateRange(button, range) {
  document.querySelectorAll('.date-pill').forEach((item) => item.classList.remove('active'));
  button?.classList.add('active');
  ADMIN_STATE.currentReportRange = range || '7d';
  initReports();
}

function applyCustomDateRange() {
  ADMIN_STATE.currentReportRange = 'custom';
  document.querySelectorAll('.date-pill').forEach((item) => item.classList.remove('active'));
  initReports();
}

function exportReport(format) {
  const inAudit = document.getElementById('sec-audit')?.classList.contains('active');
  if (inAudit) {
    const headers = ['Timestamp', 'Method', 'User', 'Action', 'Status'];
    const rows = ADMIN_STATE.filteredAudit.map((item) => [item.ts, item.method, item.user, item.action, item.status]);
    if (format === 'csv') {
      exportRowsAsCsv('audit-log.csv', headers, rows);
    } else {
      const html = `<table><thead><tr>${headers.map((header) => `<th>${LibraryApp.escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${LibraryApp.escapeHtml(String(cell))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      exportCurrentViewAsPdf('Audit Log', html);
    }
    showToast('success', `Exported ${rows.length} audit log row(s).`, '\uD83D\uDCE4');
    return;
  }
  const report = ADMIN_STATE.reportData;
  if (!report) {
    showToast('error', 'Report data is still loading.', '\u26A0');
    return;
  }
  if (format === 'csv') {
    exportRowsAsCsv(`${ADMIN_STATE.currentReport}.csv`, report.headers, report.rows);
  } else {
    const html = `<table><thead><tr>${report.headers.map((header) => `<th>${LibraryApp.escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${report.rows.map((row) => `<tr>${row.map((cell) => `<td>${LibraryApp.escapeHtml(String(cell))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    exportCurrentViewAsPdf(report.title, html);
  }
  showToast('success', `${report.title} exported successfully.`, '\uD83D\uDCE4');
}

async function saveSystemConfig(options = {}) {
  const quiet = Boolean(options.quiet);
  const body = {
    loanPeriodDays: Number(document.getElementById('sysLoanPeriod')?.value || 14),
    maxBooksPerStudent: Number(document.getElementById('sysMaxBooks')?.value || 3),
    fineRate: Number(document.getElementById('sysFineRate')?.value || 2),
    renewalLimit: Number(document.getElementById('sysRenewalLimit')?.value || 2),
    auditRetentionDays: Number(document.getElementById('sysAuditRetention')?.value || 90),
    backupHistoryLimit: Number(document.getElementById('sysBackupLimit')?.value || 12),
    backupSchedule: {
      daily: Boolean(document.getElementById('dailyBackupToggle')?.checked),
      weekly: Boolean(document.getElementById('weeklyBackupToggle')?.checked),
      monthly: Boolean(document.getElementById('monthlyBackupToggle')?.checked),
    },
  };
  try {
    const payload = await LibraryApp.request('/api/system/config', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    ADMIN_STATE.system = payload.system || ADMIN_STATE.system;
    syncSystemForm();
    populateRestorePoints();
    if (!quiet) showToast('success', 'System configuration saved successfully.', '\u2699');
  } catch (error) {
    showToast('error', error.message || 'Unable to save configuration.', '\u26A0');
  }
}

function openPendingApprovals() {
  openNotifications();
}

function clearSearchResults() {
  const panel = document.getElementById('searchResultsPanel');
  if (!panel) return;
  panel.classList.remove('open');
  panel.innerHTML = '';
}

function renderSearchResults(payload) {
  const panel = document.getElementById('searchResultsPanel');
  if (!panel) return;
  const renderGroup = (label, items) => items.length ? `
    <div class="search-group">
      <div class="search-group-label">${label}</div>
      ${items.map((item) => `<button class="search-result" onclick="openSearchResult('${item.section}','${item.kind}','${item.id}')"><span class="search-result-title">${LibraryApp.escapeHtml(item.title)}</span><span class="search-result-sub">${LibraryApp.escapeHtml(item.subtitle)}</span></button>`).join('')}
    </div>` : '';
  panel.innerHTML = payload.total
    ? `${renderGroup('Users', payload.users || [])}${renderGroup('Books', payload.books || [])}${renderGroup('Transactions', payload.transactions || [])}`
    : `<div class="empty-state compact"><div class="es-icon">\uD83D\uDD0E</div><p>No admin results for "${LibraryApp.escapeHtml(payload.query || '')}".</p></div>`;
  panel.classList.add('open');
}

async function handleGlobalSearch(value) {
  const query = String(value || '').trim();
  clearTimeout(searchDebounce);
  if (query.length < 2) {
    clearSearchResults();
    return;
  }
  searchDebounce = window.setTimeout(async () => {
    try {
      const payload = await LibraryApp.request(`/api/admin/search?q=${encodeURIComponent(query)}`);
      ADMIN_STATE.searchResults = payload;
      renderSearchResults(payload);
    } catch (error) {
      clearSearchResults();
    }
  }, 180);
}

function openSearchResult(section, kind, id) {
  const searchField = document.getElementById('globalSearch');
  if (searchField) searchField.value = '';
  clearSearchResults();
  goToSection(section);
  if (section === 'users') {
    const user = ADMIN_STATE.users.find((item) => item.id === id);
    const field = document.getElementById('userSearch');
    if (field && user) {
      field.value = user.user_name;
      filterUsers();
    }
  } else if (section === 'inventory') {
    const book = ADMIN_STATE.books.find((item) => item.id === id);
    const field = document.getElementById('bookSearch');
    if (field && book) {
      field.value = book.title;
      filterBooks();
    }
    if (id) viewBook(id);
  } else if (section === 'transactions') {
    const field = document.getElementById('txSearch');
    if (field) {
      field.value = id;
      filterTx();
    }
  }
}

function closeAllKebabs() { document.querySelectorAll('.kebab-menu.open').forEach((menu) => menu.classList.remove('open')); }
function toggleKebab(event, id) {
  event.stopPropagation();
  const menu = document.getElementById(id);
  const wasOpen = menu?.classList.contains('open');
  closeAllKebabs();
  if (menu && !wasOpen) menu.classList.add('open');
}

window.addEventListener('DOMContentLoaded', async () => {
  const session = await LibraryApp.requireSession('Administrator');
  if (!session) return;
  setInventoryAddAction();
  updateClock();
  setInterval(updateClock, 1000);
  document.querySelectorAll('.overlay').forEach((overlay) => overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(overlay.id); }));
  document.addEventListener('click', closeAllKebabs);
  ['issueUser', 'issueBook', 'issueDueDate', 'restorePoint'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      if (id === 'restorePoint') checkRestoreConfirm();
      else updateIssuePreview();
    });
  });
  try {
    await loadOverview();
  } catch (error) {
    showToast('error', error.message || 'Unable to load admin dashboard.', '\u26A0');
  }
});

window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.topbar-search')) {
      clearSearchResults();
    }
  });
});

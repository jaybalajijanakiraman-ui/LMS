/* ═══════════════════════════════════════
   MOCK DATA
═══════════════════════════════════════ */
const COLORS = ['#3b82f6', '#c9a84c', '#14b8a6', '#8b5cf6', '#ef4444', '#22c55e', '#f59e0b', '#0ea5e9'];
const DEPT_COLORS = { 'Computer Science & Engineering': '#3b82f6', 'Electronics & Communication': '#8b5cf6', 'Mechanical Engineering': '#14b8a6', 'Civil Engineering': '#f59e0b', 'Information Technology': '#22c55e', 'Library & Admin': '#c9a84c' };
const ROLE_COLORS = { Student: '#3b82f6', Faculty: '#22c55e', Librarian: '#c9a84c', Administrator: '#ef4444' };

const USERS = [
    { id: 1, firstName: 'Ravi', lastName: 'Kumar', userId: '22VR1A0501', email: 'ravi.kumar@vemu.ac.in', role: 'Student', dept: 'Computer Science & Engineering', status: 'Active', joined: '2022-06-15' },
    { id: 2, firstName: 'Priya', lastName: 'Reddy', userId: '21VR1A0223', email: 'priya.reddy@vemu.ac.in', role: 'Student', dept: 'Electronics & Communication', status: 'Active', joined: '2021-06-10' },
    { id: 3, firstName: 'Dr. Srinivas', lastName: 'Rao', userId: 'FAC-2019-004', email: 'srinivas.rao@vemu.ac.in', role: 'Faculty', dept: 'Computer Science & Engineering', status: 'Active', joined: '2019-07-01' },
    { id: 4, firstName: 'Ananya', lastName: 'Patel', userId: '23VR1A0301', email: 'ananya.patel@vemu.ac.in', role: 'Student', dept: 'Mechanical Engineering', status: 'Active', joined: '2023-06-20' },
    { id: 5, firstName: 'Mohammed', lastName: 'Fazil', userId: 'FAC-2020-011', email: 'm.fazil@vemu.ac.in', role: 'Faculty', dept: 'Mathematics', status: 'Active', joined: '2020-08-01' },
    { id: 6, firstName: 'Kavitha', lastName: 'Devi', userId: 'LIB-003', email: 'kavitha.lib@vemu.ac.in', role: 'Librarian', dept: 'Library & Admin', status: 'Active', joined: '2018-04-12' },
    { id: 7, firstName: 'Suresh', lastName: 'Babu', userId: '22VR1A0112', email: 'suresh.babu@vemu.ac.in', role: 'Student', dept: 'Civil Engineering', status: 'Inactive', joined: '2022-06-15' },
    { id: 8, firstName: 'Lakshmi', lastName: 'Narayana', userId: 'ADM-001', email: 'admin@vemu.ac.in', role: 'Administrator', dept: 'Library & Admin', status: 'Active', joined: '2017-01-01' },
    { id: 9, firstName: 'Harsha', lastName: 'Vardhan', userId: '22VR1A0609', email: 'harsha.v@vemu.ac.in', role: 'Student', dept: 'Information Technology', status: 'Suspended', joined: '2022-06-15' },
    { id: 10, firstName: 'Deepika', lastName: 'Sri', userId: 'FAC-2021-007', email: 'deepika.sri@vemu.ac.in', role: 'Faculty', dept: 'Electronics & Communication', status: 'Active', joined: '2021-07-05' },
    { id: 11, firstName: 'Venkat', lastName: 'Ramana', userId: '23VR1A1201', email: 'venkat.r@vemu.ac.in', role: 'Student', dept: 'Mechanical Engineering', status: 'Active', joined: '2023-06-18' },
    { id: 12, firstName: 'Asha', lastName: 'Latha', userId: 'LIB-004', email: 'asha.lib@vemu.ac.in', role: 'Librarian', dept: 'Library & Admin', status: 'Active', joined: '2020-09-01' },
];

const BOOKS = [
    { id: 1, title: 'Introduction to Algorithms', author: 'Cormen, Leiserson', isbn: '978-0262033848', category: 'Computer Science', totalCopies: 8, availCopies: 5, location: 'A-2-S-3', status: 'Available', year: 2022 },
    { id: 2, title: 'Digital Electronics & Design', author: 'David Harris', isbn: '978-0128145302', category: 'Electronics', totalCopies: 6, availCopies: 0, location: 'B-1-S-2', status: 'Loaned', year: 2019 },
    { id: 3, title: 'Engineering Mathematics Vol. I', author: 'B.S. Grewal', isbn: '978-8174091955', category: 'Mathematics', totalCopies: 15, availCopies: 10, location: 'C-3-S-1', status: 'Available', year: 2020 },
    { id: 4, title: 'Operating System Concepts', author: 'Silberschatz, Galvin', isbn: '978-1118063330', category: 'Computer Science', totalCopies: 10, availCopies: 3, location: 'A-1-S-4', status: 'Available', year: 2021 },
    { id: 5, title: 'Management Principles & Practice', author: 'Koontz & Weihrich', isbn: '978-0071074087', category: 'Management', totalCopies: 4, availCopies: 4, location: 'D-2-S-2', status: 'Available', year: 2018 },
    { id: 6, title: 'University Physics', author: 'Young & Freedman', isbn: '978-0321982568', category: 'Physics', totalCopies: 7, availCopies: 1, location: 'E-1-S-1', status: 'Available', year: 2019 },
    { id: 7, title: 'Data Structures Using C', author: 'Reema Thareja', isbn: '978-0198099307', category: 'Computer Science', totalCopies: 12, availCopies: 7, location: 'A-2-S-1', status: 'Available', year: 2021 },
    { id: 8, title: 'Signals & Systems', author: 'Oppenheim & Willsky', isbn: '978-0138147570', category: 'Electronics', totalCopies: 5, availCopies: 0, location: 'B-2-S-3', status: 'Lost', year: 2015 },
    { id: 9, title: 'The Alchemist', author: 'Paulo Coelho', isbn: '978-0062315007', category: 'General Fiction', totalCopies: 3, availCopies: 2, location: 'F-1-S-1', status: 'Available', year: 2014 },
    { id: 10, title: 'Database System Concepts', author: 'Silberschatz et al.', isbn: '978-1260084504', category: 'Computer Science', totalCopies: 9, availCopies: 4, location: 'A-3-S-2', status: 'Available', year: 2020 },
    { id: 11, title: 'Fluid Mechanics', author: 'Frank White', isbn: '978-0073398273', category: 'Mechanical', totalCopies: 6, availCopies: 5, location: 'G-1-S-2', status: 'Available', year: 2017 },
    { id: 12, title: 'Computer Networks', author: 'Andrew Tanenbaum', isbn: '978-0132126953', category: 'Computer Science', totalCopies: 8, availCopies: 2, location: 'A-4-S-1', status: 'Available', year: 2021 },
];

const TRANSACTIONS = [
    { id: 'TXN-0001', userId: '22VR1A0501', userName: 'Ravi Kumar', bookId: 'B001', bookTitle: 'Introduction to Algorithms', checkout: '2025-03-01', due: '2025-03-15', returned: '2025-03-14', fine: 0, status: 'Returned' },
    { id: 'TXN-0002', userId: '21VR1A0223', userName: 'Priya Reddy', bookId: 'B004', bookTitle: 'Operating System Concepts', checkout: '2025-03-05', due: '2025-03-19', returned: null, fine: 4, status: 'Overdue' },
    { id: 'TXN-0003', userId: '22VR1A0609', userName: 'Harsha Vardhan', bookId: 'B008', bookTitle: 'Signals & Systems', checkout: '2025-02-10', due: '2025-02-24', returned: null, fine: 50, status: 'Lost' },
    { id: 'TXN-0004', userId: '23VR1A0301', userName: 'Ananya Patel', bookId: 'B003', bookTitle: 'Engineering Mathematics', checkout: '2025-03-10', due: '2025-03-24', returned: null, fine: 0, status: 'Borrowed' },
    { id: 'TXN-0005', userId: 'FAC-2019-004', userName: 'Dr. Srinivas Rao', bookId: 'B002', bookTitle: 'Digital Electronics', checkout: '2025-02-20', due: '2025-03-06', returned: null, fine: 28, status: 'Overdue' },
    { id: 'TXN-0006', userId: '23VR1A1201', userName: 'Venkat Ramana', bookId: 'B007', bookTitle: 'Data Structures Using C', checkout: '2025-03-12', due: '2025-03-26', returned: null, fine: 0, status: 'Borrowed' },
    { id: 'TXN-0007', userId: '22VR1A0112', userName: 'Suresh Babu', bookId: 'B010', bookTitle: 'Database System Concepts', checkout: '2025-03-08', due: '2025-03-22', returned: '2025-03-21', fine: 0, status: 'Returned' },
    { id: 'TXN-0008', userId: 'FAC-2020-011', userName: 'Mohammed Fazil', bookId: 'B006', bookTitle: 'University Physics', checkout: '2025-03-15', due: '2025-03-29', returned: null, fine: 0, status: 'Borrowed' },
];

const AUDIT_LOG = [
    { ts: '2025-03-21 09:42:11', method: 'POST', user: 'SuperAdmin', action: 'POST /api/users — Created user "Ananya Patel" (Student)', status: 201 },
    { ts: '2025-03-21 09:38:04', method: 'PUT', user: 'SuperAdmin', action: 'PUT /api/users/22VR1A0609/status — Status → Suspended', status: 200 },
    { ts: '2025-03-21 08:15:55', method: 'GET', user: 'SuperAdmin', action: 'GET /api/reports/most-borrowed — Report generated', status: 200 },
    { ts: '2025-03-20 22:01:14', method: 'POST', user: 'System', action: 'POST /api/system/backup — Automated backup completed (248.7 MB)', status: 200 },
    { ts: '2025-03-20 17:22:38', method: 'DELETE', user: 'SuperAdmin', action: 'DELETE /api/users/OLD-001 — Deactivated user "Retired Staff"', status: 200 },
    { ts: '2025-03-20 14:05:01', method: 'PUT', user: 'SuperAdmin', action: 'PUT /api/books/B012/copies — Total copies updated to 8', status: 200 },
    { ts: '2025-03-20 11:55:20', method: 'POST', user: 'LIB-003', action: 'POST /api/transactions — Book issued TXN-0008 to M.Fazil', status: 201 },
    { ts: '2025-03-20 10:00:33', method: 'POST', user: 'SuperAdmin', action: 'POST /api/roles — New role "Research Scholar" created', status: 201 },
    { ts: '2025-03-19 16:44:15', method: 'PUT', user: 'LIB-003', action: 'PUT /api/transactions/TXN-0007 — Book returned by Suresh Babu', status: 200 },
    { ts: '2025-03-19 09:12:07', method: 'GET', user: 'SuperAdmin', action: 'GET /api/reports/inventory — Inventory report exported to CSV', status: 200 },
    { ts: '2025-03-18 15:30:00', method: 'PUT', user: 'SuperAdmin', action: 'PUT /api/system/config — Fine rate updated to ₹2/day', status: 200 },
    { ts: '2025-03-18 08:00:01', method: 'POST', user: 'System', action: 'POST /api/system/backup — Automated backup completed (246.1 MB)', status: 200 },
];

const ACTIVITY_FEED = [
    { icon: '👤', text: 'Admin created user <strong>Ananya Patel</strong> (Student)', meta: 'Today, 9:42 AM · User Management', color: 'var(--blue)' },
    { icon: '🔒', text: 'Account <strong>Harsha Vardhan</strong> suspended', meta: 'Today, 9:38 AM · User Management', color: 'var(--red)' },
    { icon: '📊', text: 'Most-Borrowed report generated by Admin', meta: 'Today, 8:15 AM · Analytics', color: 'var(--purple)' },
    { icon: '💾', text: 'Automated backup completed — 248.7 MB', meta: 'Yesterday, 10:01 PM · System', color: 'var(--green)' },
    { icon: '🗑️', text: 'User account <strong>Old Staff</strong> deactivated', meta: 'Yesterday, 5:22 PM · User Management', color: 'var(--amber)' },
    { icon: '📖', text: 'Book <strong>Database System Concepts</strong> returned by Suresh Babu', meta: 'Yesterday, 4:44 PM · Transactions', color: 'var(--teal)' },
    { icon: '⚙️', text: 'System configuration updated: Fine rate → ₹2/day', meta: 'Mar 18 · System', color: 'var(--amber)' },
    { icon: '📤', text: 'Book issued to <strong>Mohammed Fazil</strong> — University Physics', meta: 'Mar 20 · Transactions', color: 'var(--blue)' },
];

const PENDING = [
    { icon: '📘', iconBg: 'var(--blue-bg)', title: 'Book Purchase Request: "VLSI Design" ×4', sub: 'Requested by Dr. Srinivas Rao · Mar 18', type: 'purchase' },
    { icon: '👤', iconBg: 'var(--green-bg)', title: 'New Account Approval: Kiran Tej (Student)', sub: '22VR1A1045 · CSE Dept · Mar 20', type: 'user' },
    { icon: '⚠️', iconBg: 'var(--amber-bg)', title: 'Overdue Notice: 14 books unpaid fines > ₹50', sub: 'Auto-generated · Mar 21', type: 'overdue' },
];

/* ═══════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════ */
const PAGES = {
    dashboard: { icon: '🏠', title: 'Dashboard', breadcrumb: 'Overview' },
    users: { icon: '👥', title: 'User Management', breadcrumb: 'Accounts & Roles' },
    inventory: { icon: '📖', title: 'Library Inventory', breadcrumb: 'Books & Resources' },
    transactions: { icon: '🔄', title: 'Transactions', breadcrumb: 'Loans & Returns' },
    reports: { icon: '📊', title: 'Reports & Analytics', breadcrumb: 'Insights' },
    system: { icon: '⚙️', title: 'System Maintenance', breadcrumb: 'Backup & Settings' },
    audit: { icon: '🔐', title: 'Audit Log', breadcrumb: 'Activity History' },
};

function navigate(section, el) {
    document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById('sec-' + section);
    if (sec) sec.classList.add('active');

    const p = PAGES[section] || {};
    document.getElementById('topbarIcon').textContent = p.icon || '📌';
    document.getElementById('topbarTitle').textContent = p.title || section;
    document.getElementById('topbarBreadcrumb').textContent = '/ ' + (p.breadcrumb || '');

    // Init section data
    if (section === 'users') renderUserTable(1);
    if (section === 'inventory') renderBookTable(1);
    if (section === 'transactions') renderTxTable();
    if (section === 'reports') initReports();
    if (section === 'audit') renderAuditLog(1);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

/* ═══════════════════════════════════════
   DASHBOARD INIT
═══════════════════════════════════════ */
let trendChart, catChart, reportMainChart, reportPieChart;

function initDashboard() {
    renderActivityFeed();
    renderSystemStatus();
    renderPendingApprovals();
    initTrendChart();
    initCatChart();
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const d = new Date();
    document.getElementById('live-time').textContent =
        d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('en-IN');
}

function refreshDashboard() {
    showToast('success', 'Dashboard refreshed successfully!', '↻');
    // Animate stat numbers
    animateCounter('stat-users', 1248);
    animateCounter('stat-books', 55432);
    animateCounter('stat-loans', 384);
    animateCounter('stat-overdue', 27);
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    const start = 0; const duration = 800; let startTime = null;
    function step(ts) {
        if (!startTime) startTime = ts;
        const p = Math.min((ts - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(eased * target).toLocaleString('en-IN');
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function renderActivityFeed() {
    const feed = document.getElementById('activityFeed');
    feed.innerHTML = ACTIVITY_FEED.map(a => `
    <div class="feed-item">
      <div class="feed-dot" style="background:${a.color}"></div>
      <div>
        <div class="feed-text">${a.icon} ${a.text}</div>
        <div class="feed-meta">${a.meta}</div>
      </div>
    </div>
  `).join('');
}

function loadMoreActivity() {
    showToast('info', 'Loading older activity from API…', '📜');
}

function renderSystemStatus() {
    const services = [
        { name: 'Web Server (Nginx)', status: 'Active', pill: 'pill-green', pulse: 'pulse-green' },
        { name: 'Database (MySQL)', status: 'Active', pill: 'pill-green', pulse: 'pulse-green' },
        { name: 'Backup Service', status: 'Active', pill: 'pill-green', pulse: 'pulse-green' },
        { name: 'Email Notification', status: 'Active', pill: 'pill-green', pulse: 'pulse-green' },
        { name: 'Search Index', status: 'Indexing', pill: 'pill-amber', pulse: 'pulse-amber' },
        { name: 'SSL Certificate', status: 'Valid', pill: 'pill-blue', pulse: 'pulse-green' },
    ];
    document.getElementById('systemStatus').innerHTML = services.map(s => `
    <div class="status-row">
      <span class="status-name"><span class="pulse ${s.pulse}"></span>${s.name}</span>
      <span class="status-pill ${s.pill}">${s.status}</span>
    </div>
  `).join('');
}

function renderPendingApprovals() {
    document.getElementById('pendingApprovals').innerHTML = PENDING.map((p, i) => `
    <div class="approval-item">
      <div class="approval-icon" style="background:${p.iconBg}">${p.icon}</div>
      <div class="approval-info">
        <div class="approval-title">${p.title}</div>
        <div class="approval-sub">${p.sub}</div>
      </div>
      <div class="approval-actions">
        <button class="btn btn-sm" style="background:var(--green-bg);color:var(--green);border:1px solid rgba(34,197,94,.2)" onclick="approveItem(${i})">✓</button>
        <button class="btn btn-sm btn-danger" onclick="dismissItem(${i})">✕</button>
      </div>
    </div>
  `).join('');
}

function approveItem(i) {
    showToast('success', `"${PENDING[i].title.substring(0, 40)}…" approved!`, '✅');
}
function dismissItem(i) {
    showToast('info', `Item dismissed.`, '🗑️');
}

function initTrendChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
            datasets: [
                {
                    label: 'Issued', data: [312, 287, 401, 356, 398, 384],
                    borderColor: COLORS[0], backgroundColor: 'rgba(59,130,246,.1)',
                    tension: .4, fill: true, pointRadius: 4, pointBackgroundColor: COLORS[0]
                },
                {
                    label: 'Returned', data: [298, 275, 389, 340, 381, 362],
                    borderColor: COLORS[2], backgroundColor: 'rgba(20,184,166,.08)',
                    tension: .4, fill: true, pointRadius: 4, pointBackgroundColor: COLORS[2]
                },
            ]
        },
        options: {
            responsive: true, plugins: { legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 12 }, usePointStyle: true } } },
            scales: {
                x: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 11 } } },
                y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 11 } } }
            }
        }
    });
}

function updateTrendChart(range) {
    const data6 = [312, 287, 401, 356, 398, 384];
    const data12 = [210, 245, 312, 287, 401, 356, 398, 384, 320, 360, 375, 384];
    const labels6 = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const labels12 = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const d = range === 'Last 6 Months' ? data6 : data12;
    const l = range === 'Last 6 Months' ? labels6 : labels12;
    trendChart.data.labels = l;
    trendChart.data.datasets[0].data = d;
    trendChart.data.datasets[1].data = d.map(v => Math.round(v * .93));
    trendChart.update();
}

function initCatChart() {
    const ctx = document.getElementById('catChart').getContext('2d');
    catChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['CS & IT', 'Electronics', 'Mathematics', 'Management', 'Physics', 'Others'],
            datasets: [{
                data: [24, 18, 20, 12, 10, 16], backgroundColor: COLORS.slice(0, 6),
                borderColor: '#fff', borderWidth: 2
            }]
        },
        options: {
            responsive: true, cutout: '65%',
            plugins: { legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 }, usePointStyle: true, padding: 12 } } }
        }
    });
}

/* ═══════════════════════════════════════
   USER TABLE
═══════════════════════════════════════ */
let userPage = 1; const usersPerPage = 8;
let filteredUsers = [...USERS];
let editingUserId = null;

function filterUsers() {
    const q = document.getElementById('userSearch').value.toLowerCase();
    const r = document.getElementById('roleFilter').value;
    const st = document.getElementById('statusFilter').value;
    filteredUsers = USERS.filter(u =>
        (!q || (u.firstName + ' ' + u.lastName + u.userId + u.email).toLowerCase().includes(q)) &&
        (!r || u.role === r) &&
        (!st || u.status === st)
    );
    userPage = 1;
    renderUserTable(1);
}

function renderUserTable(page) {
    userPage = page;
    const start = (page - 1) * usersPerPage, end = start + usersPerPage;
    const pageUsers = filteredUsers.slice(start, end);
    const tbody = document.getElementById('userTableBody');

    if (!pageUsers.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="es-icon">🔍</div><p>No users match your search.</p></div></td></tr>`;
    } else {
        tbody.innerHTML = pageUsers.map(u => {
            const initials = (u.firstName[0] + (u.lastName[0] || '')).toUpperCase();
            const rc = ROLE_COLORS[u.role] || '#888';
            const pillMap = { Active: 'pill-green', Inactive: 'pill-navy', Suspended: 'pill-red' };
            return `
        <tr>
          <td>
            <div class="user-cell">
              <div class="u-avatar" style="background:${rc}">${initials}</div>
              <div><div class="u-name">${u.firstName} ${u.lastName}</div><div class="u-email">${u.email}</div></div>
            </div>
          </td>
          <td><span style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-sec)">${u.userId}</span></td>
          <td><span class="status-pill ${u.role === 'Administrator' ? 'pill-red' : u.role === 'Librarian' ? 'pill-amber' : u.role === 'Faculty' ? 'pill-teal' : 'pill-blue'}">${u.role}</span></td>
          <td style="font-size:.78rem;color:var(--text-sec)">${u.dept}</td>
          <td><span class="status-pill ${pillMap[u.status] || 'pill-navy'}">${u.status}</span></td>
          <td style="font-size:.78rem;color:var(--text-muted)">${formatDate(u.joined)}</td>
          <td style="text-align:right">
            <div class="kebab-wrap">
              <button class="kebab-btn" onclick="toggleKebab(event,'kb-${u.id}')">⋮</button>
              <div class="kebab-menu" id="kb-${u.id}">
                <div class="kebab-item" onclick="editUser(${u.id})">✏️ Edit Details</div>
                <div class="kebab-item" onclick="assignRole(${u.id})">🎭 Assign Role</div>
                <div class="kebab-item" onclick="resetPassword(${u.id})">🔑 Reset Password</div>
                <div class="kebab-item" onclick="toggleStatus(${u.id})">${u.status === 'Active' ? '🚫 Deactivate' : '✅ Activate'}</div>
                <div class="kebab-divider"></div>
                <div class="kebab-item danger" onclick="deleteUser(${u.id})">🗑️ Delete Account</div>
              </div>
            </div>
          </td>
        </tr>`;
        }).join('');
    }

    document.getElementById('userCount').textContent = `${filteredUsers.length} users`;
    document.getElementById('userPaginInfo').textContent =
        `Showing ${Math.min(start + 1, filteredUsers.length)}–${Math.min(end, filteredUsers.length)} of ${filteredUsers.length} users`;
    renderPagination('userPagination', page, Math.ceil(filteredUsers.length / usersPerPage), renderUserTable);
}

function editUser(id) {
    closeAllKebabs();
    const u = USERS.find(x => x.id === id);
    if (!u) return;
    editingUserId = id;
    document.getElementById('userModalTitle').textContent = 'Edit User';
    document.getElementById('mFirstName').value = u.firstName;
    document.getElementById('mLastName').value = u.lastName;
    document.getElementById('mUserId').value = u.userId;
    document.getElementById('mEmail').value = u.email;
    document.getElementById('mRole').value = u.role;
    document.getElementById('mDept').value = u.dept;
    document.getElementById('mStatus').value = u.status;
    openModal('userModal');
}

function assignRole(id) {
    closeAllKebabs();
    const u = USERS.find(x => x.id === id);
    const roles = ['Student', 'Faculty', 'Librarian', 'Administrator'];
    const current = roles.indexOf(u.role);
    const next = roles[(current + 1) % roles.length];
    confirmAction(`Assign Role`, `Change ${u.firstName} ${u.lastName}'s role from <strong>${u.role}</strong> to <strong>${next}</strong>?`, '🎭', () => {
        u.role = next;
        renderUserTable(userPage);
        showToast('success', `Role updated to ${next} for ${u.firstName}!`, '🎭');
    });
}

function resetPassword(id) {
    closeAllKebabs();
    const u = USERS.find(x => x.id === id);
    confirmAction('Reset Password', `A temporary password will be generated and sent to <strong>${u.email}</strong>.`, '🔑', () => {
        showToast('success', `Temporary password sent to ${u.email}`, '📧');
    });
}

function toggleStatus(id) {
    closeAllKebabs();
    const u = USERS.find(x => x.id === id);
    const newStatus = u.status === 'Active' ? 'Inactive' : 'Active';
    u.status = newStatus;
    renderUserTable(userPage);
    showToast(newStatus === 'Active' ? 'success' : 'info', `${u.firstName}'s account ${newStatus.toLowerCase()}d.`, '🔄');
}

function deleteUser(id) {
    closeAllKebabs();
    const u = USERS.find(x => x.id === id);
    confirmAction('Delete Account',
        `This will permanently remove <strong>${u.firstName} ${u.lastName}</strong>. Consider deactivating instead to preserve history.`,
        '🗑️', () => {
            const idx = USERS.findIndex(x => x.id === id);
            if (idx > -1) USERS.splice(idx, 1);
            filteredUsers = [...USERS];
            renderUserTable(1);
            showToast('success', 'User account deleted.', '🗑️');
        }
    );
}

function openUserModal(clear = true) {
    if (clear) {
        editingUserId = null;
        document.getElementById('userModalTitle').textContent = 'Add New User';
        ['mFirstName', 'mLastName', 'mUserId', 'mEmail', 'mPhone'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
    }
    openModal('userModal');
}

function saveUser() {
    const fn = document.getElementById('mFirstName').value.trim();
    const ln = document.getElementById('mLastName').value.trim();
    const uid = document.getElementById('mUserId').value.trim();
    const email = document.getElementById('mEmail').value.trim();
    const role = document.getElementById('mRole').value;

    if (!fn || !ln || !uid || !email || !role) {
        showToast('error', 'Please fill all required fields.', '⚠️'); return;
    }

    if (editingUserId) {
        const u = USERS.find(x => x.id === editingUserId);
        if (u) {
            u.firstName = fn; u.lastName = ln; u.email = email; u.role = role;
            u.dept = document.getElementById('mDept').value; u.status = document.getElementById('mStatus').value;
        }
        showToast('success', `${fn} ${ln}'s account updated!`, '✅');
    } else {
        USERS.push({
            id: Date.now(), firstName: fn, lastName: ln, userId: uid, email, role,
            dept: document.getElementById('mDept').value, status: document.getElementById('mStatus').value,
            joined: new Date().toISOString().slice(0, 10)
        });
        showToast('success', `User ${fn} ${ln} created successfully!`, '👤');
    }

    closeModal('userModal');
    filteredUsers = [...USERS];
    renderUserTable(1);
}

/* ═══════════════════════════════════════
   BOOK TABLE
═══════════════════════════════════════ */
let bookPage = 1; const booksPerPage = 8; let filteredBooks = [...BOOKS];

function filterBooks() {
    const q = document.getElementById('bookSearch').value.toLowerCase();
    const c = document.getElementById('catFilter').value;
    const av = document.getElementById('availFilter').value;
    filteredBooks = BOOKS.filter(b =>
        (!q || (b.title + b.author + b.isbn).toLowerCase().includes(q)) &&
        (!c || b.category === c) &&
        (!av || b.status === av)
    );
    bookPage = 1;
    renderBookTable(1);
}

function renderBookTable(page) {
    bookPage = page;
    const start = (page - 1) * booksPerPage, end = start + booksPerPage;
    const pBooks = filteredBooks.slice(start, end);
    const tbody = document.getElementById('bookTableBody');

    if (!pBooks.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="es-icon">📚</div><p>No books match your filter.</p></div></td></tr>`;
    } else {
        tbody.innerHTML = pBooks.map(b => {
            const avPct = b.totalCopies ? Math.round(b.availCopies / b.totalCopies * 100) : 0;
            const spMap = { Available: 'pill-green', Loaned: 'pill-amber', Lost: 'pill-red' };
            return `
        <tr style="cursor:pointer" onclick="viewBook(${b.id})">
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="book-cover-placeholder" style="background:${COLORS[b.id % 8]}22;color:${COLORS[b.id % 8]};width:40px;height:54px;font-size:1.2rem">📖</div>
              <div><div style="font-weight:600;font-size:.85rem;color:var(--navy);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.title}</div>
              <div style="font-size:.73rem;color:var(--text-muted)">${b.author} · ${b.year}</div></div>
            </div>
          </td>
          <td style="font-family:var(--font-mono);font-size:.72rem;color:var(--text-sec)">${b.isbn}</td>
          <td><span class="status-pill pill-blue" style="font-size:.66rem">${b.category}</span></td>
          <td style="font-size:.85rem;text-align:center">${b.totalCopies}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:.85rem;font-weight:600;color:${b.availCopies === 0 ? 'var(--red)' : 'var(--green)'}">${b.availCopies}</span>
              <div class="progress-bar" style="width:50px"><div class="progress-fill" style="width:${avPct}%;background:${b.availCopies === 0 ? 'var(--red)' : 'var(--green)'}"></div></div>
            </div>
          </td>
          <td style="font-family:var(--font-mono);font-size:.75rem;color:var(--text-sec)">${b.location}</td>
          <td><span class="status-pill ${spMap[b.status] || 'pill-navy'}">${b.status}</span></td>
          <td style="text-align:right;padding-right:16px">
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();showToast('info','Edit book connects to your API.','✏️')">✏️</button>
          </td>
        </tr>`;
        }).join('');
    }

    document.getElementById('bookCount').textContent = `${filteredBooks.length} books`;
    document.getElementById('bookPaginInfo').textContent =
        `Showing ${Math.min(start + 1, filteredBooks.length)}–${Math.min(end, filteredBooks.length)} of ${filteredBooks.length} books`;
    renderPagination('bookPagination', page, Math.ceil(filteredBooks.length / booksPerPage), renderBookTable);
}

function viewBook(id) {
    const b = BOOKS.find(x => x.id === id); if (!b) return;
    document.getElementById('bookModalTitle').textContent = b.title;
    document.getElementById('bookModalBody').innerHTML = `
    <div style="display:flex;gap:20px;margin-bottom:16px">
      <div style="width:80px;height:110px;border-radius:8px;background:${COLORS[id % 8]}22;display:flex;align-items:center;justify-content:center;font-size:2.5rem;flex-shrink:0">📖</div>
      <div>
        <div style="font-family:var(--font-display);font-size:1.2rem;font-weight:700;color:var(--navy);margin-bottom:4px">${b.title}</div>
        <div style="font-size:.85rem;color:var(--text-sec);margin-bottom:6px">By <strong>${b.author}</strong> · ${b.year}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="status-pill pill-blue">${b.category}</span>
          <span class="status-pill ${b.status === 'Available' ? 'pill-green' : b.status === 'Lost' ? 'pill-red' : 'pill-amber'}">${b.status}</span>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      ${[['ISBN', b.isbn], ['Location', b.location], ['Total Copies', b.totalCopies], ['Available', b.availCopies]].map(([l, v]) => `
      <div style="background:var(--surface-2);border-radius:var(--radius-md);padding:10px 14px;border:1px solid var(--border-soft)">
        <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:3px">${l}</div>
        <div style="font-size:.88rem;font-weight:600;color:var(--navy);font-family:${l === 'ISBN' || l === 'Location' ? 'var(--font-mono)' : 'inherit'}">${v}</div>
      </div>`).join('')}
    </div>
    <h4 style="font-size:.85rem;font-weight:700;color:var(--navy);margin-bottom:10px">📋 Recent Transaction History</h4>
    ${TRANSACTIONS.filter(t => t.bookTitle.includes(b.title.split(' ')[0])).slice(0, 3).map(t => `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border-soft);font-size:.8rem">
        <span class="status-pill ${t.status === 'Returned' ? 'pill-green' : t.status === 'Overdue' ? 'pill-red' : t.status === 'Lost' ? 'pill-red' : 'pill-amber'}">${t.status}</span>
        <span style="flex:1;color:var(--text-primary)">${t.userName}</span>
        <span style="color:var(--text-muted)">${t.checkout} → ${t.due}</span>
        <span style="color:${t.fine > 0 ? 'var(--red)' : 'var(--green)'}">₹${t.fine}</span>
      </div>`).join('') || '<p style="font-size:.8rem;color:var(--text-muted)">No transaction history found.</p>'}
  `;
    openModal('bookModal');
}

/* ═══════════════════════════════════════
   TRANSACTIONS TABLE
═══════════════════════════════════════ */
let filteredTx = [...TRANSACTIONS];

function filterTx() {
    const q = document.getElementById('txSearch').value.toLowerCase();
    const st = document.getElementById('txFilter').value;
    filteredTx = TRANSACTIONS.filter(t =>
        (!q || (t.userName + t.bookTitle + t.id).toLowerCase().includes(q)) &&
        (!st || t.status === st)
    );
    renderTxTable();
}

function renderTxTable() {
    const spMap = { Returned: 'pill-green', Borrowed: 'pill-blue', Overdue: 'pill-red', Lost: 'pill-red' };
    document.getElementById('txTableBody').innerHTML = filteredTx.map(t => `
    <tr>
      <td style="font-family:var(--font-mono);font-size:.75rem;color:var(--navy)">${t.id}</td>
      <td><div style="font-weight:600;font-size:.83rem">${t.userName}</div><div style="font-size:.72rem;color:var(--text-muted)">${t.userId}</div></td>
      <td style="font-size:.82rem;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.bookTitle}</td>
      <td style="font-size:.78rem;color:var(--text-sec)">${t.checkout}</td>
      <td style="font-size:.78rem;color:${t.status === 'Overdue' ? 'var(--red)' : 'var(--text-sec)'};font-weight:${t.status === 'Overdue' ? 700 : 400}">${t.due}</td>
      <td style="font-size:.78rem;color:var(--text-sec)">${t.returned || '—'}</td>
      <td style="font-weight:700;color:${t.fine > 0 ? 'var(--red)' : 'var(--green)'}">₹${t.fine}</td>
      <td><span class="status-pill ${spMap[t.status] || 'pill-navy'}">${t.status}</span></td>
    </tr>
  `).join('');
}

/* ═══════════════════════════════════════
   REPORTS
═══════════════════════════════════════ */
let currentReport = 'user-growth';

function initReports() {
    initReportCharts();
    renderReportTable();
}

function selectReport(type, btn) {
    document.querySelectorAll('.report-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentReport = type;
    updateReportCharts(type);
    renderReportTable(type);
}

function selectDateRange(el, range) {
    document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    updateReportCharts(currentReport);
}

function initReportCharts() {
    const ctx1 = document.getElementById('reportMainChart').getContext('2d');
    reportMainChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'New Users', data: [45, 62, 38, 71, 54, 87],
                backgroundColor: COLORS.map(c => c + '88'), borderColor: COLORS, borderWidth: 2, borderRadius: 6
            }]
        },
        options: {
            responsive: true, plugins: { legend: { labels: { font: { family: 'DM Sans' } } } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } } },
                y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 11 } } }
            }
        }
    });

    const ctx2 = document.getElementById('reportPieChart').getContext('2d');
    reportPieChart = new Chart(ctx2, {
        type: 'pie',
        data: {
            labels: ['Student', 'Faculty', 'Librarian', 'Admin'],
            datasets: [{
                data: [1100, 120, 22, 6], backgroundColor: [COLORS[0], COLORS[2], COLORS[1], COLORS[4]],
                borderColor: '#fff', borderWidth: 2
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 } } } } }
    });
}

function updateReportCharts(type) {
    const configs = {
        'user-growth': { label: 'New Users', data: [45, 62, 38, 71, 54, 87], type: 'bar', pieLabels: ['Student', 'Faculty', 'Librarian', 'Admin'], pieData: [1100, 120, 22, 6], title: '📈 User Growth' },
        'most-borrowed': { label: 'Times Borrowed', data: [124, 98, 87, 76, 65, 58], type: 'bar', pieLabels: ['CS', 'Electronics', 'Maths', 'Physics', 'Others'], pieData: [38, 22, 20, 12, 8], title: '🏆 Most Borrowed Books' },
        'inventory-value': { label: 'Value (₹ thousands)', data: [280, 190, 150, 120, 80, 60], type: 'bar', pieLabels: ['CS & IT', 'Electronics', 'Maths', 'Physics', 'Management', 'General'], pieData: [35, 20, 18, 12, 10, 5], title: '💰 Inventory Value' },
        'fines': { label: 'Fines Collected (₹)', data: [820, 950, 680, 1200, 760, 1100], type: 'line', pieLabels: ['Overdue', 'Lost', 'Damage', 'Other'], pieData: [60, 25, 10, 5], title: '⚖️ Fine Collection' },
    };
    const c = configs[type] || configs['user-growth'];
    document.getElementById('reportChartTitle').textContent = c.title;
    reportMainChart.data.datasets[0].label = c.label;
    reportMainChart.data.datasets[0].data = c.data;
    reportMainChart.config.type = c.type;
    if (c.type === 'line') {
        reportMainChart.data.datasets[0].fill = true;
        reportMainChart.data.datasets[0].tension = .4;
        reportMainChart.data.datasets[0].borderColor = COLORS[0];
        reportMainChart.data.datasets[0].backgroundColor = COLORS[0] + '22';
    } else {
        reportMainChart.data.datasets[0].borderColor = COLORS;
        reportMainChart.data.datasets[0].backgroundColor = COLORS.map(x => x + '88');
    }
    reportMainChart.update();
    reportPieChart.data.labels = c.pieLabels;
    reportPieChart.data.datasets[0].data = c.pieData;
    reportPieChart.update();
    renderReportTable(type);
}

function renderReportTable(type) {
    type = type || currentReport;
    const tables = {
        'user-growth': {
            heads: ['Month', 'New Users', 'Total Users', 'Growth %'],
            rows: [['March 2025', 87, 1248, '+7.5%'], ['February 2025', 54, 1161, '+4.9%'], ['January 2025', 71, 1107, '+6.9%'], ['December 2024', 38, 1036, '+3.8%']]
        },
        'most-borrowed': {
            heads: ['Rank', 'Book Title', 'Category', 'Times Borrowed'],
            rows: [['1', 'Introduction to Algorithms', 'CS', 124], ['2', 'Engineering Mathematics', 'Maths', 98], ['3', 'Operating System Concepts', 'CS', 87], ['4', 'Digital Electronics', 'Electronics', 76]]
        },
        'inventory-value': {
            heads: ['Category', 'Books', 'Avg Cost (₹)', 'Total Value (₹)'],
            rows: [['CS & IT', 14200, 620, '₹88,04,000'], ['Electronics', 8200, 680, '₹55,76,000'], ['Mathematics', 9100, 450, '₹40,95,000'], ['Others', 23932, 380, '₹90,94,160']]
        },
        'fines': {
            heads: ['Month', 'Overdue Fines (₹)', 'Lost Fines (₹)', 'Total (₹)'],
            rows: [['March 2025', 820, 280, '₹1,100'], ['February 2025', 960, 240, '₹1,200'], ['January 2025', 580, 180, '₹760'], ['December 2024', 700, 250, '₹950']]
        }
    };
    const t = tables[type] || tables['user-growth'];
    document.getElementById('reportTableHead').innerHTML = '<tr>' + t.heads.map(h => `<th>${h}</th>`).join('') + '</tr>';
    document.getElementById('reportTableBody').innerHTML = t.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
}

function exportReport(fmt) {
    showToast('success', `Report exported as ${fmt.toUpperCase()} — check your downloads folder.`, '📥');
}

/* ═══════════════════════════════════════
   AUDIT LOG
═══════════════════════════════════════ */
let auditPage = 1; const auditPerPage = 8; let filteredAudit = [...AUDIT_LOG];

function filterAudit() {
    const q = document.getElementById('auditSearch').value.toLowerCase();
    const m = document.getElementById('auditMethod').value;
    filteredAudit = AUDIT_LOG.filter(a =>
        (!q || (a.user + a.action).toLowerCase().includes(q)) &&
        (!m || a.method === m)
    );
    auditPage = 1; renderAuditLog(1);
}

function renderAuditLog(page) {
    auditPage = page;
    const start = (page - 1) * auditPerPage, end = start + auditPerPage;
    const pAudit = filteredAudit.slice(start, end);
    const container = document.getElementById('auditTableBody');

    container.innerHTML = pAudit.map(a => {
        const mc = { POST: 'method-post', PUT: 'method-put', DELETE: 'method-delete', GET: 'method-get' };
        const sp = { 200: 'pill-green', 201: 'pill-blue', 500: 'pill-red', 403: 'pill-red' };
        return `
      <div class="audit-row">
        <span class="audit-ts">${a.ts}</span>
        <span class="audit-method ${mc[a.method] || ''}">${a.method}</span>
        <span style="font-size:.78rem;font-weight:600;color:var(--navy)">${a.user}</span>
        <span style="font-size:.78rem;color:var(--text-sec)">${a.action}</span>
        <span class="status-pill ${sp[a.status] || 'pill-navy'}" style="font-size:.65rem;font-family:var(--font-mono)">${a.status}</span>
      </div>`;
    }).join('');

    document.getElementById('auditCount').textContent = `${filteredAudit.length} log entries`;
    renderPagination('auditPagination', page, Math.ceil(filteredAudit.length / auditPerPage), renderAuditLog);
}

/* ═══════════════════════════════════════
   SYSTEM MAINTENANCE
═══════════════════════════════════════ */
function performBackup() {
    const btn = event.currentTarget;
    const orig = btn.innerHTML;
    btn.innerHTML = '⏳ Backing up…'; btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = orig; btn.disabled = false;
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        document.getElementById('lastBackupTime').textContent = now;
        showToast('success', 'Database backup completed successfully! Stored securely.', '💾');
        AUDIT_LOG.unshift({ ts: now, method: 'POST', user: 'SuperAdmin', action: 'POST /api/system/backup — Manual backup completed', status: 200 });
    }, 2200);
}

function quickBackup() {
    showToast('info', 'Manual backup initiated — running in background…', '💾');
    setTimeout(() => showToast('success', 'Backup complete!', '✅'), 2500);
}

function checkRestoreConfirm() {
    const val = document.getElementById('restoreConfirm').value;
    const btn = document.getElementById('restoreBtn');
    const fld = document.getElementById('restoreConfirm');
    if (val === 'CONFIRM') {
        btn.disabled = false; btn.style.opacity = '1';
        fld.classList.add('confirmed');
    } else {
        btn.disabled = true; btn.style.opacity = '.4';
        fld.classList.remove('confirmed');
    }
}

function confirmRestore() {
    confirmAction('Restore Database',
        'This will overwrite ALL current data with the selected backup. This action cannot be undone. Are you absolutely sure?',
        '🔴', () => {
            document.getElementById('restoreConfirm').value = '';
            checkRestoreConfirm();
            showToast('success', 'Database restore initiated. System will restart momentarily.', '↺');
        }
    );
}

function scheduleChanged(name, toggle) {
    showToast(toggle.checked ? 'success' : 'info', `${name} backup ${toggle.checked ? 'enabled' : 'disabled'}.`, '⏰');
}

/* ═══════════════════════════════════════
   MODAL HELPERS
═══════════════════════════════════════ */
function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}

/* Confirm action wrapper */
let confirmCallback = null;
function confirmAction(title, msg, icon = '⚠️', cb) {
    document.getElementById('confirmIcon').textContent = icon;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').innerHTML = msg;
    confirmCallback = cb;
    const okBtn = document.getElementById('confirmOkBtn');
    okBtn.onclick = () => { closeModal('confirmOverlay'); if (confirmCallback) confirmCallback(); };
    openModal('confirmOverlay');
}

/* Kebab menus */
function toggleKebab(e, id) {
    e.stopPropagation();
    const menu = document.getElementById(id);
    const wasOpen = menu.classList.contains('open');
    closeAllKebabs();
    if (!wasOpen) menu.classList.add('open');
}
function closeAllKebabs() {
    document.querySelectorAll('.kebab-menu.open').forEach(m => m.classList.remove('open'));
}
document.addEventListener('click', closeAllKebabs);

/* Close overlay on bg click */
document.querySelectorAll('.overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); });
});

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */
function showToast(type, msg, icon = 'ℹ️') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(30px)'; t.style.transition = 'all .35s'; setTimeout(() => t.remove(), 350); }, 4000);
}

/* ═══════════════════════════════════════
   PAGINATION
═══════════════════════════════════════ */
function renderPagination(containerId, current, total, cb) {
    const c = document.getElementById(containerId); if (!c) return;
    if (total <= 1) { c.innerHTML = ''; return; }
    let html = `<button class="page-btn" ${current === 1 ? 'disabled' : ''} onclick="${cb.name}(${current - 1})">‹</button>`;
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - current) <= 1) {
            html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="${cb.name}(${i})">${i}</button>`;
        } else if (Math.abs(i - current) === 2) {
            html += `<span style="padding:0 4px;color:var(--text-muted);font-size:.8rem">…</span>`;
        }
    }
    html += `<button class="page-btn" ${current === total ? 'disabled' : ''} onclick="${cb.name}(${current + 1})">›</button>`;
    c.innerHTML = html;
}

/* ═══════════════════════════════════════
   GLOBAL SEARCH
═══════════════════════════════════════ */
function handleGlobalSearch(val) {
    if (!val.trim()) return;
    const matches = [
        ...USERS.filter(u => (u.firstName + ' ' + u.lastName + u.userId).toLowerCase().includes(val.toLowerCase())).map(u => ({ type: 'user', label: `👤 ${u.firstName} ${u.lastName} (${u.role})` })),
        ...BOOKS.filter(b => (b.title + b.author).toLowerCase().includes(val.toLowerCase())).map(b => ({ type: 'book', label: `📖 ${b.title} — ${b.author}` })),
    ].slice(0, 3);
    if (matches.length) {
        showToast('info', `${matches.length} result(s) for "${val}": ${matches.map(m => m.label).join(', ')}. Use dedicated sections for full view.`, '🔍');
    }
}

/* ═══════════════════════════════════════
   UTILS
═══════════════════════════════════════ */
function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ═══════════════════════════════════════
   BOOT
═══════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    // Stagger stat card entrance
    document.querySelectorAll('.stat-card').forEach((c, i) => {
        c.style.animationDelay = `${i * 0.08}s`;
        c.style.animation = `fadeIn .5s var(--ease) both`;
    });
    console.log('%c📚 Vemu Library Admin Panel', 'font-size:20px;color:#0d1b2a;font-weight:bold');
});
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'db.json');
const BACKUP_DIR = path.join(ROOT, 'backups');
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Library server running at http://localhost:${PORT}`);
});

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function ensureSystemState(db) {
  db.users = Array.isArray(db.users) ? db.users : [];
  db.books = Array.isArray(db.books) ? db.books : [];
  db.transactions = Array.isArray(db.transactions) ? db.transactions : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  db.sessions = Array.isArray(db.sessions) ? db.sessions : [];
  db.system = {
    auditRetentionDays: 90,
    backupHistoryLimit: 12,
    fineRate: 2,
    facultyBulkRequests: [],
    facultyPreferences: {},
    facultyProcurementRequests: [],
    facultyReserves: [],
    inventoryEvents: [],
    lastBackupTime: '-',
    loanPeriodDays: 14,
    ledgerEntries: [],
    maxBooksPerStudent: 3,
    reminderLog: [],
    renewalLimit: 2,
    lastRestoreTime: '',
    studentPaymentRequests: [],
    studentPreferences: {},
    studentRenewalRequests: [],
    studentReservations: [],
    backupSchedule: {
      daily: true,
      weekly: true,
      monthly: false,
    },
    restorePoints: [],
    undoStack: [],
    ...(db.system || {}),
  };
  db.system.backupSchedule = {
    daily: true,
    weekly: true,
    monthly: false,
    ...(db.system.backupSchedule || {}),
  };
  db.system.restorePoints = Array.isArray(db.system.restorePoints) ? db.system.restorePoints : [];
  db.system.undoStack = Array.isArray(db.system.undoStack) ? db.system.undoStack : [];
  db.system.ledgerEntries = Array.isArray(db.system.ledgerEntries) ? db.system.ledgerEntries : [];
  db.system.reminderLog = Array.isArray(db.system.reminderLog) ? db.system.reminderLog : [];
  db.system.inventoryEvents = Array.isArray(db.system.inventoryEvents) ? db.system.inventoryEvents : [];
  db.system.facultyReserves = Array.isArray(db.system.facultyReserves) ? db.system.facultyReserves : [];
  db.system.facultyProcurementRequests = Array.isArray(db.system.facultyProcurementRequests) ? db.system.facultyProcurementRequests : [];
  db.system.facultyBulkRequests = Array.isArray(db.system.facultyBulkRequests) ? db.system.facultyBulkRequests : [];
  db.system.studentReservations = Array.isArray(db.system.studentReservations) ? db.system.studentReservations : [];
  db.system.studentRenewalRequests = Array.isArray(db.system.studentRenewalRequests) ? db.system.studentRenewalRequests : [];
  db.system.studentPaymentRequests = Array.isArray(db.system.studentPaymentRequests) ? db.system.studentPaymentRequests : [];
  db.system.facultyPreferences = db.system.facultyPreferences && typeof db.system.facultyPreferences === 'object' && !Array.isArray(db.system.facultyPreferences)
    ? db.system.facultyPreferences
    : {};
  db.system.studentPreferences = db.system.studentPreferences && typeof db.system.studentPreferences === 'object' && !Array.isArray(db.system.studentPreferences)
    ? db.system.studentPreferences
    : {};
  return db;
}

function readDb() {
  const db = ensureSystemState(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
  db.users = (db.users || []).map((user) => normalizeUserRecord(db, user));
  return db;
}

function writeDb(db) {
  ensureSystemState(db);
  pruneAuditLog(db);
  trimRestorePoints(db, Number(db.system.backupHistoryLimit || 12));
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function ensureBackupDirectory() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(message);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function nowAuditStamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function createId(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function formatDateInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function normalizeRole(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'administrator' || normalized === 'admin') return 'Administrator';
  if (normalized === 'librarian') return 'Librarian';
  if (normalized === 'faculty') return 'Faculty';
  return 'Student';
}

function getToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function findSessionUser(db, req) {
  const token = getToken(req);
  if (!token) return null;
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function requireAuth(db, req, res) {
  const user = findSessionUser(db, req);
  if (!user) {
    sendJson(res, 401, { error: 'Please log in first.' });
    return null;
  }
  return user;
}

function requireAdmin(db, req, res) {
  const user = requireAuth(db, req, res);
  if (!user) return null;
  if (user.role !== 'Administrator') {
    sendJson(res, 403, { error: 'Administrator access is required.' });
    return null;
  }
  return user;
}

function requireLibrarian(db, req, res) {
  const user = requireAuth(db, req, res);
  if (!user) return null;
  if (user.role !== 'Librarian') {
    sendJson(res, 403, { error: 'Librarian access is required.' });
    return null;
  }
  return user;
}

function requireFaculty(db, req, res) {
  const user = requireAuth(db, req, res);
  if (!user) return null;
  if (user.role !== 'Faculty') {
    sendJson(res, 403, { error: 'Faculty access is required.' });
    return null;
  }
  return user;
}

function requireStudent(db, req, res) {
  const user = requireAuth(db, req, res);
  if (!user) return null;
  if (user.role !== 'Student') {
    sendJson(res, 403, { error: 'Student access is required.' });
    return null;
  }
  return user;
}

function addAudit(db, method, actor, action, status) {
  db.auditLog.unshift({
    ts: nowAuditStamp(),
    method,
    user: actor,
    action,
    status,
  });
  db.auditLog = db.auditLog.slice(0, 100);
}

function trimRestorePoints(db, limit = 12) {
  ensureSystemState(db);
  const overflow = db.system.restorePoints.slice(limit);
  db.system.restorePoints = db.system.restorePoints.slice(0, limit);
  overflow.forEach((item) => {
    const filePath = path.join(BACKUP_DIR, String(item.filename || ''));
    if (item.filename && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
}

function parseAuditTimestamp(value) {
  const parsed = new Date(String(value || '').replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pruneAuditLog(db) {
  ensureSystemState(db);
  const retentionDays = Math.max(0, Number(db.system.auditRetentionDays || 0));
  if (!retentionDays) {
    db.auditLog = db.auditLog.slice(0, 500);
    return;
  }
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - retentionDays);
  db.auditLog = db.auditLog
    .filter((entry) => {
      const parsed = parseAuditTimestamp(entry.ts);
      return !parsed || parsed >= cutoff;
    })
    .slice(0, 500);
}

function createBackupSnapshot(db, label = 'Manual backup') {
  ensureSystemState(db);
  ensureBackupDirectory();
  const snapshot = JSON.stringify(db, null, 2);
  const createdAt = nowIso();
  const stamp = createdAt.replace(/[:]/g, '-').replace(/\..+$/, '');
  const id = createId('backup');
  const filename = `${stamp}-${id}.json`;
  fs.writeFileSync(path.join(BACKUP_DIR, filename), snapshot);
  const record = {
    id,
    label,
    filename,
    createdAt,
    sizeBytes: Buffer.byteLength(snapshot),
  };
  db.system.restorePoints = [
    record,
    ...db.system.restorePoints.filter((item) => item && item.id !== id),
  ];
  trimRestorePoints(db, Number(db.system.backupHistoryLimit || 12));
  return record;
}

function trimArray(list, limit = 25) {
  return Array.isArray(list) ? list.slice(0, limit) : [];
}

function pushUndoAction(db, entry) {
  ensureSystemState(db);
  db.system.undoStack = trimArray([
    {
      id: createId('undo'),
      createdAt: nowIso(),
      ...entry,
    },
    ...db.system.undoStack,
  ], 25);
}

function addLedgerEntry(db, entry) {
  ensureSystemState(db);
  const record = {
    id: createId('ledger'),
    createdAt: nowIso(),
    ...entry,
  };
  db.system.ledgerEntries = trimArray([
    record,
    ...db.system.ledgerEntries,
  ], 100);
  return record;
}

function addReminderEntries(db, entries) {
  ensureSystemState(db);
  const createdEntries = entries.map((entry) => ({
    id: createId('reminder'),
    createdAt: nowIso(),
    ...entry,
  }));
  db.system.reminderLog = trimArray([
    ...createdEntries,
    ...db.system.reminderLog,
  ], 100);
  return createdEntries;
}

function addInventoryEvent(db, entry) {
  ensureSystemState(db);
  const record = {
    id: createId('inventory'),
    createdAt: nowIso(),
    ...entry,
  };
  db.system.inventoryEvents = trimArray([
    record,
    ...db.system.inventoryEvents,
  ], 150);
  return record;
}

function findRestorePoint(db, backupId) {
  ensureSystemState(db);
  return db.system.restorePoints.find((item) => String(item.id) === String(backupId)) || null;
}

function readBackupSnapshot(record) {
  if (!record || !record.filename) {
    throw new Error('Backup snapshot is missing.');
  }
  const filePath = path.join(BACKUP_DIR, record.filename);
  if (!fs.existsSync(filePath)) {
    throw new Error('Backup file could not be found on disk.');
  }
  return ensureSystemState(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function buildAdminOverview(db, admin, options = {}) {
  const sortedUsers = sortAdminUsers(
    db.users.map(sanitizeUser),
    options.userSortKey,
    options.userSortDir
  );
  const enrichedTransactions = db.transactions
    .map((item) => enrichTransaction(db, item))
    .sort((a, b) => new Date(b.checkout || b.returned || 0).getTime() - new Date(a.checkout || a.returned || 0).getTime());
  const activeTransactions = enrichedTransactions.filter((item) => !item.returned);
  const overdue = activeTransactions.filter((item) => new Date(item.due).getTime() < Date.now());

  return {
    currentUser: sanitizeUser(admin),
    users: sortedUsers.users,
    books: db.books.map((book) => ({ ...book, status: getBookStatus(book) })),
    transactions: enrichedTransactions,
    auditLog: db.auditLog,
    insights: buildDashboardInsights(db),
    notifications: buildAdminNotifications(db),
    pendingApprovals: buildPendingApprovals(db),
    stats: {
      totalUsers: db.users.length,
      totalBooks: db.books.reduce((sum, book) => sum + Number(book.totalCopies || 0), 0),
      activeLoans: activeTransactions.length,
      overdue: overdue.length,
    },
    system: db.system,
    meta: {
      refreshedAt: nowIso(),
      refreshReason: options.refreshReason || 'load',
      userSort: { key: sortedUsers.key, dir: sortedUsers.dir },
    },
  };
}

function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function sortAdminUsers(users, key = 'joined', dir = 'desc') {
  const normalizedKey = String(key || 'joined').toLowerCase();
  const normalizedDir = String(dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const multiplier = normalizedDir === 'asc' ? 1 : -1;
  const sorted = [...users];
  sorted.sort((left, right) => {
    let leftValue;
    let rightValue;

    if (normalizedKey === 'name') {
      leftValue = String(left.user_name || '').toLowerCase();
      rightValue = String(right.user_name || '').toLowerCase();
    } else if (normalizedKey === 'joined') {
      leftValue = new Date(left.joined || 0).getTime();
      rightValue = new Date(right.joined || 0).getTime();
    } else if (normalizedKey === 'role' || normalizedKey === 'dept' || normalizedKey === 'status' || normalizedKey === 'userid' || normalizedKey === 'email') {
      const actualKey = normalizedKey === 'userid' ? 'userId' : normalizedKey;
      leftValue = String(left[actualKey] || '').toLowerCase();
      rightValue = String(right[actualKey] || '').toLowerCase();
    } else {
      leftValue = new Date(left.joined || 0).getTime();
      rightValue = new Date(right.joined || 0).getTime();
    }

    if (leftValue < rightValue) return -1 * multiplier;
    if (leftValue > rightValue) return 1 * multiplier;
    return 0;
  });
  return { key: normalizedKey, dir: normalizedDir, users: sorted };
}

function getDefaultProfile() {
  return {
    linkedin: '',
    portfolio: '',
    goalText: '',
    motivationalWords: '',
  };
}

function getProfileStatus(db, user) {
  const userTransactions = db.transactions.filter((item) => item.userId === user.userId);
  const returnedCount = userTransactions.filter((item) => item.returned).length;
  const activeCount = userTransactions.filter((item) => !item.returned).length;
  const overdueCount = userTransactions.filter((item) => !item.returned && getDayDiff(item.due) < 0).length;
  const score = (returnedCount * 2) + activeCount - (overdueCount * 2);
  if (score >= 20) return 'Platinum';
  if (score >= 10) return 'Gold';
  if (score >= 4) return 'Elite';
  return 'Normal';
}

function normalizeUserRecord(db, user) {
  user.profile = { ...getDefaultProfile(), ...(user.profile || {}) };
  user.profileStatus = getProfileStatus(db, user);
  return user;
}

function enrichTransaction(db, transaction) {
  const book = db.books.find((entry) => entry.id === transaction.bookId);
  const user = db.users.find((entry) => entry.userId === transaction.userId);
  const dayDiff = getDayDiff(transaction.due);
  const fine = calculateTransactionFine(db, transaction);
  const status = transaction.status === 'Lost'
    ? 'Lost'
    : transaction.returned
      ? 'Returned'
      : dayDiff < 0
        ? 'Overdue'
        : (transaction.status || 'Borrowed');

  return {
    ...transaction,
    userName: user ? user.user_name : transaction.userName,
    bookTitle: book ? book.title : transaction.bookTitle,
    author: book ? book.author : '',
    isbn: book ? book.isbn : transaction.isbn,
    category: book ? book.category : transaction.category,
    location: book ? book.location : '',
    totalCopies: book ? Number(book.totalCopies || 0) : Number(transaction.totalCopies || 0),
    availCopies: book ? Number(book.availCopies || 0) : Number(transaction.availCopies || 0),
    dayDiff,
    isOverdue: !transaction.returned && dayDiff < 0,
    fine,
    fineStatus: buildSettlementState(db, { ...transaction, fine }),
    status,
  };
}

function getBookStatus(book) {
  if (book.archived) return 'Archived';
  if (book.availCopies <= 0) return 'Loaned';
  return 'Available';
}

function getDayDiff(dateValue, referenceDate = nowIso().slice(0, 10)) {
  const today = new Date(referenceDate);
  const target = new Date(dateValue);
  if (Number.isNaN(today.getTime()) || Number.isNaN(target.getTime())) return 0;
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function calculateTransactionFine(db, transaction) {
  if (transaction.fineOverride !== undefined && transaction.fineOverride !== null && transaction.fineOverride !== '') {
    return Number(transaction.fineOverride || 0);
  }
  const referenceDate = transaction.returned || nowIso().slice(0, 10);
  const dayDiff = getDayDiff(transaction.due, referenceDate);
  if (dayDiff < 0) {
    return Math.abs(dayDiff) * Number(db.system?.fineRate || 0);
  }
  return Number(transaction.fine || 0);
}

function buildSettlementState(db, transaction) {
  if (['Paid', 'Waived', 'Ledger', 'Partially Paid'].includes(transaction.fineStatus)) {
    return transaction.fineStatus;
  }
  const fineValue = Number(calculateTransactionFine(db, transaction) || 0);
  if (!fineValue) return 'Clear';
  if (transaction.fineStatus) return transaction.fineStatus;
  return 'Pending';
}

function getDateRangeBounds(range, from, to) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  if (range === '7d') start.setDate(start.getDate() - 6);
  else if (range === '30d') start.setDate(start.getDate() - 29);
  else if (range === '3m') start.setMonth(start.getMonth() - 3);
  else if (range === '6m') start.setMonth(start.getMonth() - 6);
  else if (range === '1y') {
    start.setMonth(0, 1);
  } else if (range === 'custom') {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      fromDate.setHours(0, 0, 0, 0);
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
    }
    return { start: fromDate, end: toDate };
  }

  return { start, end: today };
}

function isWithinBounds(dateValue, bounds) {
  if (!dateValue) return false;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return false;
  if (bounds.start && parsed < bounds.start) return false;
  if (bounds.end && parsed > bounds.end) return false;
  return true;
}

function buildDashboardInsights(db) {
  const activeTransactions = db.transactions.filter((entry) => !entry.returned && entry.status !== 'Lost');
  const uniqueBorrowers = new Set(activeTransactions.map((entry) => entry.userId)).size;
  const lowStock = db.books.filter((book) => !book.archived && Number(book.availCopies || 0) <= 1).length;
  const suspendedAccounts = db.users.filter((user) => user.status === 'Suspended').length;
  const archivedBooks = db.books.filter((book) => book.archived).length;
  return [
    { id: 'borrowers', label: 'Active Borrowers', value: uniqueBorrowers, tone: 'blue', detail: `${activeTransactions.length} live loan(s)` },
    { id: 'low-stock', label: 'Low Stock Titles', value: lowStock, tone: lowStock ? 'amber' : 'green', detail: lowStock ? 'Needs inventory attention' : 'Inventory levels look healthy' },
    { id: 'suspended', label: 'Suspended Accounts', value: suspendedAccounts, tone: suspendedAccounts ? 'red' : 'green', detail: suspendedAccounts ? 'Review user restrictions' : 'No suspended accounts' },
    { id: 'archived', label: 'Archived Titles', value: archivedBooks, tone: archivedBooks ? 'navy' : 'blue', detail: archivedBooks ? 'Hidden from member portals' : 'No archived catalog records' },
  ];
}

function buildAdminNotifications(db) {
  const overdue = db.transactions.filter((entry) => !entry.returned && entry.status !== 'Lost' && getDayDiff(entry.due) < 0);
  const lowStockBooks = db.books.filter((book) => !book.archived && Number(book.availCopies || 0) <= 1);
  const inactiveUsers = db.users.filter((user) => user.status !== 'Active' && user.role !== 'Administrator');
  const notifications = [];

  if (overdue.length) {
    notifications.push({
      id: 'notif-overdue',
      icon: '\u23F0',
      title: `${overdue.length} overdue loan${overdue.length === 1 ? '' : 's'} need review`,
      message: 'Open transactions to return, renew, mark lost, or waive fines.',
      section: 'transactions',
      tone: 'danger',
    });
  }
  if (lowStockBooks.length) {
    notifications.push({
      id: 'notif-low-stock',
      icon: '\uD83D\uDCDA',
      title: `${lowStockBooks.length} title${lowStockBooks.length === 1 ? '' : 's'} are low on copies`,
      message: 'Review inventory to add copies or archive unavailable records.',
      section: 'inventory',
      tone: 'warning',
    });
  }
  if (inactiveUsers.length) {
    notifications.push({
      id: 'notif-users',
      icon: '\uD83D\uDC65',
      title: `${inactiveUsers.length} member account${inactiveUsers.length === 1 ? '' : 's'} are inactive or suspended`,
      message: 'Review user access and reset credentials where needed.',
      section: 'users',
      tone: 'info',
    });
  }
  const backupDate = parseAuditTimestamp(db.system.lastBackupTime);
  if (!backupDate || ((Date.now() - backupDate.getTime()) / 86400000) >= 1) {
    notifications.push({
      id: 'notif-backup',
      icon: '\uD83D\uDCBE',
      title: 'A fresh backup is recommended',
      message: 'Open system maintenance to create a new restore point.',
      section: 'system',
      tone: 'warning',
    });
  }
  if (!notifications.length) {
    notifications.push({
      id: 'notif-clear',
      icon: '\u2705',
      title: 'Admin workspace looks healthy',
      message: 'No urgent admin actions are pending right now.',
      section: 'dashboard',
      tone: 'success',
    });
  }

  return notifications.slice(0, 6);
}

function buildPendingApprovals(db) {
  return buildAdminNotifications(db).map((item) => ({
    id: item.id,
    icon: item.icon,
    title: item.title,
    subtitle: item.message,
    section: item.section,
    tone: item.tone,
  }));
}

function describeUndoAction(action) {
  if (!action || !action.type) return { available: false, label: 'Nothing to undo', summary: '' };
  const labelMap = {
    'librarian-issue': 'Undo last issue',
    'librarian-return': 'Undo last return',
    'librarian-renew': 'Undo last renewal',
    'librarian-create-book': 'Undo book creation',
    'librarian-update-book': 'Undo book edit',
    'librarian-bulk-update': 'Undo bulk inventory update',
    'librarian-archive-book': 'Undo archive',
    'librarian-restore-book': 'Undo restore',
    'librarian-discard-book': 'Undo discard',
    'librarian-fine-settlement': 'Undo fine update',
    'librarian-reminders': 'Undo reminder batch',
  };
  return {
    available: true,
    type: action.type,
    label: labelMap[action.type] || 'Undo last desk action',
    summary: action.createdAt ? `${labelMap[action.type] || 'Last desk action'} from ${action.createdAt}` : (labelMap[action.type] || 'Undo last desk action'),
  };
}

function buildLibrarianDashboardInsights(db) {
  const activeTransactions = db.transactions
    .map((entry) => enrichTransaction(db, entry))
    .filter((entry) => !entry.returned && entry.status !== 'Lost');
  const categoryCounts = db.books.reduce((acc, book) => {
    if (book.archived) return acc;
    acc[book.category] = (acc[book.category] || 0) + 1;
    return acc;
  }, {});
  const topCategory = Object.entries(categoryCounts).sort((left, right) => right[1] - left[1])[0];
  const remindersToday = (db.system.reminderLog || []).filter((entry) => String(entry.createdAt || '').slice(0, 10) === nowIso().slice(0, 10)).length;
  const lowStockBooks = db.books.filter((book) => !book.archived && Number(book.availCopies || 0) <= 1);
  return {
    lowStockCount: lowStockBooks.length,
    lowStockBooks: lowStockBooks.slice(0, 5).map((book) => ({
      id: book.id,
      title: book.title,
      location: book.location,
      available: Number(book.availCopies || 0),
    })),
    archivedCount: db.books.filter((book) => book.archived).length,
    remindersToday,
    topCategory: topCategory ? { name: topCategory[0], count: topCategory[1] } : null,
    activeBorrowers: new Set(activeTransactions.map((entry) => entry.userId)).size,
    overdueCount: activeTransactions.filter((entry) => entry.dayDiff < 0).length,
  };
}

function buildLibrarianDeskNotifications(db) {
  const activeTransactions = db.transactions
    .map((entry) => enrichTransaction(db, entry))
    .filter((entry) => !entry.returned && entry.status !== 'Lost');
  const overdue = activeTransactions.filter((entry) => entry.dayDiff < 0);
  const lowStock = db.books.filter((book) => !book.archived && Number(book.availCopies || 0) <= 1);
  const pendingFines = db.transactions
    .map((entry) => enrichTransaction(db, entry))
    .filter((entry) => entry.returned && Number(entry.fine || 0) > 0 && !['Paid', 'Waived', 'Clear'].includes(entry.fineStatus));
  const archivedBooks = db.books.filter((book) => book.archived);
  const notifications = [];

  if (overdue.length) {
    notifications.push({
      id: 'desk-overdue',
      icon: '\u23F0',
      tone: 'danger',
      title: `${overdue.length} overdue loan${overdue.length === 1 ? '' : 's'} need action`,
      message: 'Open circulation and return, renew, or settle fines for overdue members.',
      section: 'circulation',
      actionLabel: 'Open Overdue Desk',
      userId: overdue[0].userId,
      transactionId: overdue[0].id,
    });
  }
  if (pendingFines.length) {
    notifications.push({
      id: 'desk-fines',
      icon: '\uD83D\uDCB0',
      tone: 'warning',
      title: `${pendingFines.length} fine record${pendingFines.length === 1 ? '' : 's'} are pending`,
      message: 'Review returned items with unpaid fines and record payment or waiver.',
      section: 'reports',
      actionLabel: 'Open Fine Log',
      transactionId: pendingFines[0].id,
    });
  }
  if (lowStock.length) {
    notifications.push({
      id: 'desk-low-stock',
      icon: '\uD83D\uDCDA',
      tone: 'info',
      title: `${lowStock.length} catalog title${lowStock.length === 1 ? '' : 's'} are low on copies`,
      message: 'Open inventory to add copies, move shelves, or archive old records.',
      section: 'inventory',
      actionLabel: 'Review Inventory',
      bookId: lowStock[0].id,
    });
  }
  if ((db.system.reminderLog || []).length) {
    notifications.push({
      id: 'desk-reminders',
      icon: '\uD83D\uDCE7',
      tone: 'success',
      title: `${db.system.reminderLog.length} reminder notice${db.system.reminderLog.length === 1 ? '' : 's'} in history`,
      message: 'Open reports to review reminder batches and member follow-ups.',
      section: 'reports',
      actionLabel: 'View Reminder Log',
    });
  }
  if (archivedBooks.length) {
    notifications.push({
      id: 'desk-archived',
      icon: '\uD83D\uDCE6',
      tone: 'neutral',
      title: `${archivedBooks.length} archived title${archivedBooks.length === 1 ? '' : 's'} can be restored`,
      message: 'Open inventory to restore books back into the active catalog.',
      section: 'inventory',
      actionLabel: 'Open Archived Titles',
      bookId: archivedBooks[0].id,
    });
  }
  if (!notifications.length) {
    notifications.push({
      id: 'desk-clear',
      icon: '\u2705',
      tone: 'success',
      title: 'Desk is up to date',
      message: 'No urgent librarian tasks are waiting right now.',
      section: 'dashboard',
      actionLabel: 'Stay on Dashboard',
    });
  }

  return notifications.slice(0, 8);
}

function buildLibrarianReportRows(db) {
  const transactionRows = db.transactions
    .map((entry) => enrichTransaction(db, entry))
    .flatMap((entry) => {
      const rows = [{
        id: `tx-${entry.id}`,
        time: entry.checkout || '-',
        user: entry.userName || 'Member',
        userId: entry.userId || '-',
        book: entry.bookTitle || '-',
        type: 'Issued',
        due: entry.due || '-',
        fine: 0,
        lib: entry.processedBy || '-',
        date: entry.checkout || '',
        section: 'circulation',
        transactionId: entry.id,
      }];
      if (Number(entry.renewalCount || 0) > 0) {
        rows.push({
          id: `renew-${entry.id}`,
          time: entry.renewedAt || entry.checkout || '-',
          user: entry.userName || 'Member',
          userId: entry.userId || '-',
          book: entry.bookTitle || '-',
          type: 'Renewed',
          due: entry.due || '-',
          fine: 0,
          lib: entry.renewedBy || entry.processedBy || '-',
          date: entry.renewedAt || entry.checkout || '',
          section: 'circulation',
          transactionId: entry.id,
        });
      }
      if (entry.returned) {
        rows.push({
          id: `return-${entry.id}`,
          time: entry.returned,
          user: entry.userName || 'Member',
          userId: entry.userId || '-',
          book: entry.bookTitle || '-',
          type: entry.status === 'Lost' ? 'Lost' : 'Returned',
          due: entry.due || '-',
          fine: Number(entry.fine || 0),
          lib: entry.processedBy || '-',
          date: entry.returned || '',
          section: 'reports',
          transactionId: entry.id,
        });
      }
      if (entry.finePaidAt && Number(entry.finePaidAmount || 0) > 0) {
        rows.push({
          id: `fine-paid-${entry.id}`,
          time: entry.finePaidAt,
          user: entry.userName || 'Member',
          userId: entry.userId || '-',
          book: entry.bookTitle || '-',
          type: 'Fine Paid',
          due: entry.due || '-',
          fine: Number(entry.finePaidAmount || 0),
          lib: entry.finePaidBy || entry.processedBy || '-',
          date: entry.finePaidAt || '',
          section: 'reports',
          transactionId: entry.id,
        });
      }
      if (entry.fineWaivedAt) {
        rows.push({
          id: `fine-waived-${entry.id}`,
          time: entry.fineWaivedAt,
          user: entry.userName || 'Member',
          userId: entry.userId || '-',
          book: entry.bookTitle || '-',
          type: 'Fine Waived',
          due: entry.due || '-',
          fine: Number(entry.fineWaivedAmount || 0),
          lib: entry.fineWaivedBy || entry.processedBy || '-',
          date: entry.fineWaivedAt || '',
          section: 'reports',
          transactionId: entry.id,
        });
      }
      return rows;
    });

  const reminderRows = (db.system.reminderLog || []).map((entry) => ({
    id: `reminder-${entry.id}`,
    time: entry.createdAt || '-',
    user: entry.userName || 'Member',
    userId: entry.userId || '-',
    book: entry.bookTitle || '-',
    type: 'Reminder',
    due: entry.dayDiff < 0 ? `${Math.abs(entry.dayDiff)} day(s) overdue` : 'Due today',
    fine: 0,
    lib: entry.sentBy || '-',
    date: entry.createdAt || '',
    section: 'reports',
    transactionId: entry.transactionId,
  }));

  const ledgerRows = (db.system.ledgerEntries || []).map((entry) => ({
    id: `ledger-${entry.id}`,
    time: entry.createdAt || '-',
    user: entry.memberName || 'Member',
    userId: entry.memberId || '-',
    book: entry.bookTitle || 'Ledger Entry',
    type: 'Fine Ledger',
    due: '-',
    fine: Number(entry.amount || 0),
    lib: entry.recordedBy || '-',
    date: entry.createdAt || '',
    section: 'reports',
    transactionId: entry.transactionId,
  }));

  const inventoryRows = (db.system.inventoryEvents || []).map((entry) => ({
    id: `inventory-${entry.id}`,
    time: entry.createdAt || '-',
    user: entry.actor || 'Librarian',
    userId: entry.bookId || '-',
    book: entry.bookTitle || 'Inventory Item',
    type: entry.type || 'Inventory',
    due: entry.detail || '-',
    fine: 0,
    lib: entry.actor || '-',
    date: entry.createdAt || '',
    section: 'inventory',
    bookId: entry.bookId,
  }));

  return [...inventoryRows, ...ledgerRows, ...reminderRows, ...transactionRows]
    .sort((left, right) => new Date(right.date || right.time || 0).getTime() - new Date(left.date || left.time || 0).getTime());
}

function buildLibrarianMemberPayload(db, member) {
  const history = db.transactions
    .filter((entry) => entry.userId === member.userId)
    .map((entry) => enrichTransaction(db, entry))
    .sort((left, right) => new Date(right.returned || right.checkout || 0).getTime() - new Date(left.returned || left.checkout || 0).getTime());
  const activeLoans = history.filter((entry) => !entry.returned && entry.status !== 'Lost');
  const allReturned = history.filter((entry) => entry.returned);
  const allFines = history.filter((entry) => Number(entry.fine || 0) > 0 || ['Paid', 'Ledger', 'Waived', 'Partially Paid'].includes(entry.fineStatus));
  const allReminders = (db.system.reminderLog || []).filter((entry) => entry.userId === member.userId);
  const allLedger = (db.system.ledgerEntries || []).filter((entry) => entry.memberId === member.userId);
  const returnedHistory = allReturned.slice(0, 8);
  const fineHistory = allFines.slice(0, 8);
  const reminderHistory = allReminders.slice(0, 8);
  const ledgerHistory = allLedger.slice(0, 8);
  return {
    user: sanitizeUser(member),
    activeLoans,
    returnedHistory,
    fineHistory,
    reminderHistory,
    ledgerHistory,
    stats: {
      activeLoans: activeLoans.length,
      overdueLoans: activeLoans.filter((entry) => entry.isOverdue).length,
      returnedCount: allReturned.length,
      reminderCount: allReminders.length,
      fineOutstanding: allFines.reduce((sum, entry) => sum + (['Paid', 'Waived', 'Clear'].includes(entry.fineStatus) ? 0 : Number(entry.fine || 0)), 0),
    },
  };
}

function getFacultyPreferences(db, facultyUserId) {
  ensureSystemState(db);
  const key = String(facultyUserId || '').trim();
  if (!db.system.facultyPreferences[key] || typeof db.system.facultyPreferences[key] !== 'object') {
    db.system.facultyPreferences[key] = {};
  }
  const prefs = db.system.facultyPreferences[key];
  prefs.readNotificationKeys = Array.isArray(prefs.readNotificationKeys) ? prefs.readNotificationKeys : [];
  prefs.autoRenewTransactionIds = Array.isArray(prefs.autoRenewTransactionIds) ? prefs.autoRenewTransactionIds : [];
  prefs.lastReadAt = String(prefs.lastReadAt || '');
  return prefs;
}

function buildFacultyNotificationKey(item) {
  return String(item?.id || `${item?.icon || ''}|${item?.text || ''}|${item?.ts || ''}`);
}

function getStudentPreferences(db, studentUserId) {
  ensureSystemState(db);
  const key = String(studentUserId || '').trim();
  if (!db.system.studentPreferences[key] || typeof db.system.studentPreferences[key] !== 'object') {
    db.system.studentPreferences[key] = {};
  }
  const prefs = db.system.studentPreferences[key];
  prefs.readNotificationKeys = Array.isArray(prefs.readNotificationKeys) ? prefs.readNotificationKeys : [];
  prefs.lastReadAt = String(prefs.lastReadAt || '');
  return prefs;
}

function buildStudentNotificationKey(item) {
  return String(item?.id || `${item?.icon || ''}|${item?.text || ''}|${item?.ts || ''}`);
}

function buildStudentSearchResults(db, student, options = {}) {
  const query = String(options.query || '').trim().toLowerCase();
  const results = db.books
    .filter((book) => !book.archived)
    .map((book) => ({ ...buildFacultyCatalogRecord(book), status: getBookStatus(book) }))
    .filter((book) => !query || `${book.title} ${book.author} ${book.isbn} ${book.category} ${book.type}`.toLowerCase().includes(query))
    .sort((left, right) => {
      if (Number(right.availCopies || 0) !== Number(left.availCopies || 0)) {
        return Number(right.availCopies || 0) - Number(left.availCopies || 0);
      }
      return String(left.title || '').localeCompare(String(right.title || ''));
    })
    .slice(0, 12);

  return {
    currentUser: sanitizeUser(student),
    query,
    total: results.length,
    results,
  };
}

function inferFacultyBookType(book) {
  const explicitType = String(book.type || '').trim();
  if (explicitType) return explicitType;
  const hint = `${book.category || ''} ${book.title || ''}`.toLowerCase();
  if (hint.includes('journal')) return 'Journal';
  if (hint.includes('reference')) return 'Reference';
  if (hint.includes('thesis')) return 'Thesis';
  return 'Textbook';
}

function buildFacultyCatalogRecord(book) {
  const type = inferFacultyBookType(book);
  return {
    ...book,
    type,
    edition: String(book.edition || '-'),
    doi: String(book.doi || book.isbn || '-'),
    citationCount: Number(book.citationCount || 0),
    status: getBookStatus(book),
  };
}

function buildFacultyReservePayload(db, reserve) {
  const audienceCount = db.users.filter((user) =>
    user.role === 'Student' &&
    user.status === 'Active' &&
    String(user.dept || '').toLowerCase() === String(reserve.dept || '').toLowerCase()
  ).length;
  const items = (reserve.items || [])
    .map((entry) => {
      const book = db.books.find((candidate) => candidate.id === entry.bookId);
      if (!book) return null;
      return {
        ...buildFacultyCatalogRecord(book),
        addedAt: entry.addedAt || '',
      };
    })
    .filter(Boolean);

  return {
    id: reserve.id,
    userId: reserve.userId,
    dept: reserve.dept,
    courseName: reserve.courseName || '',
    semester: reserve.semester || '',
    visibility: reserve.visibility || 'All Students (Public)',
    notes: reserve.notes || '',
    status: reserve.status || 'Draft',
    createdAt: reserve.createdAt || '',
    updatedAt: reserve.updatedAt || reserve.createdAt || '',
    publishedAt: reserve.publishedAt || '',
    studentAudience: audienceCount,
    itemCount: items.length,
    items,
  };
}

function findFacultyReserveDraft(db, faculty, createIfMissing = false) {
  ensureSystemState(db);
  let draft = db.system.facultyReserves.find((entry) =>
    entry &&
    entry.userId === faculty.userId &&
    String(entry.status || '').toLowerCase() === 'draft'
  );
  if (!draft && createIfMissing) {
    draft = {
      id: createId('reserve'),
      userId: faculty.userId,
      dept: faculty.dept,
      courseName: '',
      semester: '',
      visibility: 'All Students (Public)',
      notes: '',
      status: 'Draft',
      items: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.system.facultyReserves.unshift(draft);
  }
  if (draft) {
    draft.items = Array.isArray(draft.items) ? draft.items : [];
  }
  return draft || null;
}

function getDepartmentCode(dept) {
  const words = String(dept || '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (!words.length) return 'GEN';
  const initials = words.map((word) => word[0].toUpperCase()).join('');
  return initials.slice(0, 6) || 'GEN';
}

function buildFacultyClassGroups(faculty) {
  const code = getDepartmentCode(faculty.dept);
  return [
    { id: `${code}-SEM3-A`, label: `${code} Semester 3 - Section A`, size: 62 },
    { id: `${code}-SEM3-B`, label: `${code} Semester 3 - Section B`, size: 58 },
    { id: `${code}-SEM5-LAB`, label: `${code} Semester 5 Lab Batch`, size: 36 },
    { id: `${code}-PROJECT`, label: `${code} Project / Seminar Group`, size: 24 },
  ];
}

function buildFacultyDepartmentRows(db, faculty) {
  const sameDeptUsers = db.users.filter((user) =>
    ['Faculty', 'Student'].includes(user.role) &&
    user.status === 'Active' &&
    String(user.dept || '').toLowerCase() === String(faculty.dept || '').toLowerCase()
  );
  const userMap = new Map(sameDeptUsers.map((user) => [user.userId, user]));
  const prefs = getFacultyPreferences(db, faculty.userId);
  return db.transactions
    .map((entry) => enrichTransaction(db, entry))
    .filter((entry) => !entry.returned && entry.status !== 'Lost' && userMap.has(entry.userId))
    .map((entry) => {
      const holder = userMap.get(entry.userId);
      return {
        transactionId: entry.id,
        bookId: entry.bookId,
        title: entry.bookTitle || '-',
        author: entry.author || '',
        holderName: holder?.user_name || entry.userName || 'Member',
        holderRole: holder?.role || 'Member',
        issued: entry.checkout || '-',
        due: entry.due || '-',
        days: Number(entry.dayDiff || 0),
        status: entry.status || 'Borrowed',
        isOverdue: Boolean(entry.isOverdue),
        autoRenew: Boolean(entry.autoRenew || prefs.autoRenewTransactionIds.includes(entry.id)),
        canToggleAutoRenew: entry.userId === faculty.userId,
      };
    })
    .sort((left, right) => {
      if (left.holderRole !== right.holderRole) {
        return left.holderRole === 'Faculty' ? -1 : 1;
      }
      return new Date(left.due || 0).getTime() - new Date(right.due || 0).getTime();
    });
}

function getFacultySearchTokens(query) {
  const raw = String(query || '').match(/"[^"]+"|\S+/g) || [];

  // Support bare field/value pairs like `doi 10.1000/xyz` by folding them
  // into the field:value syntax used by the search scorer.
  const KNOWN_FIELDS = new Set([
    'title', 'author', 'category', 'type',
    'isbn', 'doi', 'edition', 'location', 'publisher', 'year',
  ]);
  const BOOLEAN_KEYWORDS = new Set(['AND', 'OR', 'NOT']);

  const merged = [];
  let i = 0;
  while (i < raw.length) {
    const token = raw[i];
    if (
      KNOWN_FIELDS.has(token.toLowerCase()) &&
      !token.includes(':') &&
      i + 1 < raw.length &&
      !BOOLEAN_KEYWORDS.has(raw[i + 1].toUpperCase())
    ) {
      merged.push(`${token.toLowerCase()}:${raw[i + 1]}`);
      i += 2;
      continue;
    }

    merged.push(token);
    i += 1;
  }

  return merged;
}

function getFacultySearchFields(book) {
  return {
    all: `${book.title || ''} ${book.author || ''} ${book.category || ''} ${book.type || ''} ${book.isbn || ''} ${book.doi || ''} ${book.edition || ''} ${book.location || ''} ${book.publisher || ''}`.toLowerCase(),
    title: String(book.title || '').toLowerCase(),
    author: String(book.author || '').toLowerCase(),
    category: String(book.category || '').toLowerCase(),
    type: String(book.type || '').toLowerCase(),
    isbn: String(book.isbn || '').toLowerCase(),
    doi: String(book.doi || '').toLowerCase(),
    edition: String(book.edition || '').toLowerCase(),
    location: String(book.location || '').toLowerCase(),
    publisher: String(book.publisher || '').toLowerCase(),
    year: String(book.year || '').toLowerCase(),
  };
}

function scoreFacultySearchTerm(book, token) {
  const cleanedToken = String(token || '').trim();
  if (!cleanedToken) return { matched: true, score: 0 };
  const term = cleanedToken.replace(/^"|"$/g, '').toLowerCase();
  const parts = cleanedToken.split(':');
  const field = parts.length > 1 ? parts.shift().toLowerCase() : 'all';
  const value = parts.length ? parts.join(':').replace(/^"|"$/g, '').toLowerCase() : term;
  const fields = getFacultySearchFields(book);
  const haystack = fields[field] ?? fields.all;
  const matched = haystack.includes(value);
  if (!matched) return { matched: false, score: 0 };

  let score = 10;
  if (fields.title.includes(value)) score += 6;
  if (fields.author.includes(value)) score += 4;
  if (field !== 'all') score += 2;
  if (field === 'doi' || field === 'isbn') score += 3;
  return { matched: true, score };
}

function evaluateFacultyBooleanQuery(book, query) {
  const tokens = getFacultySearchTokens(query);
  if (!tokens.length) return { matched: true, score: 0 };

  const groups = [{ required: [], excluded: [] }];
  let group = groups[0];
  let mode = 'required';

  tokens.forEach((token) => {
    const upper = token.toUpperCase();
    if (upper === 'OR') {
      group = { required: [], excluded: [] };
      groups.push(group);
      mode = 'required';
      return;
    }
    if (upper === 'AND') {
      mode = 'required';
      return;
    }
    if (upper === 'NOT') {
      mode = 'excluded';
      return;
    }
    group[mode].push(token);
    mode = 'required';
  });

  let bestScore = 0;
  const matched = groups.some((entry) => {
    let groupScore = 0;
    const requiredMatched = entry.required.every((token) => {
      const result = scoreFacultySearchTerm(book, token);
      groupScore += result.score;
      return result.matched;
    });
    if (!requiredMatched) return false;
    const hasExcluded = entry.excluded.some((token) => scoreFacultySearchTerm(book, token).matched);
    if (hasExcluded) return false;
    bestScore = Math.max(bestScore, groupScore);
    return true;
  });

  return { matched, score: bestScore };
}

function buildFacultySearchResults(db, faculty, options = {}) {
  const query = String(options.query || '').trim();
  const type = String(options.type || 'all').toLowerCase();
  const availability = String(options.availability || 'all').toLowerCase();
  const sort = String(options.sort || 'Relevance');
  const normalizedSort = sort.toLowerCase();
  let results = db.books
    .filter((book) => !book.archived)
    .map((book) => {
      const record = buildFacultyCatalogRecord(book);
      const search = evaluateFacultyBooleanQuery(record, query);
      return {
        ...record,
        searchScore: search.score,
        matchedSearch: search.matched,
      };
    })
    .filter((book) => book.matchedSearch)
    .filter((book) => type === 'all' || String(book.type || '').toLowerCase() === type)
    .filter((book) => {
      if (availability.includes('available')) return Number(book.availCopies || 0) > 0;
      if (availability.includes('faculty')) return !book.archived;
      return true;
    });

  if (normalizedSort.includes('year') && normalizedSort.includes('new')) {
    results = results.sort((left, right) => Number(right.year || 0) - Number(left.year || 0));
  } else if (normalizedSort.includes('year') && normalizedSort.includes('old')) {
    results = results.sort((left, right) => Number(left.year || 0) - Number(right.year || 0));
  } else if (normalizedSort.includes('title')) {
    results = results.sort((left, right) => String(left.title || '').localeCompare(String(right.title || '')));
  } else if (normalizedSort.includes('citation')) {
    results = results.sort((left, right) => Number(right.citationCount || 0) - Number(left.citationCount || 0));
  } else {
    results = results.sort((left, right) => {
      if (right.searchScore !== left.searchScore) return right.searchScore - left.searchScore;
      if (Number(right.citationCount || 0) !== Number(left.citationCount || 0)) {
        return Number(right.citationCount || 0) - Number(left.citationCount || 0);
      }
      return Number(right.year || 0) - Number(left.year || 0);
    });
  }

  return {
    currentUser: sanitizeUser(faculty),
    query,
    total: results.length,
    type,
    availability,
    sort,
    results,
  };
}

function buildFacultyWorkspaceOverview(db, faculty) {
  ensureSystemState(db);
  const reserveDraft = findFacultyReserveDraft(db, faculty, false);
  const reserveLists = db.system.facultyReserves
    .filter((entry) => entry.userId === faculty.userId && String(entry.status || '').toLowerCase() !== 'draft')
    .map((entry) => buildFacultyReservePayload(db, entry))
    .sort((left, right) => new Date(right.publishedAt || right.updatedAt || 0).getTime() - new Date(left.publishedAt || left.updatedAt || 0).getTime());
  const procurementRequests = db.system.facultyProcurementRequests
    .filter((entry) => entry.userId === faculty.userId)
    .slice()
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  const bulkRequests = db.system.facultyBulkRequests
    .filter((entry) => entry.userId === faculty.userId)
    .slice()
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  const departmentRows = buildFacultyDepartmentRows(db, faculty);
  return {
    currentUser: sanitizeUser(faculty),
    reserveDraft: reserveDraft ? buildFacultyReservePayload(db, reserveDraft) : null,
    reserveLists,
    procurementRequests,
    bulkRequests,
    departmentRows,
    classGroups: buildFacultyClassGroups(faculty),
    stats: {
      reserveDraftBooks: reserveDraft ? (reserveDraft.items || []).length : 0,
      publishedReserveLists: reserveLists.length,
      procurementRequests: procurementRequests.length,
      bulkRequests: bulkRequests.length,
      departmentLoans: departmentRows.length,
      studentLoans: departmentRows.filter((entry) => entry.holderRole === 'Student').length,
    },
  };
}

function buildAdminSearchResults(db, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (needle.length < 2) {
    return { query: needle, total: 0, users: [], books: [], transactions: [] };
  }
  const users = db.users
    .filter((user) => `${user.user_name} ${user.userId} ${user.email} ${user.role}`.toLowerCase().includes(needle))
    .slice(0, 5)
    .map((user) => ({
      id: user.id,
      section: 'users',
      kind: 'user',
      title: user.user_name,
      subtitle: `${user.userId} • ${user.role} • ${user.status}`,
    }));
  const books = db.books
    .filter((book) => `${book.title} ${book.author} ${book.isbn} ${book.category}`.toLowerCase().includes(needle))
    .slice(0, 5)
    .map((book) => ({
      id: book.id,
      section: 'inventory',
      kind: 'book',
      title: book.title,
      subtitle: `${book.isbn} • ${book.category} • ${getBookStatus(book)}`,
    }));
  const transactions = db.transactions
    .map((entry) => enrichTransaction(db, entry))
    .filter((entry) => `${entry.id} ${entry.userName} ${entry.bookTitle} ${entry.userId}`.toLowerCase().includes(needle))
    .slice(0, 5)
    .map((entry) => ({
      id: entry.id,
      section: 'transactions',
      kind: 'transaction',
      title: `${entry.bookTitle} • ${entry.userName}`,
      subtitle: `${entry.status} • Due ${entry.due || '-'} • ${entry.id}`,
    }));
  return {
    query: needle,
    total: users.length + books.length + transactions.length,
    users,
    books,
    transactions,
  };
}

function buildIssueTransaction(db, actorName, member, book, dueDate) {
  const checkout = nowIso().slice(0, 10);
  let normalizedDue = formatDateInput(dueDate || '');
  if (!normalizedDue) {
    const computedDue = new Date();
    computedDue.setDate(computedDue.getDate() + Number(db.system.loanPeriodDays || 14));
    normalizedDue = computedDue.toISOString().slice(0, 10);
  }
  if (new Date(normalizedDue).getTime() < new Date(checkout).getTime()) {
    throw new Error('Due date must be today or later.');
  }
  return {
    id: createId('tx'),
    userId: member.userId,
    userName: member.user_name,
    bookId: book.id,
    bookTitle: book.title,
    isbn: book.isbn,
    checkout,
    due: normalizedDue,
    returned: '',
    status: 'Borrowed',
    fine: 0,
    fineOverride: null,
    fineStatus: 'Pending',
    processedBy: actorName,
    renewalCount: 0,
  };
}

function validateIssueRequest(db, member, book) {
  if (!member) throw new Error('Borrower was not found.');
  if (member.role === 'Administrator') throw new Error('Administrator accounts cannot receive issued books.');
  if (member.status !== 'Active') throw new Error('This borrower account is not active.');
  if (!book) throw new Error('Book was not found.');
  if (book.archived) throw new Error('Archived books cannot be issued.');
  if (Number(book.availCopies || 0) < 1) throw new Error('No available copies remain for this book.');
  const activeLoans = db.transactions.filter((entry) => entry.userId === member.userId && !entry.returned && entry.status !== 'Lost');
  const maxBooks = Number(db.system.maxBooksPerStudent || 3);
  if (activeLoans.length >= maxBooks) {
    throw new Error(`${member.user_name} already has the maximum of ${maxBooks} active book(s).`);
  }
}

function buildReportPayload(db, type, options = {}) {
  const range = String(options.range || '7d');
  const bounds = getDateRangeBounds(range, options.from, options.to);
  const inRangeUsers = db.users.filter((user) => isWithinBounds(user.joined, bounds));
  const inRangeTransactions = db.transactions
    .map((entry) => enrichTransaction(db, entry))
    .filter((entry) => isWithinBounds(entry.checkout || entry.returned, bounds));
  const activeBooks = db.books.filter((book) => !book.archived);

  const usersByRole = inRangeUsers.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});
  const booksByCategory = activeBooks.reduce((acc, book) => {
    acc[book.category] = (acc[book.category] || 0) + Number(book.totalCopies || 0);
    return acc;
  }, {});
  const topBooks = Object.entries(
    inRangeTransactions.reduce((acc, entry) => {
      const key = entry.bookTitle || 'Unknown Book';
      acc[key] = acc[key] || { count: 0, member: entry.userName || '-', overdue: 0 };
      acc[key].count += 1;
      if (entry.status === 'Overdue') acc[key].overdue += 1;
      acc[key].member = entry.userName || acc[key].member;
      return acc;
    }, {})
  ).sort((left, right) => right[1].count - left[1].count).slice(0, 8);
  const fineTotal = inRangeTransactions.reduce((sum, entry) => sum + Number(entry.fine || 0), 0);
  const fineOutstanding = inRangeTransactions.filter((entry) => Number(entry.fine || 0) > 0).length;

  const reportMap = {
    'user-growth': {
      title: 'User Distribution',
      headers: ['Role', 'Members'],
      rows: Object.entries(usersByRole).length ? Object.entries(usersByRole) : [['No matching users', 0]],
      labels: Object.keys(usersByRole).length ? Object.keys(usersByRole) : ['No matching users'],
      values: Object.values(usersByRole).length ? Object.values(usersByRole) : [0],
      pieLabels: Object.keys(usersByRole).length ? Object.keys(usersByRole) : ['No matching users'],
      pieValues: Object.values(usersByRole).length ? Object.values(usersByRole) : [0],
    },
    'most-borrowed': {
      title: 'Most Borrowed Books',
      headers: ['Book', 'Borrows', 'Recent Borrower', 'Overdue Cases'],
      rows: topBooks.length ? topBooks.map(([title, data]) => [title, data.count, data.member, data.overdue]) : [['No matching loans', 0, '-', 0]],
      labels: topBooks.length ? topBooks.map(([title]) => title) : ['No matching loans'],
      values: topBooks.length ? topBooks.map(([, data]) => data.count) : [0],
      pieLabels: topBooks.length ? topBooks.map(([title]) => title) : ['No matching loans'],
      pieValues: topBooks.length ? topBooks.map(([, data]) => data.count) : [0],
    },
    'inventory-value': {
      title: 'Inventory by Category',
      headers: ['Category', 'Copies', 'Titles'],
      rows: Object.keys(booksByCategory).length
        ? Object.keys(booksByCategory).map((category) => [category, booksByCategory[category], activeBooks.filter((book) => book.category === category).length])
        : [['No catalog books', 0, 0]],
      labels: Object.keys(booksByCategory).length ? Object.keys(booksByCategory) : ['No catalog books'],
      values: Object.keys(booksByCategory).length ? Object.values(booksByCategory) : [0],
      pieLabels: Object.keys(booksByCategory).length ? Object.keys(booksByCategory) : ['No catalog books'],
      pieValues: Object.keys(booksByCategory).length ? Object.values(booksByCategory) : [0],
    },
    fines: {
      title: 'Fine Summary',
      headers: ['Metric', 'Value'],
      rows: [
        ['Total Fine Value', `\u20B9${fineTotal}`],
        ['Items With Fines', fineOutstanding],
        ['Average Fine', `\u20B9${fineOutstanding ? (fineTotal / fineOutstanding).toFixed(2) : '0.00'}`],
      ],
      labels: ['Total Fines', 'Items With Fines'],
      values: [fineTotal, fineOutstanding],
      pieLabels: ['Total Fines', 'Items With Fines'],
      pieValues: [fineTotal, fineOutstanding],
    },
  };
  const payload = reportMap[type] || reportMap['user-growth'];
  return {
    type,
    range,
    title: payload.title,
    headers: payload.headers,
    rows: payload.rows,
    labels: payload.labels,
    values: payload.values,
    pieLabels: payload.pieLabels,
    pieValues: payload.pieValues,
    generatedAt: nowIso(),
  };
}

function processReturnTransactions(db, actor, transactionIds) {
  const processed = [];
  for (const transactionId of transactionIds) {
    const transaction = db.transactions.find((entry) => entry.id === transactionId);
    if (!transaction || transaction.returned || transaction.status === 'Lost') continue;
    transaction.returned = nowIso().slice(0, 10);
    transaction.status = 'Returned';
    transaction.processedBy = actor;
    transaction.fine = calculateTransactionFine(db, transaction);
    const book = db.books.find((entry) => entry.id === transaction.bookId);
    if (book) {
      book.availCopies = Math.min(Number(book.totalCopies || 0), Number(book.availCopies || 0) + 1);
      book.status = getBookStatus(book);
    }
    const enriched = enrichTransaction(db, transaction);
    processed.push(enriched);
  }
  return processed;
}

function computePortalData(db, user) {
  const activeLoans = db.transactions
    .filter((item) => item.userId === user.userId && !item.returned)
    .map((item) => enrichTransaction(db, item));

  const availableBooks = db.books.map((book) => ({
    ...book,
    status: getBookStatus(book),
  })).filter((book) => !book.archived);

  const dueSoon = activeLoans.filter((loan) => loan.dayDiff >= 0 && loan.dayDiff <= 3);
  const overdueLoans = activeLoans.filter((loan) => loan.dayDiff < 0);

  const notifications = [
    {
      icon: '👋',
      text: `Welcome ${user.user_name}. Your account is active.`,
      ts: 'Now',
      unread: true,
      important: false,
      persistent: false,
    },
    ...overdueLoans.map((loan) => ({
      icon: '🚨',
      text: `"${loan.bookTitle}" is overdue by ${Math.abs(loan.dayDiff)} day${Math.abs(loan.dayDiff) === 1 ? '' : 's'}. Return it to the librarian.`,
      ts: `Overdue ${Math.abs(loan.dayDiff)} day${Math.abs(loan.dayDiff) === 1 ? '' : 's'}`,
      unread: true,
      important: true,
      persistent: true,
      dueDate: loan.due,
      dayDiff: loan.dayDiff,
    })),
    ...dueSoon.map((loan) => ({
      icon: '⚠️',
      text: `"${loan.bookTitle}" is due in ${loan.dayDiff} day${loan.dayDiff === 1 ? '' : 's'} on ${loan.due}.`,
      ts: loan.dayDiff === 0 ? 'Due today' : `${loan.dayDiff} day${loan.dayDiff === 1 ? '' : 's'} left`,
      unread: true,
      important: true,
      persistent: true,
      dueDate: loan.due,
      dayDiff: loan.dayDiff,
    })),
  ];

  if (!availableBooks.length) {
    notifications.push({
      icon: '📚',
      text: 'No books are in the catalog yet. Add books from the admin panel.',
      ts: 'Catalog',
      unread: false,
      important: false,
      persistent: false,
    });
  }

  const recommendations = availableBooks
    .filter((book) => !activeLoans.some((loan) => loan.bookId === book.id))
    .slice(0, 4);

  return {
    user: sanitizeUser(user),
    books: availableBooks,
    currentBooks: activeLoans,
    transactions: db.transactions.filter((item) => item.userId === user.userId),
    notifications,
    recommendations,
    stats: {
      booksIssued: activeLoans.length,
      dueSoon: dueSoon.length + overdueLoans.length,
      pendingFines: activeLoans.reduce((sum, loan) => sum + Number(loan.fine || 0), 0),
      totalBooks: availableBooks.length,
    },
  };
}

function computeLivePortalData(db, user) {
  const activeLoans = db.transactions
    .filter((item) => item.userId === user.userId && !item.returned)
    .map((item) => enrichTransaction(db, item));

  const availableBooks = db.books
    .map((book) => ({
      ...buildFacultyCatalogRecord(book),
      status: getBookStatus(book),
    }))
    .filter((book) => !book.archived);

  const dueSoon = activeLoans.filter((loan) => loan.dayDiff >= 0 && loan.dayDiff <= 3);
  const overdueLoans = activeLoans.filter((loan) => loan.dayDiff < 0);

  const notifications = [
    {
      id: `portal-welcome-${user.userId}`,
      icon: '\u{1F44B}',
      text: `Welcome ${user.user_name}. Your account is active.`,
      ts: 'Now',
      unread: true,
      important: false,
      persistent: false,
    },
    ...overdueLoans.map((loan) => ({
      id: `portal-overdue-${loan.id}`,
      icon: '\u{1F6A8}',
      text: `"${loan.bookTitle}" is overdue by ${Math.abs(loan.dayDiff)} day${Math.abs(loan.dayDiff) === 1 ? '' : 's'}. Return it to the librarian.`,
      ts: `Overdue ${Math.abs(loan.dayDiff)} day${Math.abs(loan.dayDiff) === 1 ? '' : 's'}`,
      unread: true,
      important: true,
      persistent: true,
      dueDate: loan.due,
      dayDiff: loan.dayDiff,
    })),
    ...dueSoon.map((loan) => ({
      id: `portal-due-${loan.id}`,
      icon: '\u26A0\uFE0F',
      text: `"${loan.bookTitle}" is due in ${loan.dayDiff} day${loan.dayDiff === 1 ? '' : 's'} on ${loan.due}.`,
      ts: loan.dayDiff === 0 ? 'Due today' : `${loan.dayDiff} day${loan.dayDiff === 1 ? '' : 's'} left`,
      unread: true,
      important: true,
      persistent: true,
      dueDate: loan.due,
      dayDiff: loan.dayDiff,
    })),
  ];

  if (!availableBooks.length) {
    notifications.push({
      id: 'portal-empty-catalog',
      icon: '\u{1F4DA}',
      text: 'No books are in the catalog yet. Add books from the admin panel.',
      ts: 'Catalog',
      unread: false,
      important: false,
      persistent: false,
    });
  }

  if (user.role === 'Faculty') {
    const reserveDraft = findFacultyReserveDraft(db, user, false);
    const publishedReserves = db.system.facultyReserves.filter((entry) =>
      entry.userId === user.userId && String(entry.status || '').toLowerCase() !== 'draft'
    );
    const procurementRequests = db.system.facultyProcurementRequests.filter((entry) => entry.userId === user.userId);
    const bulkRequests = db.system.facultyBulkRequests.filter((entry) => entry.userId === user.userId);

    if (reserveDraft && (reserveDraft.items || []).length) {
      notifications.push({
        id: `faculty-draft-${reserveDraft.id}`,
        icon: '\u{1F4DA}',
        text: `Your reserve draft has ${(reserveDraft.items || []).length} book${(reserveDraft.items || []).length === 1 ? '' : 's'} ready to publish.`,
        ts: 'Draft saved',
        unread: true,
        important: false,
        persistent: false,
      });
    }

    const latestReserve = publishedReserves
      .slice()
      .sort((left, right) => new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime())[0];
    if (latestReserve) {
      notifications.push({
        id: `faculty-reserve-${latestReserve.id}`,
        icon: '\u{1F4E2}',
        text: `Reserve list "${latestReserve.courseName || 'Untitled Course'}" is published for ${latestReserve.semester || 'the current term'}.`,
        ts: latestReserve.publishedAt ? `Published ${formatDateInput(latestReserve.publishedAt)}` : 'Published',
        unread: true,
        important: false,
        persistent: false,
      });
    }

    const latestProcurement = procurementRequests
      .slice()
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0];
    if (latestProcurement) {
      notifications.push({
        id: `faculty-procurement-${latestProcurement.id}`,
        icon: '\u{1F6D2}',
        text: `Procurement request "${latestProcurement.title}" is ${latestProcurement.status || 'under review'}.`,
        ts: latestProcurement.createdAt ? `Requested ${formatDateInput(latestProcurement.createdAt)}` : 'Procurement',
        unread: true,
        important: false,
        persistent: false,
      });
    }

    const latestBulk = bulkRequests
      .slice()
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0];
    if (latestBulk) {
      notifications.push({
        id: `faculty-bulk-${latestBulk.id}`,
        icon: '\u{1F4E6}',
        text: `Bulk request for "${latestBulk.bookTitle}" is ${latestBulk.status || 'pending librarian review'}.`,
        ts: latestBulk.createdAt ? `Requested ${formatDateInput(latestBulk.createdAt)}` : 'Bulk request',
        unread: true,
        important: false,
        persistent: false,
      });
    }

    const prefs = getFacultyPreferences(db, user.userId);
    notifications.forEach((item) => {
      if (prefs.readNotificationKeys.includes(buildFacultyNotificationKey(item))) {
        item.unread = false;
      }
    });
  }

  let studentReservations = [];
  let studentRenewalRequests = [];
  let studentPaymentRequests = [];

  if (user.role === 'Student') {
    studentReservations = db.system.studentReservations
      .filter((entry) => entry.userId === user.userId)
      .slice()
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
    studentRenewalRequests = db.system.studentRenewalRequests
      .filter((entry) => entry.userId === user.userId)
      .slice()
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
    studentPaymentRequests = db.system.studentPaymentRequests
      .filter((entry) => entry.userId === user.userId)
      .slice()
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());

    const latestReservation = studentReservations[0];
    if (latestReservation) {
      notifications.push({
        id: `student-reservation-${latestReservation.id}`,
        icon: latestReservation.type === 'Waitlist' ? '\u23F3' : '\u{1F4E5}',
        text: latestReservation.type === 'Waitlist'
          ? `"${latestReservation.bookTitle}" waitlist request is active at position ${latestReservation.queuePosition || 1}.`
          : `"${latestReservation.bookTitle}" pickup request is saved. Visit the library desk with your ID.`,
        ts: latestReservation.createdAt ? `Requested ${formatDateInput(latestReservation.createdAt)}` : 'Reservation',
        unread: true,
        important: latestReservation.type !== 'Waitlist',
        persistent: false,
      });
    }

    const latestRenewal = studentRenewalRequests[0];
    if (latestRenewal) {
      notifications.push({
        id: `student-renewal-${latestRenewal.id}`,
        icon: '\u{1F504}',
        text: `Renewal request for "${latestRenewal.bookTitle}" is ${latestRenewal.status || 'pending librarian approval'}.`,
        ts: latestRenewal.createdAt ? `Requested ${formatDateInput(latestRenewal.createdAt)}` : 'Renewal',
        unread: true,
        important: false,
        persistent: false,
      });
    }

    const latestPayment = studentPaymentRequests[0];
    if (latestPayment) {
      notifications.push({
        id: `student-payment-${latestPayment.id}`,
        icon: '\u{1F4B3}',
        text: `Fine payment request for "${latestPayment.bookTitle}" is ${latestPayment.status || 'submitted for verification'}.`,
        ts: latestPayment.createdAt ? `Submitted ${formatDateInput(latestPayment.createdAt)}` : 'Fine payment',
        unread: true,
        important: false,
        persistent: false,
      });
    }

    const prefs = getStudentPreferences(db, user.userId);
    notifications.forEach((item) => {
      if (prefs.readNotificationKeys.includes(buildStudentNotificationKey(item))) {
        item.unread = false;
      }
    });
  }

  const recommendations = availableBooks
    .filter((book) => !activeLoans.some((loan) => loan.bookId === book.id))
    .slice(0, 4);
  const userTransactions = db.transactions
    .filter((item) => item.userId === user.userId)
    .map((item) => enrichTransaction(db, item));
  const pendingFineTotal = userTransactions.reduce((sum, item) => {
    if (['Paid', 'Waived', 'Clear'].includes(String(item.fineStatus || ''))) return sum;
    return sum + Number(item.fine || 0);
  }, 0);

  return {
    user: sanitizeUser(user),
    books: availableBooks,
    currentBooks: activeLoans,
    transactions: userTransactions,
    notifications,
    reservations: studentReservations,
    renewalRequests: studentRenewalRequests,
    paymentRequests: studentPaymentRequests,
    recommendations,
    stats: {
      booksIssued: activeLoans.length,
      dueSoon: dueSoon.length + overdueLoans.length,
      pendingFines: pendingFineTotal,
      totalBooks: availableBooks.length,
    },
  };
}

function serveFile(reqPath, res) {
  const safePath = path.normalize(reqPath === '/' ? '/index.html' : reqPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  const db = readDb();

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const identifier = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = normalizeRole(body.role);

    const user = db.users.find((entry) =>
      entry.email.toLowerCase() === identifier || entry.userId.toLowerCase() === identifier
    );

    if (!user || user.password !== password || user.role !== role) {
      sendJson(res, 401, { error: 'Invalid email or ID, password, or role.' });
      return;
    }

    if (user.status !== 'Active') {
      sendJson(res, 403, { error: 'This account is not active.' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    db.sessions = db.sessions.filter((entry) => entry.userId !== user.id);
    db.sessions.push({ token, userId: user.id, createdAt: nowIso() });
    addAudit(db, 'POST', user.user_name, 'User logged in', 200);
    writeDb(db);

    sendJson(res, 200, {
      token,
      user: sanitizeUser(user),
      redirect: `${user.role.toLowerCase() === 'administrator' ? 'admin' : user.role.toLowerCase()}.html`.replace('administrator', 'admin'),
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = getToken(req);
    if (token) {
      db.sessions = db.sessions.filter((entry) => entry.token !== token);
      writeDb(db);
    }
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const user = requireAuth(db, req, res);
    if (!user) return;
    sendJson(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/profile') {
    const user = requireAuth(db, req, res);
    if (!user) return;
    sendJson(res, 200, { user: sanitizeUser(normalizeUserRecord(db, user)) });
    return;
  }

  if (req.method === 'PATCH' && url.pathname === '/api/profile') {
    const user = requireAuth(db, req, res);
    if (!user) return;
    const body = await parseBody(req);
    user.profile = {
      ...getDefaultProfile(),
      ...(user.profile || {}),
      linkedin: String(body.linkedin ?? user.profile?.linkedin ?? '').trim(),
      portfolio: String(body.portfolio ?? user.profile?.portfolio ?? '').trim(),
      goalText: String(body.goalText ?? user.profile?.goalText ?? '').trim(),
      motivationalWords: String(body.motivationalWords ?? user.profile?.motivationalWords ?? '').trim(),
    };
    addAudit(db, 'PATCH', user.user_name, `Updated profile details for "${user.user_name}"`, 200);
    writeDb(db);
    sendJson(res, 200, { user: sanitizeUser(normalizeUserRecord(db, user)) });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/portal-data') {
    const user = requireAuth(db, req, res);
    if (!user) return;
    sendJson(res, 200, computeLivePortalData(db, user));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/books') {
    const user = requireAuth(db, req, res);
    if (!user) return;
    sendJson(res, 200, {
      books: db.books
        .filter((book) => user.role === 'Administrator' || user.role === 'Librarian' || !book.archived)
        .map((book) => ({ ...book, status: getBookStatus(book) })),
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/student/search') {
    const student = requireStudent(db, req, res);
    if (!student) return;
    sendJson(res, 200, buildStudentSearchResults(db, student, {
      query: url.searchParams.get('q'),
    }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/student/reservations') {
    const student = requireStudent(db, req, res);
    if (!student) return;
    const body = await parseBody(req);
    const bookId = String(body.bookId || '').trim();
    const book = db.books.find((entry) => entry.id === bookId && !entry.archived);
    if (!book) {
      sendJson(res, 404, { error: 'Selected catalog book was not found.' });
      return;
    }
    const existing = db.system.studentReservations.find((entry) =>
      entry.userId === student.userId &&
      entry.bookId === book.id &&
      ['Pending Pickup', 'Waitlisted'].includes(String(entry.status || ''))
    );
    if (existing) {
      sendJson(res, 409, { error: 'You already have an active request for this book.' });
      return;
    }
    const waitlistAhead = db.system.studentReservations.filter((entry) =>
      entry.bookId === book.id &&
      entry.type === 'Waitlist' &&
      entry.status === 'Waitlisted'
    ).length;
    const request = {
      id: createId('reserve'),
      userId: student.userId,
      userName: student.user_name,
      bookId: book.id,
      bookTitle: book.title,
      type: Number(book.availCopies || 0) > 0 ? 'Pickup' : 'Waitlist',
      status: Number(book.availCopies || 0) > 0 ? 'Pending Pickup' : 'Waitlisted',
      queuePosition: Number(book.availCopies || 0) > 0 ? 0 : waitlistAhead + 1,
      createdAt: nowIso(),
    };
    db.system.studentReservations.unshift(request);
    addAudit(db, 'POST', student.user_name, `${request.type === 'Pickup' ? 'Requested pickup for' : 'Joined waitlist for'} "${book.title}"`, 201);
    writeDb(db);
    sendJson(res, 201, { request, portal: computeLivePortalData(db, student) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/student/transactions/renew') {
    const student = requireStudent(db, req, res);
    if (!student) return;
    const body = await parseBody(req);
    const transactionId = String(body.transactionId || '').trim();
    const transaction = db.transactions.find((entry) => entry.id === transactionId && entry.userId === student.userId);
    if (!transaction || transaction.returned || transaction.status === 'Lost') {
      sendJson(res, 404, { error: 'Active student loan was not found.' });
      return;
    }
    if (getDayDiff(transaction.due) < 0) {
      sendJson(res, 409, { error: 'Overdue books must be returned before requesting renewal.' });
      return;
    }
    const renewalLimit = Number(db.system.renewalLimit || 0);
    if (Number(transaction.renewalCount || 0) >= renewalLimit) {
      sendJson(res, 409, { error: `This loan already reached the renewal limit of ${renewalLimit}.` });
      return;
    }
    const existing = db.system.studentRenewalRequests.find((entry) =>
      entry.userId === student.userId &&
      entry.transactionId === transaction.id &&
      entry.status === 'Pending Librarian Approval'
    );
    if (existing) {
      sendJson(res, 409, { error: 'A renewal request is already pending for this book.' });
      return;
    }
    const dueDate = new Date(transaction.due);
    dueDate.setDate(dueDate.getDate() + Number(db.system.loanPeriodDays || 14));
    const request = {
      id: createId('renew'),
      userId: student.userId,
      userName: student.user_name,
      transactionId: transaction.id,
      bookId: transaction.bookId,
      bookTitle: transaction.bookTitle || '',
      currentDue: transaction.due,
      requestedDue: dueDate.toISOString().slice(0, 10),
      status: 'Pending Librarian Approval',
      createdAt: nowIso(),
    };
    db.system.studentRenewalRequests.unshift(request);
    addAudit(db, 'POST', student.user_name, `Requested renewal for "${request.bookTitle}"`, 201);
    writeDb(db);
    sendJson(res, 201, { request, portal: computeLivePortalData(db, student) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/student/fine-payments') {
    const student = requireStudent(db, req, res);
    if (!student) return;
    const body = await parseBody(req);
    const transactionId = String(body.transactionId || '').trim();
    const paymentMethod = String(body.paymentMethod || '').trim();
    const reference = String(body.reference || '').trim();
    const transaction = db.transactions.find((entry) => entry.id === transactionId && entry.userId === student.userId);
    if (!transaction) {
      sendJson(res, 404, { error: 'Fine record was not found.' });
      return;
    }
    const enriched = enrichTransaction(db, transaction);
    const amount = Number(enriched.fine || 0);
    if (!amount || ['Paid', 'Waived', 'Clear'].includes(String(enriched.fineStatus || ''))) {
      sendJson(res, 409, { error: 'There is no outstanding fine on this transaction.' });
      return;
    }
    if (!paymentMethod) {
      sendJson(res, 400, { error: 'Please choose a payment method.' });
      return;
    }
    const existing = db.system.studentPaymentRequests.find((entry) =>
      entry.userId === student.userId &&
      entry.transactionId === transaction.id &&
      entry.status === 'Submitted for Verification'
    );
    if (existing) {
      sendJson(res, 409, { error: 'A payment request is already pending for this fine.' });
      return;
    }
    const request = {
      id: createId('pay'),
      userId: student.userId,
      userName: student.user_name,
      transactionId: transaction.id,
      bookId: transaction.bookId,
      bookTitle: transaction.bookTitle || '',
      amount,
      paymentMethod,
      reference,
      status: 'Submitted for Verification',
      createdAt: nowIso(),
    };
    db.system.studentPaymentRequests.unshift(request);
    addAudit(db, 'POST', student.user_name, `Submitted fine payment request for "${request.bookTitle}"`, 201);
    writeDb(db);
    sendJson(res, 201, { request, portal: computeLivePortalData(db, student) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/student/notifications/mark-read') {
    const student = requireStudent(db, req, res);
    if (!student) return;
    const currentNotifications = computeLivePortalData(db, student).notifications || [];
    const prefs = getStudentPreferences(db, student.userId);
    prefs.readNotificationKeys = currentNotifications.map((entry) => buildStudentNotificationKey(entry));
    prefs.lastReadAt = nowIso();
    writeDb(db);
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/faculty/overview') {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    sendJson(res, 200, buildFacultyWorkspaceOverview(db, faculty));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/faculty/search') {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    sendJson(res, 200, buildFacultySearchResults(db, faculty, {
      query: url.searchParams.get('q'),
      type: url.searchParams.get('type'),
      availability: url.searchParams.get('availability'),
      sort: url.searchParams.get('sort'),
    }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/faculty/reserves/draft-items') {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    const body = await parseBody(req);
    const bookId = String(body.bookId || '').trim();
    const book = db.books.find((entry) => entry.id === bookId);
    if (!book || book.archived) {
      sendJson(res, 404, { error: 'Selected catalog book was not found.' });
      return;
    }
    const draft = findFacultyReserveDraft(db, faculty, true);
    if ((draft.items || []).some((entry) => entry.bookId === book.id)) {
      sendJson(res, 409, { error: 'This book is already in your reserve draft.' });
      return;
    }
    draft.items.unshift({ bookId: book.id, addedAt: nowIso() });
    draft.updatedAt = nowIso();
    addAudit(db, 'POST', faculty.user_name, `Added "${book.title}" to faculty reserve draft`, 200);
    writeDb(db);
    sendJson(res, 200, buildFacultyWorkspaceOverview(db, faculty));
    return;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/faculty/reserves/draft-items/')) {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    const bookId = decodeURIComponent(url.pathname.split('/').pop());
    const draft = findFacultyReserveDraft(db, faculty, false);
    if (!draft) {
      sendJson(res, 404, { error: 'No active reserve draft was found.' });
      return;
    }
    draft.items = (draft.items || []).filter((entry) => entry.bookId !== bookId);
    draft.updatedAt = nowIso();
    addAudit(db, 'DELETE', faculty.user_name, `Removed a book from faculty reserve draft "${draft.id}"`, 200);
    writeDb(db);
    sendJson(res, 200, buildFacultyWorkspaceOverview(db, faculty));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/faculty/reserves/draft-meta') {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    const body = await parseBody(req);
    const draft = findFacultyReserveDraft(db, faculty, true);
    draft.courseName = String(body.courseName || '').trim();
    draft.updatedAt = nowIso();
    writeDb(db);
    sendJson(res, 200, buildFacultyWorkspaceOverview(db, faculty));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/faculty/reserves/clear-draft') {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    db.system.facultyReserves = db.system.facultyReserves.filter((entry) =>
      !(entry.userId === faculty.userId && String(entry.status || '').toLowerCase() === 'draft')
    );
    addAudit(db, 'POST', faculty.user_name, 'Cleared faculty reserve draft', 200);
    writeDb(db);
    sendJson(res, 200, buildFacultyWorkspaceOverview(db, faculty));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/faculty/reserves/publish') {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    const body = await parseBody(req);
    const draft = findFacultyReserveDraft(db, faculty, false);
    if (!draft || !(draft.items || []).length) {
      sendJson(res, 400, { error: 'Add at least one book before publishing a reserve list.' });
      return;
    }
    const courseName = String(body.courseName || draft.courseName || '').trim();
    if (!courseName) {
      sendJson(res, 400, { error: 'Please provide a course name before publishing.' });
      return;
    }
    draft.courseName = courseName;
    draft.semester = String(body.semester || '').trim() || 'Current Session';
    draft.visibility = String(body.visibility || '').trim() || 'All Students (Public)';
    draft.notes = String(body.notes || '').trim();
    draft.status = 'Published';
    draft.publishedAt = nowIso();
    draft.updatedAt = nowIso();
    addAudit(db, 'POST', faculty.user_name, `Published faculty reserve list "${draft.courseName}"`, 200);
    writeDb(db);
    sendJson(res, 200, buildFacultyWorkspaceOverview(db, faculty));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/faculty/procurements') {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    const body = await parseBody(req);
    const title = String(body.title || '').trim();
    const author = String(body.author || '').trim();
    const reason = String(body.reason || '').trim();
    const copies = Math.max(1, Number(body.copies || 1));
    if (!title || !author || !reason) {
      sendJson(res, 400, { error: 'Title, author, and request reason are required.' });
      return;
    }
    const activeRequests = db.system.facultyProcurementRequests.filter((entry) =>
      entry.userId === faculty.userId &&
      !['Approved', 'Rejected', 'Closed'].includes(String(entry.status || ''))
    );
    if (activeRequests.length >= 5) {
      sendJson(res, 409, { error: 'You already have 5 open procurement requests this semester.' });
      return;
    }
    db.system.facultyProcurementRequests.unshift({
      id: createId('proc'),
      userId: faculty.userId,
      userName: faculty.user_name,
      dept: String(body.dept || faculty.dept || '').trim(),
      title,
      author,
      isbn: String(body.isbn || '').trim(),
      publisher: String(body.publisher || '').trim(),
      year: String(body.year || '').trim(),
      edition: String(body.edition || '').trim(),
      copies,
      reason,
      impact: String(body.impact || 'Low').trim() || 'Low',
      status: 'Pending Librarian Review',
      createdAt: nowIso(),
    });
    addAudit(db, 'POST', faculty.user_name, `Submitted procurement request "${title}"`, 201);
    writeDb(db);
    sendJson(res, 201, buildFacultyWorkspaceOverview(db, faculty));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/faculty/bulk-requests') {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    const body = await parseBody(req);
    const bookId = String(body.bookId || '').trim();
    const book = db.books.find((entry) => entry.id === bookId);
    const copies = Math.max(1, Number(body.copies || 1));
    const location = String(body.location || '').trim();
    const classGroups = Array.isArray(body.classGroups) ? body.classGroups.map((entry) => String(entry).trim()).filter(Boolean) : [];
    if (!book || book.archived) {
      sendJson(res, 404, { error: 'Please select a valid catalog book for the bulk request.' });
      return;
    }
    if (!location || !classGroups.length) {
      sendJson(res, 400, { error: 'Choose a target location and at least one class group.' });
      return;
    }
    db.system.facultyBulkRequests.unshift({
      id: createId('bulk'),
      userId: faculty.userId,
      userName: faculty.user_name,
      dept: faculty.dept,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      copies,
      location,
      semester: String(body.semester || '').trim() || 'Full Semester (6 months)',
      classGroups,
      notes: String(body.notes || '').trim(),
      status: 'Pending Librarian Review',
      createdAt: nowIso(),
    });
    addAudit(db, 'POST', faculty.user_name, `Submitted bulk request for "${book.title}"`, 201);
    writeDb(db);
    sendJson(res, 201, buildFacultyWorkspaceOverview(db, faculty));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/faculty/notifications/mark-read') {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    const currentNotifications = computeLivePortalData(db, faculty).notifications || [];
    const prefs = getFacultyPreferences(db, faculty.userId);
    prefs.readNotificationKeys = currentNotifications.map((entry) => buildFacultyNotificationKey(entry));
    prefs.lastReadAt = nowIso();
    writeDb(db);
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/faculty/transactions/auto-renew') {
    const faculty = requireFaculty(db, req, res);
    if (!faculty) return;
    const body = await parseBody(req);
    const transactionId = String(body.transactionId || '').trim();
    const enabled = Boolean(body.enabled);
    const transaction = db.transactions.find((entry) => entry.id === transactionId && entry.userId === faculty.userId && !entry.returned && entry.status !== 'Lost');
    if (!transaction) {
      sendJson(res, 404, { error: 'Active faculty loan not found.' });
      return;
    }
    const prefs = getFacultyPreferences(db, faculty.userId);
    transaction.autoRenew = enabled;
    transaction.autoRenewUpdatedAt = nowIso();
    prefs.autoRenewTransactionIds = enabled
      ? Array.from(new Set([...prefs.autoRenewTransactionIds, transaction.id]))
      : prefs.autoRenewTransactionIds.filter((entry) => entry !== transaction.id);
    addAudit(db, 'POST', faculty.user_name, `${enabled ? 'Enabled' : 'Disabled'} auto-renew for transaction "${transaction.id}"`, 200);
    writeDb(db);
    sendJson(res, 200, { transaction: enrichTransaction(db, transaction), overview: buildFacultyWorkspaceOverview(db, faculty) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/books') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const body = await parseBody(req);
    const title = String(body.title || '').trim();
    const author = String(body.author || '').trim();
    const isbn = String(body.isbn || '').trim();
    const category = String(body.category || '').trim();
    const year = Number(body.year || 0);
    const totalCopies = Number(body.totalCopies || 0);
    const location = String(body.location || '').trim();
    const type = String(body.type || '').trim();
    const edition = String(body.edition || '').trim();
    const doi = String(body.doi || '').trim();
    const publisher = String(body.publisher || '').trim();
    const citationCount = Math.max(0, Number(body.citationCount || 0));

    if (!title || !author || !isbn || !category || !location || !year || totalCopies < 1) {
      sendJson(res, 400, { error: 'Please fill all required book fields.' });
      return;
    }

    if (db.books.some((book) => book.isbn.toLowerCase() === isbn.toLowerCase())) {
      sendJson(res, 409, { error: 'A book with this ISBN already exists.' });
      return;
    }

    const book = {
      id: createId('book'),
      title,
      author,
      isbn,
      category,
      year,
      totalCopies,
      availCopies: totalCopies,
      location,
      type,
      edition,
      doi,
      publisher,
      citationCount,
      archived: false,
      status: 'Available',
      createdAt: nowIso(),
    };

    db.books.push(book);
    addAudit(db, 'POST', admin.user_name, `Added book "${title}"`, 201);
    writeDb(db);
    sendJson(res, 201, { book });
    return;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/books/')) {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const bookId = decodeURIComponent(url.pathname.split('/').pop());
    const book = db.books.find((entry) => entry.id === bookId);
    if (!book) {
      sendJson(res, 404, { error: 'Book not found.' });
      return;
    }

    const body = await parseBody(req);
    const title = String(body.title || book.title).trim();
    const author = String(body.author || book.author).trim();
    const isbn = String(body.isbn || book.isbn).trim();
    const category = String(body.category || book.category).trim();
    const year = Number(body.year || book.year || 0);
    const totalCopies = Number(body.totalCopies ?? book.totalCopies ?? 0);
    const location = String(body.location || book.location).trim();
    const type = String(body.type ?? book.type ?? '').trim();
    const edition = String(body.edition ?? book.edition ?? '').trim();
    const doi = String(body.doi ?? book.doi ?? '').trim();
    const publisher = String(body.publisher ?? book.publisher ?? '').trim();
    const citationCount = Math.max(0, Number(body.citationCount ?? book.citationCount ?? 0));

    if (!title || !author || !isbn || !category || !location || !year || totalCopies < 1) {
      sendJson(res, 400, { error: 'Please fill all required book fields.' });
      return;
    }

    if (db.books.some((entry) => entry.id !== book.id && entry.isbn.toLowerCase() === isbn.toLowerCase())) {
      sendJson(res, 409, { error: 'A book with this ISBN already exists.' });
      return;
    }

    const activeLoans = db.transactions.filter((entry) => entry.bookId === book.id && !entry.returned).length;
    if (totalCopies < activeLoans) {
      sendJson(res, 400, { error: `This book has ${activeLoans} active loan(s), so total copies cannot be set lower than that.` });
      return;
    }

    book.title = title;
    book.author = author;
    book.isbn = isbn;
    book.category = category;
    book.year = year;
    book.totalCopies = totalCopies;
    book.availCopies = Math.max(totalCopies - activeLoans, 0);
    book.location = location;
    if (typeof body.archived === 'boolean') {
      book.archived = body.archived;
      book.archivedAt = body.archived ? nowIso() : '';
    }
    book.status = getBookStatus(book);

    addAudit(db, 'PUT', admin.user_name, `Updated book "${book.title}"`, 200);
    writeDb(db);
    sendJson(res, 200, { book: { ...book, status: getBookStatus(book) } });
    return;
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/books\/[^/]+\/archive$/)) {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const bookId = decodeURIComponent(url.pathname.split('/')[3]);
    const book = db.books.find((entry) => entry.id === bookId);
    if (!book) {
      sendJson(res, 404, { error: 'Book not found.' });
      return;
    }
    const body = await parseBody(req);
    const archived = body.archived !== false;
    book.archived = archived;
    book.archivedAt = archived ? nowIso() : '';
    book.status = getBookStatus(book);
    addAudit(db, 'POST', admin.user_name, `${archived ? 'Archived' : 'Restored'} book "${book.title}"`, 200);
    writeDb(db);
    sendJson(res, 200, { book: { ...book, status: getBookStatus(book) } });
    return;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/books/')) {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const bookId = decodeURIComponent(url.pathname.split('/').pop());
    const index = db.books.findIndex((entry) => entry.id === bookId);
    if (index < 0) {
      sendJson(res, 404, { error: 'Book not found.' });
      return;
    }
    const book = db.books[index];
    if (db.transactions.some((entry) => entry.bookId === book.id)) {
      sendJson(res, 409, { error: 'Books with transaction history can only be archived, not permanently deleted.' });
      return;
    }
    db.books.splice(index, 1);
    addAudit(db, 'DELETE', admin.user_name, `Deleted book "${book.title}"`, 200);
    writeDb(db);
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/transactions/issue') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const body = await parseBody(req);
    const memberId = String(body.userId || '').trim();
    const bookId = String(body.bookId || '').trim();
    const dueDate = formatDateInput(body.dueDate || '');

    const member = db.users.find((entry) => entry.id === memberId || entry.userId === memberId);
    if (!member) {
      sendJson(res, 404, { error: 'Borrower was not found.' });
      return;
    }
    if (member.role === 'Administrator') {
      sendJson(res, 400, { error: 'Administrator accounts cannot receive issued books.' });
      return;
    }
    if (member.status !== 'Active') {
      sendJson(res, 400, { error: 'This borrower account is not active.' });
      return;
    }

    const book = db.books.find((entry) => entry.id === bookId);
    if (!book) {
      sendJson(res, 404, { error: 'Book was not found.' });
      return;
    }
    if (Number(book.availCopies || 0) < 1) {
      sendJson(res, 409, { error: 'No available copies remain for this book.' });
      return;
    }
    if (book.archived) {
      sendJson(res, 409, { error: 'Archived books cannot be issued.' });
      return;
    }

    const activeLoans = db.transactions.filter((entry) => entry.userId === member.userId && !entry.returned);
    const maxBooks = Number(db.system.maxBooksPerStudent || 3);
    if (activeLoans.length >= maxBooks) {
      sendJson(res, 409, { error: `${member.user_name} already has the maximum of ${maxBooks} active book(s).` });
      return;
    }

    const checkout = nowIso().slice(0, 10);
    let normalizedDue = dueDate;
    if (!normalizedDue) {
      const computedDue = new Date();
      computedDue.setDate(computedDue.getDate() + Number(db.system.loanPeriodDays || 14));
      normalizedDue = computedDue.toISOString().slice(0, 10);
    }
    if (new Date(normalizedDue).getTime() < new Date(checkout).getTime()) {
      sendJson(res, 400, { error: 'Due date must be today or later.' });
      return;
    }

    const transaction = {
      id: createId('tx'),
      userId: member.userId,
      userName: member.user_name,
      bookId: book.id,
      bookTitle: book.title,
      isbn: book.isbn,
      checkout,
      due: normalizedDue,
      returned: '',
      status: 'Borrowed',
      fine: 0,
      fineOverride: null,
      processedBy: admin.user_name,
      renewalCount: 0,
    };

    db.transactions.unshift(transaction);
    book.availCopies = Math.max(Number(book.availCopies || 0) - 1, 0);
    book.status = getBookStatus(book);
    addAudit(db, 'POST', admin.user_name, `Issued "${book.title}" to ${member.user_name}`, 201);
    writeDb(db);
    sendJson(res, 201, { transaction: enrichTransaction(db, transaction) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/transactions/return') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const body = await parseBody(req);
    const transactionIds = Array.isArray(body.transactionIds)
      ? body.transactionIds.map(String)
      : body.transactionId
        ? [String(body.transactionId)]
        : [];
    if (!transactionIds.length) {
      sendJson(res, 400, { error: 'Please provide at least one transaction to return.' });
      return;
    }
    const processed = processReturnTransactions(db, admin.user_name, transactionIds);
    if (!processed.length) {
      sendJson(res, 404, { error: 'No active matching transactions were found.' });
      return;
    }
    processed.forEach((entry) => addAudit(db, 'POST', admin.user_name, `Returned "${entry.bookTitle}" from ${entry.userName}`, 200));
    writeDb(db);
    sendJson(res, 200, { processed });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/transactions/renew') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const body = await parseBody(req);
    const transactionId = String(body.transactionId || '').trim();
    const transaction = db.transactions.find((entry) => entry.id === transactionId);
    if (!transaction || transaction.returned || transaction.status === 'Lost') {
      sendJson(res, 404, { error: 'Active transaction not found.' });
      return;
    }
    if (getDayDiff(transaction.due) < 0) {
      sendJson(res, 409, { error: 'Overdue items must be returned or waived before renewal.' });
      return;
    }
    const renewalLimit = Number(db.system.renewalLimit || 0);
    const currentCount = Number(transaction.renewalCount || 0);
    if (currentCount >= renewalLimit) {
      sendJson(res, 409, { error: `This transaction has already reached the renewal limit of ${renewalLimit}.` });
      return;
    }
    const dueDate = new Date(transaction.due);
    dueDate.setDate(dueDate.getDate() + Number(db.system.loanPeriodDays || 14));
    transaction.due = dueDate.toISOString().slice(0, 10);
    transaction.renewalCount = currentCount + 1;
    transaction.status = 'Borrowed';
    addAudit(db, 'POST', admin.user_name, `Renewed transaction "${transaction.id}"`, 200);
    writeDb(db);
    sendJson(res, 200, { transaction: enrichTransaction(db, transaction) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/transactions/mark-lost') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const body = await parseBody(req);
    const transactionId = String(body.transactionId || '').trim();
    const transaction = db.transactions.find((entry) => entry.id === transactionId);
    if (!transaction || transaction.returned || transaction.status === 'Lost') {
      sendJson(res, 404, { error: 'Active transaction not found.' });
      return;
    }
    const book = db.books.find((entry) => entry.id === transaction.bookId);
    transaction.returned = nowIso().slice(0, 10);
    transaction.status = 'Lost';
    transaction.processedBy = admin.user_name;
    transaction.fine = calculateTransactionFine(db, transaction);
    if (book) {
      book.totalCopies = Math.max(Number(book.totalCopies || 0) - 1, 0);
      book.availCopies = Math.min(Number(book.availCopies || 0), Number(book.totalCopies || 0));
      book.status = getBookStatus(book);
    }
    addAudit(db, 'POST', admin.user_name, `Marked transaction "${transaction.id}" as lost`, 200);
    writeDb(db);
    sendJson(res, 200, { transaction: enrichTransaction(db, transaction), book: book ? { ...book, status: getBookStatus(book) } : null });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/transactions/waive-fine') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const body = await parseBody(req);
    const transactionId = String(body.transactionId || '').trim();
    const transaction = db.transactions.find((entry) => entry.id === transactionId);
    if (!transaction) {
      sendJson(res, 404, { error: 'Transaction not found.' });
      return;
    }
    transaction.fineOverride = 0;
    transaction.fine = 0;
    transaction.fineWaivedBy = admin.user_name;
    transaction.fineWaivedAt = nowIso();
    addAudit(db, 'POST', admin.user_name, `Waived fine for transaction "${transaction.id}"`, 200);
    writeDb(db);
    sendJson(res, 200, { transaction: enrichTransaction(db, transaction) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/librarian/transactions/issue') {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const body = await parseBody(req);
    const memberId = String(body.userId || '').trim();
    const bookIds = Array.isArray(body.bookIds) ? body.bookIds.map(String) : body.bookId ? [String(body.bookId)] : [];
    const dueDate = body.dueDate || '';
    const member = db.users.find((entry) => entry.id === memberId || entry.userId === memberId);
    if (!bookIds.length) {
      sendJson(res, 400, { error: 'Please select at least one book to issue.' });
      return;
    }
    try {
      const issued = [];
      const undoTransactions = [];
      for (const bookId of bookIds) {
        const book = db.books.find((entry) => entry.id === bookId);
        validateIssueRequest(db, member, book);
        const transaction = buildIssueTransaction(db, librarian.user_name, member, book, dueDate);
        db.transactions.unshift(transaction);
        book.availCopies = Math.max(Number(book.availCopies || 0) - 1, 0);
        book.status = getBookStatus(book);
        issued.push(enrichTransaction(db, transaction));
        undoTransactions.push({ transactionId: transaction.id, bookId: book.id });
        addAudit(db, 'POST', librarian.user_name, `Issued "${book.title}" to ${member.user_name}`, 201);
      }
      pushUndoAction(db, { actor: librarian.user_name, type: 'librarian-issue', memberId: member.userId, transactions: undoTransactions });
      writeDb(db);
      sendJson(res, 201, { issued });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Unable to issue selected book(s).' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/librarian/transactions/renew') {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const body = await parseBody(req);
    const transactionId = String(body.transactionId || '').trim();
    const transaction = db.transactions.find((entry) => entry.id === transactionId);
    if (!transaction || transaction.returned || transaction.status === 'Lost') {
      sendJson(res, 404, { error: 'Active transaction not found.' });
      return;
    }
    if (getDayDiff(transaction.due) < 0) {
      sendJson(res, 409, { error: 'Overdue items must be returned or settled before renewal.' });
      return;
    }
    const renewalLimit = Number(db.system.renewalLimit || 0);
    const currentCount = Number(transaction.renewalCount || 0);
    if (currentCount >= renewalLimit) {
      sendJson(res, 409, { error: `This transaction has already reached the renewal limit of ${renewalLimit}.` });
      return;
    }
    const previous = {
      transactionId: transaction.id,
      due: transaction.due,
      renewalCount: transaction.renewalCount,
      status: transaction.status,
      renewedAt: transaction.renewedAt,
      renewedBy: transaction.renewedBy,
    };
    const dueDate = new Date(transaction.due);
    dueDate.setDate(dueDate.getDate() + Number(db.system.loanPeriodDays || 14));
    transaction.due = dueDate.toISOString().slice(0, 10);
    transaction.renewalCount = currentCount + 1;
    transaction.status = 'Borrowed';
    transaction.renewedAt = nowIso();
    transaction.renewedBy = librarian.user_name;
    pushUndoAction(db, { actor: librarian.user_name, type: 'librarian-renew', previous });
    addAudit(db, 'POST', librarian.user_name, `Renewed transaction "${transaction.id}"`, 200);
    writeDb(db);
    sendJson(res, 200, { transaction: enrichTransaction(db, transaction) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/librarian/books') {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const body = await parseBody(req);
    const title = String(body.title || '').trim();
    const author = String(body.author || '').trim();
    const isbn = String(body.isbn || '').trim();
    const category = String(body.category || '').trim();
    const year = Number(body.year || 0);
    const totalCopies = Number(body.totalCopies || 0);
    const location = String(body.location || '').trim();
    const type = String(body.type || '').trim();
    const edition = String(body.edition || '').trim();
    const doi = String(body.doi || '').trim();
    const publisher = String(body.publisher || '').trim();
    const citationCount = Math.max(0, Number(body.citationCount || 0));
    if (!title || !author || !isbn || !category || !location || !year || totalCopies < 1) {
      sendJson(res, 400, { error: 'Please fill all required book fields.' });
      return;
    }
    if (db.books.some((book) => book.isbn.toLowerCase() === isbn.toLowerCase())) {
      sendJson(res, 409, { error: 'A book with this ISBN already exists.' });
      return;
    }
    const book = {
      id: createId('book'),
      title,
      author,
      isbn,
      category,
      year,
      totalCopies,
      availCopies: totalCopies,
      location,
      type,
      edition,
      doi,
      publisher,
      citationCount,
      archived: false,
      status: 'Available',
      createdAt: nowIso(),
      addedBy: librarian.user_name,
    };
    db.books.push(book);
    pushUndoAction(db, { actor: librarian.user_name, type: 'librarian-create-book', bookId: book.id });
    addAudit(db, 'POST', librarian.user_name, `Added book "${title}" from librarian desk`, 201);
    addInventoryEvent(db, {
      actor: librarian.user_name,
      type: 'Inventory Added',
      bookId: book.id,
      bookTitle: book.title,
      detail: `${book.totalCopies} copy/copies at ${book.location}`,
    });
    writeDb(db);
    sendJson(res, 201, { book: { ...book, status: getBookStatus(book) } });
    return;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/librarian/books/')) {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const bookId = decodeURIComponent(url.pathname.split('/').pop());
    const book = db.books.find((entry) => entry.id === bookId);
    if (!book) {
      sendJson(res, 404, { error: 'Book not found.' });
      return;
    }
    const snapshot = { ...book };
    const body = await parseBody(req);
    const title = String(body.title || book.title).trim();
    const author = String(body.author || book.author).trim();
    const isbn = String(body.isbn || book.isbn).trim();
    const category = String(body.category || book.category).trim();
    const year = Number(body.year || book.year || 0);
    const totalCopies = Number(body.totalCopies ?? book.totalCopies ?? 0);
    const location = String(body.location || book.location).trim();
    const type = String(body.type ?? book.type ?? '').trim();
    const edition = String(body.edition ?? book.edition ?? '').trim();
    const doi = String(body.doi ?? book.doi ?? '').trim();
    const publisher = String(body.publisher ?? book.publisher ?? '').trim();
    const citationCount = Math.max(0, Number(body.citationCount ?? book.citationCount ?? 0));
    if (!title || !author || !isbn || !category || !location || !year || totalCopies < 1) {
      sendJson(res, 400, { error: 'Please fill all required book fields.' });
      return;
    }
    if (db.books.some((entry) => entry.id !== book.id && entry.isbn.toLowerCase() === isbn.toLowerCase())) {
      sendJson(res, 409, { error: 'A book with this ISBN already exists.' });
      return;
    }
    const activeLoans = db.transactions.filter((entry) => entry.bookId === book.id && !entry.returned && entry.status !== 'Lost').length;
    if (totalCopies < activeLoans) {
      sendJson(res, 400, { error: `This book has ${activeLoans} active loan(s), so total copies cannot be set lower than that.` });
      return;
    }
    book.title = title;
    book.author = author;
    book.isbn = isbn;
    book.category = category;
    book.year = year;
    book.totalCopies = totalCopies;
    book.availCopies = Math.max(totalCopies - activeLoans, 0);
    book.location = location;
    book.type = type;
    book.edition = edition;
    book.doi = doi;
    book.publisher = publisher;
    book.citationCount = citationCount;
    book.status = getBookStatus(book);
    pushUndoAction(db, { actor: librarian.user_name, type: 'librarian-update-book', bookId: book.id, snapshot });
    addAudit(db, 'PUT', librarian.user_name, `Updated book "${book.title}" from librarian desk`, 200);
    addInventoryEvent(db, {
      actor: librarian.user_name,
      type: 'Inventory Edited',
      bookId: book.id,
      bookTitle: book.title,
      detail: `${book.totalCopies} total copy/copies · Shelf ${book.location}`,
    });
    writeDb(db);
    sendJson(res, 200, { book: { ...book, status: getBookStatus(book) } });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/librarian/books/bulk-update') {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const body = await parseBody(req);
    const action = String(body.action || '').trim();
    const bookIds = Array.isArray(body.bookIds) ? body.bookIds.map(String) : [];
    const location = String(body.location || '').trim();
    const category = String(body.category || '').trim();
    if (!bookIds.length) {
      sendJson(res, 400, { error: 'Please choose at least one inventory record.' });
      return;
    }
    const snapshots = [];
    const touchedBooks = [];
    for (const bookId of bookIds) {
      const book = db.books.find((entry) => entry.id === bookId);
      if (!book) continue;
      snapshots.push({ bookId: book.id, snapshot: { ...book, discardLog: Array.isArray(book.discardLog) ? [...book.discardLog] : [] } });
      if (action === 'archive') {
        const activeLoans = db.transactions.filter((entry) => entry.bookId === book.id && !entry.returned && entry.status !== 'Lost').length;
        if (activeLoans) {
          sendJson(res, 409, { error: `Cannot archive "${book.title}" while ${activeLoans} active loan(s) remain.` });
          return;
        }
        book.archived = true;
        book.archivedAt = nowIso();
      } else if (action === 'restore') {
        book.archived = false;
        book.archivedAt = '';
      } else if (action === 'move') {
        if (!location) {
          sendJson(res, 400, { error: 'Please provide a shelf location for the bulk move.' });
          return;
        }
        book.location = location;
      } else if (action === 'categorize') {
        if (!category) {
          sendJson(res, 400, { error: 'Please provide a category for the bulk update.' });
          return;
        }
        book.category = category;
      } else {
        sendJson(res, 400, { error: 'Unknown bulk inventory action.' });
        return;
      }
      book.status = getBookStatus(book);
      touchedBooks.push(book);
    }
    if (!touchedBooks.length) {
      sendJson(res, 404, { error: 'No matching books were found for the bulk action.' });
      return;
    }
    pushUndoAction(db, { actor: librarian.user_name, type: 'librarian-bulk-update', snapshots });
    addAudit(db, 'POST', librarian.user_name, `Applied bulk inventory action "${action}" to ${touchedBooks.length} book(s)`, 200);
    touchedBooks.forEach((book) => addInventoryEvent(db, {
      actor: librarian.user_name,
      type: action === 'archive' ? 'Inventory Archived' : action === 'restore' ? 'Inventory Restored' : action === 'move' ? 'Inventory Relocated' : 'Inventory Re-Categorized',
      bookId: book.id,
      bookTitle: book.title,
      detail: action === 'move' ? `Moved to ${book.location}` : action === 'categorize' ? `Category set to ${book.category}` : book.status,
    }));
    writeDb(db);
    sendJson(res, 200, { count: touchedBooks.length, books: touchedBooks.map((book) => ({ ...book, status: getBookStatus(book) })) });
    return;
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/librarian\/books\/[^/]+\/archive$/)) {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const bookId = decodeURIComponent(url.pathname.split('/')[4]);
    const book = db.books.find((entry) => entry.id === bookId);
    if (!book) {
      sendJson(res, 404, { error: 'Book not found.' });
      return;
    }
    const activeLoans = db.transactions.filter((entry) => entry.bookId === book.id && !entry.returned && entry.status !== 'Lost').length;
    if (activeLoans) {
      sendJson(res, 409, { error: `Cannot archive "${book.title}" while ${activeLoans} active loan(s) remain.` });
      return;
    }
    const snapshot = { ...book, discardLog: Array.isArray(book.discardLog) ? [...book.discardLog] : [] };
    book.archived = true;
    book.archivedAt = nowIso();
    book.status = getBookStatus(book);
    pushUndoAction(db, { actor: librarian.user_name, type: 'librarian-archive-book', bookId: book.id, snapshot });
    addAudit(db, 'POST', librarian.user_name, `Archived book "${book.title}"`, 200);
    addInventoryEvent(db, { actor: librarian.user_name, type: 'Inventory Archived', bookId: book.id, bookTitle: book.title, detail: 'Hidden from active catalog' });
    writeDb(db);
    sendJson(res, 200, { book: { ...book, status: getBookStatus(book) } });
    return;
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/librarian\/books\/[^/]+\/restore$/)) {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const bookId = decodeURIComponent(url.pathname.split('/')[4]);
    const book = db.books.find((entry) => entry.id === bookId);
    if (!book) {
      sendJson(res, 404, { error: 'Book not found.' });
      return;
    }
    const snapshot = { ...book, discardLog: Array.isArray(book.discardLog) ? [...book.discardLog] : [] };
    book.archived = false;
    book.archivedAt = '';
    book.status = getBookStatus(book);
    pushUndoAction(db, { actor: librarian.user_name, type: 'librarian-restore-book', bookId: book.id, snapshot });
    addAudit(db, 'POST', librarian.user_name, `Restored book "${book.title}"`, 200);
    addInventoryEvent(db, { actor: librarian.user_name, type: 'Inventory Restored', bookId: book.id, bookTitle: book.title, detail: 'Returned to active catalog' });
    writeDb(db);
    sendJson(res, 200, { book: { ...book, status: getBookStatus(book) } });
    return;
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/librarian\/books\/[^/]+\/discard$/)) {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const bookId = decodeURIComponent(url.pathname.split('/')[4]);
    const book = db.books.find((entry) => entry.id === bookId);
    if (!book) {
      sendJson(res, 404, { error: 'Book not found.' });
      return;
    }
    const body = await parseBody(req);
    const reason = String(body.reason || '').trim();
    const notes = String(body.notes || '').trim();
    if (!reason) {
      sendJson(res, 400, { error: 'Please select a discard reason.' });
      return;
    }
    if (Number(book.availCopies || 0) < 1) {
      sendJson(res, 409, { error: 'Only currently available copies can be discarded from inventory.' });
      return;
    }
    const snapshot = { ...book, discardLog: Array.isArray(book.discardLog) ? [...book.discardLog] : [] };
    book.totalCopies = Math.max(Number(book.totalCopies || 0) - 1, 0);
    book.availCopies = Math.max(Number(book.availCopies || 0) - 1, 0);
    book.discardLog = Array.isArray(book.discardLog) ? book.discardLog : [];
    book.discardLog.unshift({ at: nowIso(), by: librarian.user_name, reason, notes });
    book.archived = Number(book.totalCopies || 0) === 0 ? true : Boolean(book.archived);
    book.archivedAt = book.archived ? (book.archivedAt || nowIso()) : '';
    book.status = getBookStatus(book);
    pushUndoAction(db, { actor: librarian.user_name, type: 'librarian-discard-book', bookId: book.id, snapshot });
    addAudit(db, 'POST', librarian.user_name, `Discarded one copy of "${book.title}" (${reason})`, 200);
    addInventoryEvent(db, {
      actor: librarian.user_name,
      type: 'Inventory Discarded',
      bookId: book.id,
      bookTitle: book.title,
      detail: `${reason}${notes ? ` · ${notes}` : ''}`,
    });
    writeDb(db);
    sendJson(res, 200, { book: { ...book, status: getBookStatus(book) } });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/librarian/fines/settle') {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const body = await parseBody(req);
    const action = String(body.action || '').trim();
    const transactionIds = Array.isArray(body.transactionIds) ? body.transactionIds.map(String) : [];
    const reason = String(body.reason || '').trim();
    const notes = String(body.notes || '').trim();
    const paymentMode = String(body.paymentMode || '').trim();
    const receiptNumber = String(body.receiptNumber || '').trim();
    if (!transactionIds.length) {
      sendJson(res, 400, { error: 'Please provide at least one transaction.' });
      return;
    }
    if (!['paid', 'ledger', 'waive'].includes(action)) {
      sendJson(res, 400, { error: 'Unknown fine action.' });
      return;
    }
    const previous = [];
    const processed = [];
    const ledgerEntryIds = [];
    for (const transactionId of transactionIds) {
      const transaction = db.transactions.find((entry) => entry.id === transactionId);
      if (!transaction) continue;
      const fineValue = Number(calculateTransactionFine(db, transaction) || 0);
      if (!fineValue && action !== 'waive') continue;
      previous.push({
        id: transaction.id,
        fine: transaction.fine,
        fineOverride: transaction.fineOverride,
        fineStatus: transaction.fineStatus,
        finePaidAt: transaction.finePaidAt,
        finePaidBy: transaction.finePaidBy,
        fineLedgerAt: transaction.fineLedgerAt,
        fineLedgerBy: transaction.fineLedgerBy,
        fineWaivedAt: transaction.fineWaivedAt,
        fineWaivedBy: transaction.fineWaivedBy,
        fineWaiveReason: transaction.fineWaiveReason,
        fineNotes: transaction.fineNotes,
        finePaidAmount: transaction.finePaidAmount,
        paymentMode: transaction.paymentMode,
        receiptNumber: transaction.receiptNumber,
        fineWaivedAmount: transaction.fineWaivedAmount,
      });
      if (action === 'paid') {
        if (!paymentMode) {
          sendJson(res, 400, { error: 'Please choose a payment mode before recording payment.' });
          return;
        }
        transaction.fine = fineValue;
        transaction.fineOverride = 0;
        transaction.fineStatus = 'Paid';
        transaction.finePaidAt = nowIso();
        transaction.finePaidBy = librarian.user_name;
        transaction.finePaidAmount = fineValue;
        transaction.paymentMode = paymentMode;
        transaction.receiptNumber = receiptNumber || '';
        transaction.fineNotes = notes;
        transaction.fine = 0;
      } else if (action === 'ledger') {
        transaction.fine = fineValue;
        transaction.fineStatus = 'Ledger';
        transaction.fineLedgerAt = nowIso();
        transaction.fineLedgerBy = librarian.user_name;
        transaction.fineNotes = notes;
        const ledgerEntry = addLedgerEntry(db, {
          transactionId: transaction.id,
          amount: fineValue,
          memberId: transaction.userId,
          memberName: transaction.userName || '',
          bookTitle: transaction.bookTitle || '',
          notes,
          recordedBy: librarian.user_name,
        });
        if (ledgerEntry?.id) ledgerEntryIds.push(ledgerEntry.id);
      } else {
        transaction.fineWaivedAmount = fineValue;
        transaction.fineOverride = 0;
        transaction.fine = 0;
        transaction.fineStatus = 'Waived';
        transaction.fineWaivedAt = nowIso();
        transaction.fineWaivedBy = librarian.user_name;
        transaction.fineWaiveReason = reason;
        transaction.fineNotes = notes;
      }
      processed.push(enrichTransaction(db, transaction));
    }
    if (!processed.length) {
      sendJson(res, 404, { error: 'No matching fine records were found.' });
      return;
    }
    pushUndoAction(db, { actor: librarian.user_name, type: 'librarian-fine-settlement', action, previous, ledgerEntryIds });
    addAudit(db, 'POST', librarian.user_name, `${action === 'paid' ? 'Recorded paid fine' : action === 'ledger' ? 'Added fine to ledger' : 'Waived fine'} for ${processed.length} transaction(s)`, 200);
    writeDb(db);
    sendJson(res, 200, { processed, ledgerEntries: db.system.ledgerEntries });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/librarian/reminders') {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const body = await parseBody(req);
    const requestedIds = Array.isArray(body.transactionIds) ? body.transactionIds.map(String) : [];
    const dueItems = db.transactions
      .map((entry) => enrichTransaction(db, entry))
      .filter((entry) => !entry.returned && entry.status !== 'Lost' && entry.dayDiff <= 0);
    const targets = requestedIds.length ? dueItems.filter((entry) => requestedIds.includes(entry.id)) : dueItems;
    if (!targets.length) {
      sendJson(res, 404, { error: 'No due or overdue transactions were available for reminders.' });
      return;
    }
    const reminders = addReminderEntries(db, targets.map((entry) => ({
      transactionId: entry.id,
      userId: entry.userId,
      userName: entry.userName || '',
      bookTitle: entry.bookTitle || '',
      dayDiff: entry.dayDiff,
      sentBy: librarian.user_name,
    })));
    pushUndoAction(db, {
      actor: librarian.user_name,
      type: 'librarian-reminders',
      reminderIds: reminders.map((entry) => entry.id),
    });
    addAudit(db, 'POST', librarian.user_name, `Prepared ${targets.length} reminder notice(s)`, 200);
    writeDb(db);
    sendJson(res, 200, { count: targets.length, reminderLog: db.system.reminderLog });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/librarian/undo-last') {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;
    const action = db.system.undoStack.shift();
    if (!action) {
      sendJson(res, 404, { error: 'There is no librarian action to undo.' });
      return;
    }
    let summary = '';
    if (action.type === 'librarian-issue') {
      action.transactions.forEach((entry) => {
        const txIndex = db.transactions.findIndex((item) => item.id === entry.transactionId);
        if (txIndex >= 0) db.transactions.splice(txIndex, 1);
        const book = db.books.find((item) => item.id === entry.bookId);
        if (book) {
          book.availCopies = Math.min(Number(book.totalCopies || 0), Number(book.availCopies || 0) + 1);
          book.status = getBookStatus(book);
        }
      });
      summary = `Undid librarian issue action (${action.transactions.length} book(s)).`;
    } else if (action.type === 'librarian-return') {
      action.previous.forEach((entry) => {
        const transaction = db.transactions.find((item) => item.id === entry.transactionId);
        if (transaction) {
          transaction.returned = entry.returned;
          transaction.status = entry.status;
          transaction.processedBy = entry.processedBy;
          transaction.fine = entry.fine;
          transaction.fineOverride = entry.fineOverride;
          transaction.fineStatus = entry.fineStatus;
        }
        const book = db.books.find((item) => item.id === entry.bookId);
        if (book) {
          book.availCopies = entry.bookAvailCopies;
          book.status = entry.bookStatus;
        }
      });
      summary = `Undid librarian return action (${action.previous.length} book(s)).`;
    } else if (action.type === 'librarian-renew') {
      const transaction = db.transactions.find((item) => item.id === action.previous.transactionId);
      if (transaction) {
        transaction.due = action.previous.due;
        transaction.renewalCount = action.previous.renewalCount;
        transaction.status = action.previous.status;
        transaction.renewedAt = action.previous.renewedAt;
        transaction.renewedBy = action.previous.renewedBy;
      }
      summary = 'Undid librarian renewal.';
    } else if (action.type === 'librarian-create-book') {
      const index = db.books.findIndex((item) => item.id === action.bookId);
      if (index >= 0) db.books.splice(index, 1);
      summary = 'Undid librarian book creation.';
    } else if (action.type === 'librarian-update-book' || action.type === 'librarian-discard-book' || action.type === 'librarian-archive-book' || action.type === 'librarian-restore-book') {
      const book = db.books.find((item) => item.id === action.bookId);
      if (book && action.snapshot) {
        Object.keys(book).forEach((key) => delete book[key]);
        Object.assign(book, action.snapshot);
      }
      summary = action.type === 'librarian-discard-book'
        ? 'Undid librarian discard action.'
        : action.type === 'librarian-archive-book'
          ? 'Undid librarian archive action.'
          : action.type === 'librarian-restore-book'
            ? 'Undid librarian restore action.'
            : 'Undid librarian book edit.';
    } else if (action.type === 'librarian-bulk-update') {
      (action.snapshots || []).forEach((entry) => {
        const book = db.books.find((item) => item.id === entry.bookId);
        if (!book || !entry.snapshot) return;
        Object.keys(book).forEach((key) => delete book[key]);
        Object.assign(book, entry.snapshot);
      });
      summary = `Undid librarian bulk update (${(action.snapshots || []).length} book(s)).`;
    } else if (action.type === 'librarian-fine-settlement') {
      action.previous.forEach((entry) => {
        const transaction = db.transactions.find((item) => item.id === entry.id);
        if (!transaction) return;
        transaction.fine = entry.fine;
        transaction.fineOverride = entry.fineOverride;
        transaction.fineStatus = entry.fineStatus;
        transaction.finePaidAt = entry.finePaidAt;
        transaction.finePaidBy = entry.finePaidBy;
        transaction.fineLedgerAt = entry.fineLedgerAt;
        transaction.fineLedgerBy = entry.fineLedgerBy;
        transaction.fineWaivedAt = entry.fineWaivedAt;
        transaction.fineWaivedBy = entry.fineWaivedBy;
        transaction.fineWaiveReason = entry.fineWaiveReason;
        transaction.fineNotes = entry.fineNotes;
        transaction.finePaidAmount = entry.finePaidAmount;
        transaction.paymentMode = entry.paymentMode;
        transaction.receiptNumber = entry.receiptNumber;
        transaction.fineWaivedAmount = entry.fineWaivedAmount;
      });
      if (Array.isArray(action.ledgerEntryIds) && action.ledgerEntryIds.length) {
        db.system.ledgerEntries = db.system.ledgerEntries.filter((entry) => !action.ledgerEntryIds.includes(entry.id));
      }
      summary = 'Undid librarian fine settlement.';
    } else if (action.type === 'librarian-reminders') {
      db.system.reminderLog = db.system.reminderLog.filter((entry) => !action.reminderIds.includes(entry.id));
      summary = `Undid librarian reminder batch (${action.reminderIds.length} notice${action.reminderIds.length === 1 ? '' : 's'}).`;
    } else {
      db.system.undoStack.unshift(action);
      sendJson(res, 400, { error: 'This action cannot be undone yet.' });
      return;
    }
    addAudit(db, 'POST', librarian.user_name, summary, 200);
    writeDb(db);
    sendJson(res, 200, { success: true, summary });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/librarian/overview') {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;

    const activeTransactions = db.transactions
      .filter((item) => !item.returned)
      .map((item) => enrichTransaction(db, item));

    const dueItems = activeTransactions
      .filter((item) => item.dayDiff <= 0)
      .sort((a, b) => a.dayDiff - b.dayDiff);

    const reportRows = buildLibrarianReportRows(db);
    const dashboardInsights = buildLibrarianDashboardInsights(db);
    const deskNotifications = buildLibrarianDeskNotifications(db);
    const undoState = describeUndoAction((db.system.undoStack || [])[0]);

    sendJson(res, 200, {
      currentUser: sanitizeUser(librarian),
      books: db.books.map((book) => ({ ...book, status: getBookStatus(book) })),
      dueItems,
      activeTransactions,
      deskNotifications,
      dashboardInsights,
      ledgerEntries: db.system.ledgerEntries,
      inventoryEvents: db.system.inventoryEvents,
      recentTransactions: db.transactions
        .slice()
        .sort((a, b) => new Date(b.checkout || b.returned || 0).getTime() - new Date(a.checkout || a.returned || 0).getTime())
        .map((item) => enrichTransaction(db, item))
        .slice(0, 20),
      reportRows,
      reminderLog: db.system.reminderLog,
      undoAvailable: Boolean((db.system.undoStack || []).length),
      undoState,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/librarian/users/')) {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;

    const requestedUserId = decodeURIComponent(url.pathname.split('/').pop());
    const member = db.users.find((entry) => entry.userId.toLowerCase() === requestedUserId.toLowerCase());

    if (!member) {
      sendJson(res, 404, { error: 'Member not found.' });
      return;
    }

    sendJson(res, 200, buildLibrarianMemberPayload(db, member));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/librarian/transactions/return') {
    const librarian = requireLibrarian(db, req, res);
    if (!librarian) return;

    const body = await parseBody(req);
    const transactionIds = Array.isArray(body.transactionIds) ? body.transactionIds.map(String) : [];

    if (!transactionIds.length) {
      sendJson(res, 400, { error: 'Please provide at least one transaction to return.' });
      return;
    }

    const previous = transactionIds.map((transactionId) => {
      const transaction = db.transactions.find((entry) => entry.id === transactionId);
      const book = transaction ? db.books.find((entry) => entry.id === transaction.bookId) : null;
      if (!transaction || transaction.returned || transaction.status === 'Lost') return null;
      return {
        transactionId: transaction.id,
        returned: transaction.returned,
        status: transaction.status,
        processedBy: transaction.processedBy,
        fine: transaction.fine,
        fineOverride: transaction.fineOverride,
        fineStatus: transaction.fineStatus,
        bookId: transaction.bookId,
        bookAvailCopies: book ? book.availCopies : null,
        bookStatus: book ? getBookStatus(book) : '',
      };
    }).filter(Boolean);
    const processed = processReturnTransactions(db, librarian.user_name, transactionIds);
    processed.forEach((entry) => addAudit(db, 'POST', librarian.user_name, `Processed return for "${entry.bookTitle}" from ${entry.userName}`, 200));

    if (!processed.length) {
      sendJson(res, 404, { error: 'No active matching transactions were found.' });
      return;
    }

    pushUndoAction(db, { actor: librarian.user_name, type: 'librarian-return', previous });
    writeDb(db);
    sendJson(res, 200, { processed });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/users') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    sendJson(res, 200, { users: db.users.map(sanitizeUser) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/users') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const body = await parseBody(req);
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const userId = String(body.userId || '').trim();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const role = normalizeRole(body.role);
    const dept = String(body.dept || '').trim();
    const phone = String(body.phone || '').trim();
    const status = String(body.status || 'Active').trim() || 'Active';

    if (!firstName || !lastName || !userId || !email || !password || !dept) {
      sendJson(res, 400, { error: 'Please fill all required member fields.' });
      return;
    }

    if (db.users.some((entry) => entry.email.toLowerCase() === email.toLowerCase())) {
      sendJson(res, 409, { error: 'This email is already registered.' });
      return;
    }

    if (db.users.some((entry) => entry.userId.toLowerCase() === userId.toLowerCase())) {
      sendJson(res, 409, { error: 'This user ID is already registered.' });
      return;
    }

    const user = {
      id: createId('user'),
      userId,
      email,
      password,
      user_name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      phone,
      role,
      dept,
      status,
      joined: nowIso().slice(0, 10),
      profile: getDefaultProfile(),
    };

    db.users.push(user);
    addAudit(db, 'POST', admin.user_name, `Created ${role} account "${user.user_name}"`, 201);
    writeDb(db);
    sendJson(res, 201, { user: sanitizeUser(user) });
    return;
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/users/')) {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const userId = decodeURIComponent(url.pathname.split('/').pop());
    const user = db.users.find((entry) => entry.id === userId);
    if (!user) {
      sendJson(res, 404, { error: 'User not found.' });
      return;
    }

    const body = await parseBody(req);
    const nextEmail = String(body.email || user.email).trim();
    const nextUserId = String(body.userId || user.userId).trim();

    if (db.users.some((entry) => entry.id !== user.id && entry.email.toLowerCase() === nextEmail.toLowerCase())) {
      sendJson(res, 409, { error: 'This email is already used by another account.' });
      return;
    }

    if (db.users.some((entry) => entry.id !== user.id && entry.userId.toLowerCase() === nextUserId.toLowerCase())) {
      sendJson(res, 409, { error: 'This user ID is already used by another account.' });
      return;
    }

    user.firstName = String(body.firstName || user.firstName).trim();
    user.lastName = String(body.lastName || user.lastName).trim();
    user.userId = nextUserId;
    user.email = nextEmail;
    user.phone = String(body.phone ?? user.phone).trim();
    user.role = normalizeRole(body.role || user.role);
    user.dept = String(body.dept || user.dept).trim();
    user.status = String(body.status || user.status).trim();
    user.user_name = `${user.firstName} ${user.lastName}`.trim();
    user.profile = { ...getDefaultProfile(), ...(user.profile || {}) };
    if (body.password) {
      user.password = String(body.password);
    }

    addAudit(db, 'PUT', admin.user_name, `Updated account "${user.user_name}"`, 200);
    writeDb(db);
    sendJson(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/users\/[^/]+\/reset-password$/)) {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const userId = decodeURIComponent(url.pathname.split('/')[3]);
    const user = db.users.find((entry) => entry.id === userId);
    if (!user) {
      sendJson(res, 404, { error: 'User not found.' });
      return;
    }
    const body = await parseBody(req);
    const password = String(body.password || '').trim();
    if (password.length < 4) {
      sendJson(res, 400, { error: 'Please provide a stronger password.' });
      return;
    }
    user.password = password;
    addAudit(db, 'POST', admin.user_name, `Reset password for "${user.user_name}"`, 200);
    writeDb(db);
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/users/')) {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const userId = decodeURIComponent(url.pathname.split('/').pop());
    const index = db.users.findIndex((entry) => entry.id === userId);

    if (index < 0) {
      sendJson(res, 404, { error: 'User not found.' });
      return;
    }

    const target = db.users[index];
    if (target.email === 'JayBalaji@vemu.org') {
      sendJson(res, 400, { error: 'The initial administrator account cannot be deleted.' });
      return;
    }
    if (db.transactions.some((entry) => entry.userId === target.userId && !entry.returned && entry.status !== 'Lost')) {
      sendJson(res, 409, { error: 'This account has active loans. Return or close them before deleting the user.' });
      return;
    }

    db.users.splice(index, 1);
    db.sessions = db.sessions.filter((entry) => entry.userId !== userId);
    addAudit(db, 'DELETE', admin.user_name, `Deleted account "${target.user_name}"`, 200);
    writeDb(db);
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/overview') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    sendJson(res, 200, buildAdminOverview(db, admin, {
      userSortKey: url.searchParams.get('userSortKey') || 'joined',
      userSortDir: url.searchParams.get('userSortDir') || 'desc',
      refreshReason: url.searchParams.get('refresh') ? 'manual-refresh' : 'load',
    }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/search') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    sendJson(res, 200, buildAdminSearchResults(db, url.searchParams.get('q') || ''));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/reports') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    sendJson(res, 200, buildReportPayload(db, url.searchParams.get('type') || 'user-growth', {
      range: url.searchParams.get('range') || '7d',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
    }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/system/backups') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    sendJson(res, 200, { restorePoints: db.system.restorePoints });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/system/config') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    sendJson(res, 200, { system: db.system });
    return;
  }

  if (req.method === 'PUT' && url.pathname === '/api/system/config') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const body = await parseBody(req);
    const loanPeriodDays = Number(body.loanPeriodDays ?? db.system.loanPeriodDays);
    const maxBooksPerStudent = Number(body.maxBooksPerStudent ?? db.system.maxBooksPerStudent);
    const fineRate = Number(body.fineRate ?? db.system.fineRate);
    const renewalLimit = Number(body.renewalLimit ?? db.system.renewalLimit);
    const auditRetentionDays = Number(body.auditRetentionDays ?? db.system.auditRetentionDays);
    const backupHistoryLimit = Number(body.backupHistoryLimit ?? db.system.backupHistoryLimit);
    const backupSchedule = {
      ...db.system.backupSchedule,
      ...(body.backupSchedule || {}),
    };

    if ([loanPeriodDays, maxBooksPerStudent, fineRate, renewalLimit, auditRetentionDays, backupHistoryLimit].some((value) => Number.isNaN(value) || value < 0)) {
      sendJson(res, 400, { error: 'System settings must use valid non-negative numbers.' });
      return;
    }

    db.system.loanPeriodDays = loanPeriodDays;
    db.system.maxBooksPerStudent = maxBooksPerStudent;
    db.system.fineRate = fineRate;
    db.system.renewalLimit = renewalLimit;
    db.system.auditRetentionDays = auditRetentionDays;
    db.system.backupHistoryLimit = backupHistoryLimit || 12;
    db.system.backupSchedule = {
      daily: Boolean(backupSchedule.daily),
      weekly: Boolean(backupSchedule.weekly),
      monthly: Boolean(backupSchedule.monthly),
    };

    addAudit(db, 'PUT', admin.user_name, 'Updated system configuration', 200);
    writeDb(db);
    sendJson(res, 200, { system: db.system });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/system/backup') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    db.system.lastBackupTime = nowAuditStamp();
    addAudit(db, 'POST', admin.user_name, 'Manual backup completed', 200);
    createBackupSnapshot(db, 'Manual backup');
    writeDb(db);
    sendJson(res, 200, { lastBackupTime: db.system.lastBackupTime, restorePoints: db.system.restorePoints });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/system/restore') {
    const admin = requireAdmin(db, req, res);
    if (!admin) return;
    const body = await parseBody(req);
    const backupId = String(body.backupId || '').trim();
    const token = getToken(req);
    const chosenRestorePoint = findRestorePoint(db, backupId);

    if (!backupId || !chosenRestorePoint) {
      sendJson(res, 404, { error: 'Selected restore point was not found.' });
      return;
    }

    createBackupSnapshot(db, 'Pre-restore backup');
    const restoredDb = readBackupSnapshot(chosenRestorePoint);
    restoredDb.system.restorePoints = [
      ...db.system.restorePoints,
      ...restoredDb.system.restorePoints.filter((item) => !db.system.restorePoints.some((existing) => existing.id === item.id)),
    ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    trimRestorePoints(restoredDb);
    restoredDb.system.lastRestoreTime = nowAuditStamp();
    addAudit(restoredDb, 'POST', admin.user_name, `Restored database from "${chosenRestorePoint.label || chosenRestorePoint.filename}"`, 200);

    if (token) {
      const restoredAdmin = restoredDb.users.find((entry) =>
        entry.id === admin.id ||
        entry.userId === admin.userId ||
        entry.email.toLowerCase() === String(admin.email || '').toLowerCase()
      );
      if (restoredAdmin) {
        restoredDb.sessions = (restoredDb.sessions || []).filter((entry) => entry.token !== token);
        restoredDb.sessions.push({ token, userId: restoredAdmin.id, createdAt: nowIso() });
      }
    }

    writeDb(restoredDb);
    sendJson(res, 200, { success: true, restoredFrom: chosenRestorePoint, system: restoredDb.system });
    return;
  }

  sendJson(res, 404, { error: 'API endpoint not found.' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    serveFile(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Internal server error.' });
  }
});

server.listen(PORT, () => {
  console.log(`Library server running at http://localhost:${PORT}`);
});


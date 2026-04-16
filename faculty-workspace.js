window.__facultyWorkspaceData = window.__facultyWorkspaceData || {
  reserveDraft: null,
  reserveLists: [],
  procurementRequests: [],
  bulkRequests: [],
  departmentRows: [],
  classGroups: [],
  stats: {},
};
window.__facultyModalBookId = '';

let facultyReserveSyncTimer = null;
let facultySearchTimer = null;
let pendingBulkRequest = null;
let selectedBulkClasses = new Set();

function getFacultyWorkspaceData() {
  return window.__facultyWorkspaceData || {
    reserveDraft: null,
    reserveLists: [],
    procurementRequests: [],
    bulkRequests: [],
    departmentRows: [],
    classGroups: [],
    stats: {},
  };
}

function normalizeWorkspaceBook(book) {
  return {
    id: String(book.id || ''),
    title: book.title || 'Catalog Book',
    author: book.author || '',
    category: book.category || 'Catalog',
    type: book.type || 'Textbook',
    edition: book.edition || '-',
    doi: book.doi || book.isbn || '-',
    citationCount: Number(book.citationCount || 0),
    isbn: book.isbn || '-',
    year: book.year || '-',
    avail: Number(book.availCopies ?? book.avail ?? 0),
    total: Number(book.totalCopies ?? book.total ?? 0),
    status: book.status || (Number(book.availCopies || 0) > 0 ? 'Available' : 'Issued'),
    location: book.location || '-',
  };
}

function getReserveDraftItems() {
  return (getFacultyWorkspaceData().reserveDraft?.items || []).map(normalizeWorkspaceBook);
}

function setFacultyWorkspaceData(data) {
  window.__facultyWorkspaceData = data || getFacultyWorkspaceData();
  if (typeof reserveList !== 'undefined') {
    reserveList = getReserveDraftItems();
  }
  const classGroups = getFacultyWorkspaceData().classGroups || [];
  const knownIds = new Set(classGroups.map((entry) => entry.id));
  selectedBulkClasses = new Set(Array.from(selectedBulkClasses).filter((entry) => knownIds.has(entry)));
  syncReserveDraftInputs();
}

async function refreshFacultyPortalOnly() {
  const portalData = await LibraryApp.request('/api/portal-data');
  if (typeof window.__renderFacultyPortal === 'function') window.__renderFacultyPortal(portalData);
  else {
    window.__portalSyncData = portalData;
    window.refreshFacultyShellData();
  }
  return portalData;
}

async function refreshFacultyWorkspace(options = {}) {
  const overview = await LibraryApp.request('/api/faculty/overview');
  setFacultyWorkspaceData(overview);
  if (options.reloadPortal) {
    await refreshFacultyPortalOnly();
  } else if (typeof window.refreshFacultyShellData === 'function') {
    window.refreshFacultyShellData();
  }
  return overview;
}

function syncReserveDraftInputs() {
  const draft = getFacultyWorkspaceData().reserveDraft;
  const courseName = draft?.courseName || '';
  if (typeof byId !== 'function') return;
  if (byId('courseNameInput') && document.activeElement !== byId('courseNameInput')) {
    byId('courseNameInput').value = courseName;
  }
  if (byId('listCourseName')) {
    byId('listCourseName').textContent = courseName ? `Course: ${courseName}` : 'Course: Untitled — Click to name';
  }
  if (byId('pubCourse') && !byId('pubCourse').value) {
    byId('pubCourse').value = courseName;
  }
}

window.getCatalogBooks = function getCatalogBooks() {
  return (getFacultyData().books || []).map(normalizeWorkspaceBook);
};

window.openBookModal = function openBookModal(id) {
  const book = findFacultyBook(id);
  if (!book) {
    window.toast('info', 'Book details are not available yet.', '📘');
    return;
  }
  window.__facultyModalBookId = String(id);
  const availability = typeof book.avail === 'number' ? `${book.avail}/${book.total} copies available` : `Due ${book.due}`;
  byId('bdTitle').textContent = book.title;
  byId('bdBody').innerHTML = `
  <div style="display:flex;gap:16px;margin-bottom:16px">
    ${LibraryApp.renderBookCover(book, { style: 'width:80px;height:106px;border-radius:8px;flex-shrink:0' })}
    <div>
      <div style="font-family:var(--font-d);font-size:1.15rem;font-weight:700;color:var(--ink);margin-bottom:3px">${book.title}</div>
      <div style="font-size:.8rem;color:var(--smoke);margin-bottom:8px">By ${book.author || 'Library Catalog'}</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <span class="pill p-purple">${book.type || book.category || 'Catalog'}</span>
        <span class="pill p-green">${availability}</span>
      </div>
    </div>
  </div>
  <div class="meta-grid">
    <div class="meta-field"><div class="mf-lbl">ISBN / DOI</div><div class="mf-val">${book.doi && book.doi !== '-' ? book.doi : book.isbn}</div></div>
    <div class="meta-field"><div class="mf-lbl">Location</div><div class="mf-val">${book.location || '-'}</div></div>
    <div class="meta-field"><div class="mf-lbl">Edition</div><div class="mf-val">${book.edition || '-'}</div></div>
    <div class="meta-field"><div class="mf-lbl">Citations</div><div class="mf-val">${Number(book.citationCount || 0)}</div></div>
  </div>
`;
  window.openM('bookDetailModal');
};

window.addCurrentModalBookToReserve = async function addCurrentModalBookToReserve() {
  if (!window.__facultyModalBookId) {
    window.toast('err', 'Select a catalog book first.', '❌');
    return;
  }
  await window.addToReserve(window.__facultyModalBookId);
};

window.initSearch = function initSearch() {
  filteredSearch = [...window.getCatalogBooks()];
  window.renderSearchTable(1);
};

window.doAdvSearch = async function doAdvSearch(query) {
  try {
    const params = new URLSearchParams({
      q: String(query ?? byId('boolSearch')?.value ?? '').trim(),
      type: searchType || 'all',
      availability: byId('availOnlyAdv')?.value || 'All Availability',
      sort: byId('sortBy')?.value || 'Relevance',
    });
    const payload = await LibraryApp.request(`/api/faculty/search?${params.toString()}`);
    filteredSearch = (payload.results || []).map(normalizeWorkspaceBook);
    window.renderSearchTable(1);
  } catch (error) {
    window.toast('err', error.message || 'Search could not be completed.', '❌');
  }
};

window.renderSearchTable = function renderSearchTable(page) {
  const tbody = byId('searchTbody');
  if (!tbody) return;
  const perPage = 8;
  const currentPage = page || 1;
  const start = (currentPage - 1) * perPage;
  const rows = filteredSearch.slice(start, start + perPage);
  tbody.innerHTML = rows.length ? rows.map((book) => `
  <tr>
    <td>
      <div style="display:flex;align-items:center;gap:9px">
        ${LibraryApp.renderBookCover(book, { style: 'width:36px;height:48px;border-radius:5px;flex-shrink:0' })}
        <div>
          <div style="font-family:var(--font-d);font-size:.84rem;font-weight:700;color:var(--ink);max-width:200px">${book.title}</div>
          <div style="font-size:.7rem;color:var(--smoke)">${book.author}</div>
        </div>
      </div>
    </td>
    <td><span class="pill p-purple" style="font-size:.6rem">${book.type}</span></td>
    <td style="font-size:.78rem;color:var(--charcoal)">${book.edition || '-'}</td>
    <td style="font-family:var(--font-m);font-size:.65rem;color:var(--smoke)">${book.doi && book.doi !== '-' ? book.doi : book.isbn}</td>
    <td style="font-size:.78rem;font-weight:600;color:var(--P500)">${Number(book.citationCount || 0)}</td>
    <td style="font-size:.78rem;color:var(--smoke)">${book.year}</td>
    <td><span class="pill ${book.avail > 0 ? 'p-green' : 'p-amber'}">${book.avail > 0 ? `${book.avail} available` : 'Waitlist only'}</span></td>
    <td style="text-align:right">
      <div style="display:flex;gap:5px;justify-content:flex-end">
        <button class="btn btn-outline btn-sm btn-icon" onclick="openBookModal('${book.id}')">Info</button>
        <button class="btn btn-purple btn-sm" onclick="addToReserve('${book.id}')">Add</button>
      </div>
    </td>
  </tr>
`).join('') : '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--smoke)">No catalog books matched the current search.</td></tr>';
  normalizeDynamicFacultyActionLabels(tbody);
  if (byId('searchCount')) byId('searchCount').textContent = `Showing ${filteredSearch.length} resource${filteredSearch.length === 1 ? '' : 's'}`;
  if (byId('searchPaginInfo')) {
    const end = Math.min(start + perPage, filteredSearch.length);
    byId('searchPaginInfo').textContent = filteredSearch.length ? `Showing ${start + 1}-${end} of ${filteredSearch.length}` : 'No records';
  }
  renderPgn('searchPagination', currentPage, Math.max(1, Math.ceil(filteredSearch.length / perPage)), renderSearchTable);
};

window.handleSearch = function handleSearch(value) {
  clearTimeout(facultySearchTimer);
  const query = String(value || '').trim();
  if (query.length < 3) return;
  facultySearchTimer = setTimeout(() => {
    const searchNav = document.querySelector('[data-sec=search]');
    if (searchNav) window.nav('search', searchNav);
    if (byId('boolSearch')) byId('boolSearch').value = query;
    window.doAdvSearch(query);
  }, 260);
};

window.renderDept = function renderDept() {
  const tbody = byId('deptTbody');
  if (!tbody) return;
  const query = String(byId('deptSearch')?.value || '').toLowerCase();
  let rows = [...(getFacultyWorkspaceData().departmentRows || [])];
  if (deptTab === 'faculty') rows = rows.filter((entry) => entry.holderRole === 'Faculty');
  if (deptTab === 'student') rows = rows.filter((entry) => entry.holderRole === 'Student');
  if (deptTab === 'overdue') rows = rows.filter((entry) => entry.isOverdue);
  rows = rows.filter((entry) => !query || `${entry.title} ${entry.author} ${entry.holderName}`.toLowerCase().includes(query));
  tbody.innerHTML = rows.length ? rows.map((entry) => `
  <tr>
    <td style="font-family:var(--font-d);font-size:.84rem;font-weight:700;color:var(--ink)">${entry.title}</td>
    <td style="font-size:.78rem">${entry.holderName}</td>
    <td><span class="pill ${entry.holderRole === 'Faculty' ? 'p-purple' : 'p-green'}">${entry.holderRole}</span></td>
    <td style="font-size:.75rem;color:var(--smoke)">${entry.issued}</td>
    <td style="font-size:.75rem;font-weight:600;color:${entry.isOverdue ? 'var(--red)' : 'var(--ink)'}">${entry.due}</td>
    <td style="font-size:.78rem;font-weight:700;color:${entry.isOverdue ? 'var(--red)' : 'var(--ink)'}">${entry.isOverdue ? `${Math.abs(entry.days)}d OD` : `${entry.days}d`}</td>
    <td>${entry.canToggleAutoRenew ? `<label class="toggle"><input type="checkbox" ${entry.autoRenew ? 'checked' : ''} onchange="toggleFacultyAutoRenew('${entry.transactionId}',this.checked)"><span class="ts"></span></label>` : '<span style="font-size:.72rem;color:var(--smoke)">Desk managed</span>'}</td>
    <td><span class="pill ${entry.isOverdue ? 'p-red' : 'p-green'}">${entry.status}</span></td>
  </tr>
`).join('') : '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--smoke)">No live department holding data matches this tab yet.</td></tr>';
  if (byId('deptCount')) byId('deptCount').textContent = `${rows.length} records`;
  if (byId('deptInfo')) byId('deptInfo').textContent = rows.length ? `Showing ${rows.length} live department records` : 'No records available';
};

window.toggleFacultyAutoRenew = async function toggleFacultyAutoRenew(transactionId, enabled) {
  try {
    const payload = await LibraryApp.request('/api/faculty/transactions/auto-renew', {
      method: 'POST',
      body: JSON.stringify({ transactionId, enabled }),
    });
    if (payload.overview) setFacultyWorkspaceData(payload.overview);
    window.refreshFacultyShellData();
    window.toast('ok', `Auto-renew ${enabled ? 'enabled' : 'disabled'} for your faculty loan.`, '⏳');
  } catch (error) {
    window.toast('err', error.message || 'Auto-renew could not be updated.', '❌');
  }
};

window.initReserves = function initReserves() {
  window.filterReserveSearch();
  window.renderReserveList();
  window.renderReserveListsTable();
};

window.filterReserveSearch = function filterReserveSearch() {
  const query = String(byId('reserveSearch')?.value || '').toLowerCase();
  const matches = window.getCatalogBooks().filter((book) => !query || `${book.title} ${book.author} ${book.isbn}`.toLowerCase().includes(query));
  const container = byId('reserveSearchResults');
  if (!container) return;
  container.innerHTML = matches.length ? matches.map((book) => `
  <div class="search-book-item">
    ${LibraryApp.renderBookCover(book, { className: 'sbi-cover' })}
    <div style="flex:1">
      <div class="sbi-title">${book.title}</div>
      <div class="sbi-auth">${book.author}</div>
    </div>
    <div class="sbi-add" onclick="addToReserve('${book.id}')">➕</div>
  </div>
`).join('') : '<div style="padding:18px;color:var(--smoke);text-align:center">No catalog books match this search.</div>';
  normalizeDynamicFacultyActionLabels(container);
};

window.syncReserveDraftName = function syncReserveDraftName(value) {
  if (byId('listCourseName')) {
    byId('listCourseName').textContent = value ? `Course: ${value}` : 'Course: Untitled — Click to name';
  }
  clearTimeout(facultyReserveSyncTimer);
  facultyReserveSyncTimer = setTimeout(async () => {
    try {
      const overview = await LibraryApp.request('/api/faculty/reserves/draft-meta', {
        method: 'POST',
        body: JSON.stringify({ courseName: String(value || '').trim() }),
      });
      setFacultyWorkspaceData(overview);
      window.refreshFacultyShellData();
    } catch (error) {
      window.toast('err', error.message || 'Reserve draft name could not be saved.', '❌');
    }
  }, 280);
};

window.addToReserve = async function addToReserve(id) {
  try {
    const overview = await LibraryApp.request('/api/faculty/reserves/draft-items', {
      method: 'POST',
      body: JSON.stringify({ bookId: id }),
    });
    setFacultyWorkspaceData(overview);
    window.refreshFacultyShellData();
    const book = window.getCatalogBooks().find((entry) => String(entry.id) === String(id));
    window.toast('ok', `Added "${book?.title || 'book'}" to your saved reserve draft.`, '📌');
  } catch (error) {
    window.toast(error.status === 409 ? 'amber' : 'err', error.message || 'Book could not be added to the reserve draft.', error.status === 409 ? '⚠' : '❌');
  }
};

window.renderReserveList = function renderReserveList() {
  const list = byId('reserveList');
  const dropZone = byId('dropZone');
  const items = getReserveDraftItems();
  if (byId('reserveCount')) byId('reserveCount').textContent = `${items.length} book${items.length === 1 ? '' : 's'}`;
  if (!list || !dropZone) return;
  if (!items.length) {
    dropZone.style.display = 'block';
    list.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  dropZone.style.display = 'none';
  list.style.display = 'flex';
  list.innerHTML = items.map((book, index) => `
  <div class="reserve-slot">
    <span class="rs-drag">#</span>
    <div class="rs-num">${index + 1}</div>
    <div class="rs-title">${book.title}</div>
    <button class="rs-remove" onclick="removeFromReserve('${book.id}')">✕</button>
  </div>
`).join('');
};

window.removeFromReserve = async function removeFromReserve(id) {
  try {
    const overview = await LibraryApp.request(`/api/faculty/reserves/draft-items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    setFacultyWorkspaceData(overview);
    window.refreshFacultyShellData();
  } catch (error) {
    window.toast('err', error.message || 'Book could not be removed from the reserve draft.', '❌');
  }
};

window.clearReserve = async function clearReserve() {
  try {
    const overview = await LibraryApp.request('/api/faculty/reserves/clear-draft', { method: 'POST' });
    setFacultyWorkspaceData(overview);
    if (byId('pubCourse')) byId('pubCourse').value = '';
    if (byId('pubNotes')) byId('pubNotes').value = '';
    window.refreshFacultyShellData();
  } catch (error) {
    window.toast('err', error.message || 'Reserve draft could not be cleared.', '❌');
  }
};

window.focusReserveList = function focusReserveList(id) {
  const row = document.querySelector(`[data-reserve-row="${id}"]`);
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.style.background = 'rgba(109,40,217,.08)';
  setTimeout(() => { row.style.background = ''; }, 1600);
};

window.showExistingReserveLists = function showExistingReserveLists() {
  const targetNav = document.querySelector('[data-sec=reserves]');
  if (targetNav) window.nav('reserves', targetNav);
  const rows = (getFacultyWorkspaceData().reserveLists || []).length;
  setTimeout(() => {
    byId('reserveListsTable')?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
  window.toast('info', `${rows} published reserve list${rows === 1 ? '' : 's'} loaded from the database.`, '📋');
};

window.openPublishModal = function openPublishModal() {
  const draft = getFacultyWorkspaceData().reserveDraft;
  if (byId('pubCourse')) byId('pubCourse').value = draft?.courseName || byId('courseNameInput')?.value || '';
  if (byId('pubSemester') && draft?.semester) byId('pubSemester').value = draft.semester;
  if (byId('pubVisibility') && draft?.visibility) byId('pubVisibility').value = draft.visibility;
  if (byId('pubNotes')) byId('pubNotes').value = draft?.notes || '';
  window.openM('publishModal');
};

window.renderReserveListsTable = function renderReserveListsTable() {
  const table = byId('reserveListsTable');
  if (!table) return;
  const workspace = getFacultyWorkspaceData();
  const rows = [];
  if (workspace.reserveDraft?.itemCount) {
    rows.push(`
    <tr data-reserve-row="${workspace.reserveDraft.id}">
      <td style="font-family:var(--font-d);font-size:.84rem;font-weight:700;color:var(--ink)">${workspace.reserveDraft.courseName || 'Draft Course Reserve'}</td>
      <td style="text-align:center">${workspace.reserveDraft.itemCount}</td>
      <td style="text-align:center;font-weight:700;color:var(--P500)">${workspace.reserveDraft.studentAudience}</td>
      <td style="font-size:.75rem;color:var(--smoke)">${workspace.reserveDraft.semester || 'Current session'}</td>
      <td><span class="pill p-amber">Draft</span></td>
      <td style="text-align:right"><button class="btn btn-outline btn-sm" onclick="openPublishModal()">Publish</button></td>
    </tr>
  `);
  }
  (workspace.reserveLists || []).forEach((entry) => {
    rows.push(`
    <tr data-reserve-row="${entry.id}">
      <td style="font-family:var(--font-d);font-size:.84rem;font-weight:700;color:var(--ink)">${entry.courseName}</td>
      <td style="text-align:center">${entry.itemCount}</td>
      <td style="text-align:center;font-weight:700;color:var(--P500)">${entry.studentAudience}</td>
      <td style="font-size:.75rem;color:var(--smoke)">${entry.semester || 'Current session'}</td>
      <td><span class="pill p-green">${entry.status}</span></td>
      <td style="text-align:right"><button class="btn btn-outline btn-sm" onclick="focusReserveList('${entry.id}')">Locate</button></td>
    </tr>
  `);
  });
  table.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--smoke)">No published reserve lists yet.</td></tr>';
};

window.confirmPublish = async function confirmPublish() {
  const courseName = String(byId('pubCourse')?.value || byId('courseNameInput')?.value || '').trim();
  if (!courseName) {
    window.toast('err', 'Please enter a course name first.', '❌');
    return;
  }
  if (!getReserveDraftItems().length) {
    window.toast('err', 'Add at least one book before publishing.', '❌');
    return;
  }
  try {
    const overview = await LibraryApp.request('/api/faculty/reserves/publish', {
      method: 'POST',
      body: JSON.stringify({
        courseName,
        semester: byId('pubSemester')?.value || '',
        visibility: byId('pubVisibility')?.value || '',
        notes: byId('pubNotes')?.value || '',
      }),
    });
    setFacultyWorkspaceData(overview);
    if (byId('pubCourse')) byId('pubCourse').value = '';
    if (byId('pubNotes')) byId('pubNotes').value = '';
    window.closeM('publishModal');
    await refreshFacultyPortalOnly();
    window.toast('ok', `Course reserve "${courseName}" is now published from the database.`, '📢');
  } catch (error) {
    window.toast('err', error.message || 'Reserve list could not be published.', '❌');
  }
};

window.selectBulkBook = function selectBulkBook(id, el) {
  document.querySelectorAll('#bulkSearchResults .search-book-item').forEach((entry) => {
    entry.style.borderColor = '';
    entry.style.background = '';
  });
  if (el) {
    el.style.borderColor = 'var(--P400)';
    el.style.background = 'var(--P-bg)';
  }
  bulkBook = window.getCatalogBooks().find((book) => String(book.id) === String(id)) || null;
  if (!bulkBook) return;
  if (byId('bulkSelectedBook')) byId('bulkSelectedBook').style.display = 'block';
  if (byId('bulkBookTitle')) byId('bulkBookTitle').textContent = bulkBook.title;
  if (byId('bulkBookMeta')) byId('bulkBookMeta').textContent = `${bulkBook.author} - ${bulkBook.avail} copies available`;
};

window.toggleClassSelection = function toggleClassSelection(id, el) {
  if (selectedBulkClasses.has(id)) {
    selectedBulkClasses.delete(id);
    if (el) {
      el.style.borderColor = '';
      el.style.background = '';
    }
  } else {
    selectedBulkClasses.add(id);
    if (el) {
      el.style.borderColor = 'var(--P400)';
      el.style.background = 'var(--P-bg)';
    }
  }
};

window.initBulk = function initBulk() {
  window.filterBulkSearch();
  const container = byId('classListGrid');
  if (!container) return;
  const options = getFacultyWorkspaceData().classGroups || [];
  const history = (getFacultyWorkspaceData().bulkRequests || []).slice(0, 2);
  container.innerHTML = `
  ${options.map((entry) => `
    <div class="search-book-item" onclick="toggleClassSelection('${entry.id}',this)" style="margin-bottom:0">
      <div style="width:34px;height:34px;border-radius:10px;background:rgba(109,40,217,.12);color:var(--P500);display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0">🏫</div>
      <div style="flex:1">
        <div class="sbi-title">${entry.label}</div>
        <div class="sbi-auth">${entry.size} students</div>
      </div>
    </div>
  `).join('')}
  ${history.length ? `<div style="grid-column:1/-1;padding:12px 14px;border:1px dashed var(--border);border-radius:var(--r-md);font-size:.76rem;color:var(--smoke)">Recent request: ${history.map((entry) => `${entry.bookTitle} (${entry.status})`).join(' · ')}</div>` : ''}
`;
};

window.submitBulkRequest = function submitBulkRequest() {
  if (!bulkBook) {
    window.toast('err', 'Please select a catalog book first.', '❌');
    return;
  }
  const copies = Number(byId('bulkCopies')?.value || 0);
  const location = byId('bulkLocation')?.value || '';
  const classGroups = Array.from(selectedBulkClasses);
  if (!copies || !location || !classGroups.length) {
    window.toast('err', 'Select copies, a target location, and at least one class group.', '❌');
    return;
  }
  pendingBulkRequest = {
    bookId: bulkBook.id,
    copies,
    location,
    semester: byId('bulkSemester')?.value || '',
    notes: byId('bulkNotes')?.value || '',
    classGroups,
  };
  const labels = (getFacultyWorkspaceData().classGroups || [])
    .filter((entry) => classGroups.includes(entry.id))
    .map((entry) => entry.label);
  byId('bulkModalBody').innerHTML = `
  <div style="background:var(--P-bg);border:1.5px solid rgba(109,40,217,.2);border-radius:var(--r-lg);padding:16px;margin-bottom:14px">
    <div style="font-family:var(--font-d);font-size:1rem;font-weight:700;color:var(--ink);margin-bottom:8px">${bulkBook.title}</div>
    <div style="font-size:.8rem;color:var(--smoke)">${bulkBook.author}</div>
    <div style="margin-top:10px;font-size:.8rem;color:var(--charcoal)">Requested copies: ${copies} • Delivery: ${location}</div>
    <div style="margin-top:6px;font-size:.8rem;color:var(--charcoal)">Classes: ${labels.join(', ')}</div>
  </div>
  <p style="font-size:.8rem;color:var(--smoke);line-height:1.6">This request will be stored for librarian review and shown in your faculty history.</p>
`;
  window.openM('bulkModal');
};

window.confirmBulk = async function confirmBulk() {
  if (!pendingBulkRequest) {
    window.closeM('bulkModal');
    return;
  }
  try {
    const overview = await LibraryApp.request('/api/faculty/bulk-requests', {
      method: 'POST',
      body: JSON.stringify(pendingBulkRequest),
    });
    setFacultyWorkspaceData(overview);
    pendingBulkRequest = null;
    selectedBulkClasses = new Set();
    if (byId('bulkNotes')) byId('bulkNotes').value = '';
    if (byId('bulkCopies')) byId('bulkCopies').value = '30';
    if (byId('bulkSelectedBook')) byId('bulkSelectedBook').style.display = 'none';
    bulkBook = null;
    window.closeM('bulkModal');
    await refreshFacultyPortalOnly();
    window.toast('ok', 'Bulk issue request submitted and saved for librarian review.', '📦');
  } catch (error) {
    window.toast('err', error.message || 'Bulk request could not be submitted.', '❌');
  }
};

window.renderProc = function renderProc() {
  const list = byId('procRequestsList');
  if (!list) return;
  const requests = getFacultyWorkspaceData().procurementRequests || [];
  list.innerHTML = requests.length ? requests.map((entry) => `
  <div style="padding:14px 16px;border:1px solid var(--border);border-radius:var(--r-lg);margin-bottom:10px;background:#fff">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px">
      <div>
        <div style="font-family:var(--font-d);font-size:.96rem;font-weight:700;color:var(--ink)">${entry.title}</div>
        <div style="font-size:.74rem;color:var(--smoke)">${entry.author} • ${entry.dept || 'Faculty request'}</div>
      </div>
      <span class="pill ${String(entry.status).includes('Approved') ? 'p-green' : 'p-amber'}">${entry.status}</span>
    </div>
    <div style="font-size:.76rem;color:var(--charcoal);line-height:1.55">${entry.reason}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:.72rem;color:var(--smoke)">
      <span>Copies: ${entry.copies}</span>
      <span>Impact: ${entry.impact}</span>
      <span>Requested: ${(entry.createdAt || '').slice(0, 10) || '-'}</span>
    </div>
  </div>
`).join('') : '<div style="padding:18px;border:1px dashed var(--border);border-radius:var(--r-md);color:var(--smoke)">No procurement history is stored for this faculty account yet.</div>';
};

window.submitProc = async function submitProc() {
  const title = String(byId('procTitle')?.value || '').trim();
  const author = String(byId('procAuthor')?.value || '').trim();
  const reason = String(byId('procReason')?.value || '').trim();
  if (!title || !author || !reason) {
    window.toast('err', 'Please complete the procurement title, author, and reason.', '❌');
    return;
  }
  const impact = document.querySelector('.impact-opt.selected .impact-lbl')?.textContent || 'Low';
  try {
    const overview = await LibraryApp.request('/api/faculty/procurements', {
      method: 'POST',
      body: JSON.stringify({
        title,
        author,
        isbn: byId('procIsbn')?.value || '',
        publisher: byId('procPub')?.value || '',
        year: byId('procYear')?.value || '',
        edition: byId('procEdition')?.value || '',
        copies: byId('procCopies')?.value || 1,
        dept: byId('procDept')?.value || '',
        reason,
        impact,
      }),
    });
    setFacultyWorkspaceData(overview);
    window.clearProcForm();
    await refreshFacultyPortalOnly();
    window.toast('ok', `Procurement request for "${title}" has been saved for review.`, '📬');
  } catch (error) {
    window.toast('err', error.message || 'Procurement request could not be submitted.', '❌');
  }
};

window.showFacultyArrivalToast = function showFacultyArrivalToast() {
  document.querySelector('.tb-btn[title="Notifications"]')?.click();
};

window.markFacultyNotificationsRead = async function markFacultyNotificationsRead() {
  try {
    await LibraryApp.request('/api/faculty/notifications/mark-read', { method: 'POST' });
    await refreshFacultyPortalOnly();
    window.toast('ok', 'All faculty notifications were marked as read and saved.', '✅');
  } catch (error) {
    window.toast('err', error.message || 'Notifications could not be updated.', '❌');
  }
};

window.openFacultyStudentPreview = function openFacultyStudentPreview() {
  const searchNav = document.querySelector('[data-sec=search]');
  if (searchNav) window.nav('search', searchNav);
  byId('globalSearch')?.focus();
  window.toast('info', 'Student-style preview opened in the live catalog and reserve sections.', '🎒');
};

window.initActChart = function initActChart() {
  const canvas = byId('actChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const catalog = window.getCatalogBooks();
  const holdings = getFacultyHoldings();
  const workspace = getFacultyWorkspaceData();
  if (typeof facultyChart !== 'undefined' && facultyChart) facultyChart.destroy();
  facultyChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Catalog Titles', 'Faculty Loans', 'Reserve Lists', 'Procurement', 'Bulk Requests'],
      datasets: [{
        label: 'Faculty Workspace Snapshot',
        data: [
          catalog.length,
          holdings.length,
          Number(workspace.stats?.publishedReserveLists || 0) + (workspace.reserveDraft?.itemCount ? 1 : 0),
          Number(workspace.stats?.procurementRequests || 0),
          Number(workspace.stats?.bulkRequests || 0),
        ],
        backgroundColor: ['#7c3aed', '#4f46e5', '#0d9488', '#f59e0b', '#dc2626'],
        borderRadius: 10,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { font: { family: 'Outfit', size: 11 }, usePointStyle: true } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Outfit', size: 10 } } },
        y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Outfit', size: 10 }, precision: 0 } },
      },
    },
  });
};

window.refreshFacultyShellData = function refreshFacultyShellData() {
  const catalog = window.getCatalogBooks();
  const holdings = getFacultyHoldings();
  const notifications = getFacultyData().notifications || [];
  const workspace = getFacultyWorkspaceData();
  const availableCount = catalog.filter((book) => book.avail > 0).length;
  const overdueCount = holdings.filter((book) => Number(book.days) < 0).length;
  const reserveDraftCount = Number(workspace.reserveDraft?.itemCount || 0);
  const publishedReserveCount = Number(workspace.stats?.publishedReserveLists || 0);
  const procurementCount = Number(workspace.procurementRequests?.length || 0);
  const latestProc = workspace.procurementRequests?.[0];

  if (byId('facultyIssuedCount')) byId('facultyIssuedCount').textContent = String(holdings.length);
  if (byId('facultyIssuedChip')) byId('facultyIssuedChip').textContent = overdueCount > 0 ? `${overdueCount} overdue` : 'Live loans';
  if (byId('facultyReserveCount')) byId('facultyReserveCount').textContent = String(reserveDraftCount || publishedReserveCount);
  if (byId('facultyReserveChip')) byId('facultyReserveChip').textContent = reserveDraftCount ? `${reserveDraftCount} in draft` : publishedReserveCount ? `${publishedReserveCount} published` : 'No draft';
  if (byId('facultyProcCount')) byId('facultyProcCount').textContent = String(procurementCount);
  if (byId('facultyProcChip')) byId('facultyProcChip').textContent = latestProc ? latestProc.status : 'No history';
  if (byId('facultyCatalogCount')) byId('facultyCatalogCount').textContent = String(catalog.length);
  if (byId('facultyCatalogChip')) byId('facultyCatalogChip').textContent = `${availableCount} available`;
  if (byId('facultyBookshelfSub')) byId('facultyBookshelfSub').textContent = `${holdings.length} live faculty loan${holdings.length === 1 ? '' : 's'} • Due dates from API`;
  if (byId('facultyArrivalsTitle')) byId('facultyArrivalsTitle').textContent = '🆕 Shared Catalog Snapshot';
  if (byId('facultyArrivalsSub')) byId('facultyArrivalsSub').textContent = `${catalog.length} live catalog title${catalog.length === 1 ? '' : 's'} • Current database snapshot`;
  if (byId('facultyChartTitle')) byId('facultyChartTitle').textContent = '📊 Faculty Workspace Snapshot';
  if (byId('facultyActivityTitle')) byId('facultyActivityTitle').textContent = '📚 Catalog Activity';
  if (byId('facultyActivitySub')) byId('facultyActivitySub').textContent = `${notifications.length} notification${notifications.length === 1 ? '' : 's'} • ${publishedReserveCount} published reserve list${publishedReserveCount === 1 ? '' : 's'}`;

  window.initSearch();
  window.renderDept();
  window.initReserves();
  window.initBulk();
  window.renderProc();
  window.initActChart();
};

function normalizeFacultyChromeLabels() {
  const searchIcon = document.querySelector('.adv-search .si');
  if (searchIcon) searchIcon.innerHTML = '&#128269;';

  const typePills = document.querySelectorAll('.search-type-pills .stp');
  if (typePills[0]) typePills[0].innerHTML = '&#128218; Text';
  if (typePills[1]) typePills[1].innerHTML = '&#128240; Journal';
  if (typePills[2]) typePills[2].innerHTML = '&#128216; Ref';

  const deptChip = document.querySelector('.dept-chip');
  if (deptChip) deptChip.innerHTML = '&#127979; CS Dept Library';

  const arrivalButton = document.querySelector('button.tb-btn[onclick="showFacultyArrivalToast()"]');
  if (arrivalButton) arrivalButton.innerHTML = '&#128276;<span class="ndot"></span>';

  const studentViewButton = document.querySelector('button.tb-btn[onclick="openFacultyStudentPreview()"]');
  if (studentViewButton) studentViewButton.innerHTML = '&#128065; Student View';

  document.querySelectorAll('button').forEach((button) => {
    const label = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    if (label.includes('Request Book Purchase')) {
      button.innerHTML = '&#128722; Request Book Purchase';
    } else if (label.includes('Submit Bulk Issue Request')) {
      button.innerHTML = '&#128230; Submit Bulk Issue Request';
    } else if (label.includes('Preview Student View')) {
      button.innerHTML = '&#128065; Preview Student View';
    } else if (label.includes('My Existing Lists')) {
      button.innerHTML = '&#128203; My Existing Lists';
    } else if (label.includes('Publish List')) {
      button.innerHTML = '&#128227; Publish List';
    }
  });
}

function normalizeDynamicFacultyActionLabels(scope = document) {
  scope.querySelectorAll('.sbi-cover').forEach((entry) => {
    entry.innerHTML = '&#128218;';
  });
  scope.querySelectorAll('.sbi-add').forEach((entry) => {
    entry.innerHTML = '&#128204;';
  });
  scope.querySelectorAll('button').forEach((button) => {
    const label = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    if (label === 'Info') {
      button.innerHTML = '&#128214; Details';
    } else if (label === 'Add') {
      button.innerHTML = '&#128204; Reserve';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  normalizeFacultyChromeLabels();
  normalizeDynamicFacultyActionLabels();
  byId('availOnlyAdv')?.addEventListener('change', () => window.doAdvSearch());
  refreshFacultyWorkspace().catch((error) => {
    console.error(error);
    window.toast('err', error.message || 'Faculty workspace could not be loaded.', '❌');
  });
});

let searchType = 'all';
    let deptTab = 'faculty';
    let reserveList = [];
    let filteredSearch = [];
    let bulkBook = null;
    let facultyChart = null;

    const PAGES = {
      dashboard: { icon: '\u{1F3E0}', title: 'Research Hub', bc: 'Dashboard' },
      reserves: { icon: '\u{1F4DA}', title: 'Course Reserves', bc: 'Reading Lists' },
      search: { icon: '\u{1F50D}', title: 'Advanced Search', bc: 'Shared Catalog' },
      department: { icon: '\u{1F3DB}', title: 'Dept Library', bc: 'Faculty Holdings' },
      bulk: { icon: '\u{1F4E6}', title: 'Bulk Issue', bc: 'Classroom Copies' },
      procurement: { icon: '\u{1F6D2}', title: 'Recommend Purchase', bc: 'Procurement' },
    };

    function byId(id) {
      return document.getElementById(id);
    }

    function getFacultyData() {
      return window.__portalSyncData || { user: {}, books: [], currentBooks: [], notifications: [] };
    }

    function normalizeCatalogBook(book) {
      return {
        id: String(book.id || ''),
        title: book.title || 'Catalog Book',
        author: book.author || '',
        category: book.category || 'Catalog',
        type: book.type || 'Catalog',
        isbn: book.isbn || '-',
        year: book.year || '-',
        avail: Number(book.availCopies ?? 0),
        total: Number(book.totalCopies ?? book.availCopies ?? 0),
        status: book.status || (Number(book.availCopies || 0) > 0 ? 'Available' : 'Issued'),
        location: book.location || '-',
      };
    }

    function normalizeHolding(book) {
      return {
        id: String(book.bookId || book.id || ''),
        title: book.bookTitle || book.title || 'Issued Book',
        author: book.author || '',
        isbn: book.isbn || '-',
        issued: book.checkout || '-',
        due: book.due || '-',
        days: Number(book.dayDiff || 0),
        status: book.isOverdue ? 'Overdue' : 'Active',
      };
    }

    function getCatalogBooks() {
      return (getFacultyData().books || []).map(normalizeCatalogBook);
    }

    function getFacultyHoldings() {
      return (getFacultyData().currentBooks || []).map(normalizeHolding);
    }

    function findFacultyBook(id) {
      return getCatalogBooks().find((book) => String(book.id) === String(id)) ||
        getFacultyHoldings().find((book) => String(book.id) === String(id));
    }

    window.nav = function nav(sec, el) {
      document.querySelectorAll('.sb-item').forEach((item) => item.classList.remove('active'));
      if (el) el.classList.add('active');
      else document.querySelector(`[data-sec="${sec}"]`)?.classList.add('active');
      document.querySelectorAll('.section').forEach((section) => section.classList.remove('active'));
      byId(`sec-${sec}`)?.classList.add('active');
      const page = PAGES[sec] || {};
      if (byId('tbIcon')) byId('tbIcon').textContent = page.icon || '\u{1F4CC}';
      if (byId('tbTitle')) byId('tbTitle').textContent = page.title || sec;
      if (byId('tbBc')) byId('tbBc').textContent = `/ ${page.bc || ''}`;
      if (sec === 'search') initSearch();
      if (sec === 'department') renderDept();
      if (sec === 'reserves') initReserves();
      if (sec === 'procurement') renderProc();
      if (sec === 'bulk') initBulk();
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
      const wrap = byId('toastWrap');
      if (!wrap) return;
      const toastEl = document.createElement('div');
      toastEl.className = `toast toast-${type === 'ok' ? 'ok' : type === 'err' ? 'err' : type === 'amber' ? 'amber' : 'info'}`;
      toastEl.innerHTML = `<span class="ti">${icon}</span><span class="tm">${msg}</span><button class="tc" onclick="this.parentElement.remove()">\u00D7</button>`;
      wrap.appendChild(toastEl);
      setTimeout(() => {
        toastEl.style.opacity = '0';
        toastEl.style.transform = 'translateX(22px)';
        toastEl.style.transition = 'all .28s';
        setTimeout(() => toastEl.remove(), 300);
      }, 5000);
    };

    function renderPgn(cid, cur, total, cb) {
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
          html += '<span style="padding:0 3px;color:var(--ash);font-size:.75rem">...</span>';
        }
      }
      html += `<button class="pgn-btn" ${cur === total ? 'disabled' : ''} onclick="${cb.name}(${cur + 1})">&gt;</button>`;
      container.innerHTML = html;
    }

  function initActChart() {
    const canvas = byId('actChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const catalog = getCatalogBooks();
    const holdings = getFacultyHoldings();
    const availableCount = catalog.filter((book) => book.avail > 0).length;
    const overdueCount = holdings.filter((book) => Number(book.days) < 0).length;
    const notificationCount = (getFacultyData().notifications || []).length;
    if (facultyChart) facultyChart.destroy();
    facultyChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Catalog Titles', 'Issued Books', 'Available Titles', 'Notifications', 'Overdue Books'],
        datasets: [{
          label: 'Faculty Library Snapshot',
          data: [catalog.length, holdings.length, availableCount, notificationCount, overdueCount],
          backgroundColor: ['#7c3aed', '#4f46e5', '#0d9488', '#f59e0b', '#dc2626'],
          borderRadius: 10,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { font: { family: 'Outfit', size: 11 }, usePointStyle: true } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Outfit', size: 10 } } },
          y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Outfit', size: 10 }, precision: 0 } },
          },
        },
      });
    }

    window.openBookModal = function openBookModal(id) {
      const book = findFacultyBook(id);
      if (!book) {
        window.toast('info', 'Book details are not available yet.', '\uD83D\uDCD8');
        return;
      }
      const availability = typeof book.avail === 'number' ? `${book.avail}/${book.total} copies available` : `Due ${book.due}`;
      byId('bdTitle').textContent = book.title;
      byId('bdBody').innerHTML = `
      <div style="display:flex;gap:16px;margin-bottom:16px">
        <div style="width:80px;height:106px;border-radius:8px;flex-shrink:0;background:rgba(109,40,217,.12);color:var(--P500);display:flex;align-items:center;justify-content:center;font-size:1.1rem">\uD83D\uDCD6</div>
        <div>
          <div style="font-family:var(--font-d);font-size:1.15rem;font-weight:700;color:var(--ink);margin-bottom:3px">${book.title}</div>
          <div style="font-size:.8rem;color:var(--smoke);margin-bottom:8px">By ${book.author || 'Library Catalog'}</div>
          <div style="display:flex;gap:7px;flex-wrap:wrap">
            <span class="pill p-purple">${book.category || book.type || 'Catalog'}</span>
            <span class="pill p-green">${availability}</span>
          </div>
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-field"><div class="mf-lbl">ISBN</div><div class="mf-val">${book.isbn}</div></div>
        <div class="meta-field"><div class="mf-lbl">Location</div><div class="mf-val">${book.location || '-'}</div></div>
        <div class="meta-field"><div class="mf-lbl">Year</div><div class="mf-val">${book.year || '-'}</div></div>
        <div class="meta-field"><div class="mf-lbl">Status</div><div class="mf-val">${book.status || 'Catalog'}</div></div>
      </div>
    `;
      window.openM('bookDetailModal');
    };

    window.initSearch = function initSearch() {
      filteredSearch = [...getCatalogBooks()];
      renderSearchTable(1);
    };

    window.doAdvSearch = function doAdvSearch(query) {
      const catalog = getCatalogBooks();
      const rawQuery = String(query || byId('boolSearch')?.value || '').trim().toLowerCase();
      const supportsType = catalog.some((book) => ['textbook', 'journal', 'reference'].includes(String(book.type || '').toLowerCase()));
      filteredSearch = catalog.filter((book) => {
        const haystack = `${book.title} ${book.author} ${book.isbn} ${book.category}`.toLowerCase();
        const queryMatch = !rawQuery || haystack.includes(rawQuery.replace(/"/g, ''));
        const typeMatch = searchType === 'all' || !supportsType || String(book.type || '').toLowerCase() === searchType;
        return queryMatch && typeMatch;
      });
      renderSearchTable(1);
    };

    window.renderSearchTable = function renderSearchTable(page) {
      const tbody = byId('searchTbody');
      if (!tbody) return;
      const perPage = 8;
      const currentPage = page || 1;
      const start = (currentPage - 1) * perPage;
      const rows = filteredSearch.slice(start, start + perPage);
      tbody.innerHTML = rows.length ? rows.map((book) => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:9px">
            <div style="width:36px;height:48px;border-radius:5px;background:rgba(109,40,217,.12);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">\uD83D\uDCD8</div>
            <div>
              <div style="font-family:var(--font-d);font-size:.84rem;font-weight:700;color:var(--ink);max-width:200px">${book.title}</div>
              <div style="font-size:.7rem;color:var(--smoke)">${book.author}</div>
            </div>
          </div>
        </td>
        <td><span class="pill p-purple" style="font-size:.6rem">${book.category}</span></td>
        <td style="font-size:.78rem;color:var(--charcoal)">${book.total || '-'}</td>
        <td style="font-family:var(--font-m);font-size:.65rem;color:var(--smoke)">${book.isbn}</td>
        <td style="font-size:.78rem;font-weight:600;color:var(--P500)">${book.avail}</td>
        <td style="font-size:.78rem;color:var(--smoke)">${book.year}</td>
        <td><span class="pill ${book.avail > 0 ? 'p-green' : 'p-amber'}">${book.status}</span></td>
        <td style="text-align:right">
          <div style="display:flex;gap:5px;justify-content:flex-end">
            <button class="btn btn-outline btn-sm btn-icon" onclick="openBookModal('${book.id}')">Info</button>
            <button class="btn btn-purple btn-sm" onclick="addToReserve('${book.id}')">Add</button>
          </div>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--smoke)">No catalog books found.</td></tr>';
      if (byId('searchCount')) byId('searchCount').textContent = `Showing ${filteredSearch.length} book${filteredSearch.length === 1 ? '' : 's'}`;
      if (byId('searchPaginInfo')) {
        const end = Math.min(start + perPage, filteredSearch.length);
        byId('searchPaginInfo').textContent = filteredSearch.length ? `Showing ${start + 1}-${end} of ${filteredSearch.length}` : 'No records';
      }
      renderPgn('searchPagination', currentPage, Math.max(1, Math.ceil(filteredSearch.length / perPage)), renderSearchTable);
    };

    window.setSearchType = function setSearchType(type, el) {
      searchType = type === 'all' ? 'all' : String(type || '').toLowerCase();
      document.querySelectorAll('.stp').forEach((tab) => tab.classList.remove('active'));
      if (el) el.classList.add('active');
      window.doAdvSearch();
    };

    window.insertBool = function insertBool(op) {
      const input = byId('boolSearch');
      if (!input) return;
      input.value = `${input.value.trim()} ${op} `.trimStart();
      input.focus();
    };

    window.handleSearch = function handleSearch(value) {
      if (String(value || '').length > 2) {
        window.toast('info', `Searching live catalog for \"${value}\".`, '\uD83D\uDD0D');
      }
    };

    window.renderDept = function renderDept() {
      const tbody = byId('deptTbody');
      if (!tbody) return;
      const holdings = getFacultyHoldings();
      const query = String(byId('deptSearch')?.value || '').toLowerCase();
      let rows = holdings.filter((book) => !query || `${book.title} ${book.author}`.toLowerCase().includes(query));
      if (deptTab === 'student') rows = [];
      if (deptTab === 'overdue') rows = rows.filter((book) => Number(book.days) < 0);
      tbody.innerHTML = rows.length ? rows.map((book) => `
      <tr>
        <td style="font-family:var(--font-d);font-size:.84rem;font-weight:700;color:var(--ink)">${book.title}</td>
        <td style="font-size:.78rem">${getFacultyData().user.user_name || 'Faculty Member'}</td>
        <td><span class="pill p-purple">Faculty</span></td>
        <td style="font-size:.75rem;color:var(--smoke)">${book.issued}</td>
        <td style="font-size:.75rem;font-weight:600;color:${Number(book.days) < 0 ? 'var(--red)' : 'var(--ink)'}">${book.due}</td>
        <td style="font-size:.78rem;font-weight:700;color:${Number(book.days) < 0 ? 'var(--red)' : 'var(--ink)'}">${Number(book.days) < 0 ? `${Math.abs(book.days)}d OD` : `${book.days}d`}</td>
        <td><label class="toggle"><input type="checkbox" onchange="toast('info','Auto-renew preferences are not connected yet.','\u23F3')"><span class="ts"></span></label></td>
        <td><span class="pill ${Number(book.days) < 0 ? 'p-red' : 'p-green'}">${book.status}</span></td>
      </tr>
    `).join('') : '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--smoke)">No live department holding data is available for this tab yet.</td></tr>';
      if (byId('deptCount')) byId('deptCount').textContent = `${rows.length} records`;
      if (byId('deptInfo')) byId('deptInfo').textContent = rows.length ? `Showing ${rows.length} live faculty records` : 'No records available';
    };

    window.switchDeptTab = function switchDeptTab(tab, el) {
      deptTab = tab;
      document.querySelectorAll('.dept-tab').forEach((button) => button.classList.remove('active'));
      if (el) el.classList.add('active');
      window.renderDept();
    };

    window.filterDept = function filterDept() {
      window.renderDept();
    };

    window.initReserves = function initReserves() {
      window.filterReserveSearch();
      window.renderReserveList();
      window.renderReserveListsTable();
    };

    window.filterReserveSearch = function filterReserveSearch() {
      const query = String(byId('reserveSearch')?.value || '').toLowerCase();
      const matches = getCatalogBooks().filter((book) => !query || `${book.title} ${book.author}`.toLowerCase().includes(query));
      const container = byId('reserveSearchResults');
      if (!container) return;
      container.innerHTML = matches.length ? matches.map((book) => `
      <div class="search-book-item">
        <div class="sbi-cover" style="background:rgba(109,40,217,.12);color:var(--P500)">\uD83D\uDCDA</div>
        <div style="flex:1">
          <div class="sbi-title">${book.title}</div>
          <div class="sbi-auth">${book.author}</div>
        </div>
        <div class="sbi-add" onclick="addToReserve('${book.id}')">\u2795</div>
      </div>
    `).join('') : '<div style="padding:18px;color:var(--smoke);text-align:center">No catalog books match this search.</div>';
    };

    window.addToReserve = function addToReserve(id) {
      const book = getCatalogBooks().find((entry) => String(entry.id) === String(id));
      if (!book) return;
      if (reserveList.some((entry) => entry.id === book.id)) {
        window.toast('amber', 'This book is already in the reserve draft.', '\u26A0');
        return;
      }
      reserveList.push(book);
      window.renderReserveList();
      window.toast('ok', `Added \"${book.title}\" to the reserve draft.`, '\uD83D\uDCCC');
    };

    window.renderReserveList = function renderReserveList() {
      const list = byId('reserveList');
      const dropZone = byId('dropZone');
      if (byId('reserveCount')) byId('reserveCount').textContent = `${reserveList.length} book${reserveList.length === 1 ? '' : 's'}`;
      if (!list || !dropZone) return;
      if (!reserveList.length) {
        dropZone.style.display = 'block';
        list.style.display = 'none';
        list.innerHTML = '';
        return;
      }
      dropZone.style.display = 'none';
      list.style.display = 'flex';
      list.innerHTML = reserveList.map((book, index) => `
      <div class="reserve-slot">
        <span class="rs-drag">#</span>
        <div class="rs-num">${index + 1}</div>
        <div class="rs-title">${book.title}</div>
        <button class="rs-remove" onclick="removeFromReserve('${book.id}')">\u2715</button>
      </div>
    `).join('');
    };

    window.removeFromReserve = function removeFromReserve(id) {
      reserveList = reserveList.filter((book) => String(book.id) !== String(id));
      window.renderReserveList();
    };

    window.clearReserve = function clearReserve() {
      reserveList = [];
      if (byId('courseNameInput')) byId('courseNameInput').value = '';
      if (byId('listCourseName')) byId('listCourseName').textContent = 'Course: Untitled - Click to name';
      window.renderReserveList();
      window.renderReserveListsTable();
    };

    window.renderReserveListsTable = function renderReserveListsTable() {
      const table = byId('reserveListsTable');
      if (!table) return;
      table.innerHTML = reserveList.length ? `
      <tr>
        <td style="font-family:var(--font-d);font-size:.84rem;font-weight:700;color:var(--ink)">${byId('courseNameInput')?.value || 'Draft Course Reserve'}</td>
        <td style="text-align:center">${reserveList.length}</td>
        <td style="text-align:center;font-weight:700;color:var(--P500)">Draft</td>
        <td style="font-size:.75rem;color:var(--smoke)">Current session</td>
        <td><span class="pill p-amber">Draft</span></td>
        <td style="text-align:right"><button class="btn btn-outline btn-sm" onclick="openM('publishModal')">Publish</button></td>
      </tr>
    ` : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--smoke)">No published reserve lists yet.</td></tr>';
    };

    window.initBulk = function initBulk() {
      if (byId('classListGrid')) {
        byId('classListGrid').innerHTML = '<div style="padding:18px;border:1px dashed var(--border);border-radius:var(--r-md);color:var(--smoke)">Class roster data is not connected yet. You can still draft a bulk issue request.</div>';
      }
      window.filterBulkSearch();
    };

    window.filterBulkSearch = function filterBulkSearch() {
      const query = String(byId('bulkBookSearch')?.value || '').toLowerCase();
      const matches = getCatalogBooks().filter((book) => !query || `${book.title} ${book.author}`.toLowerCase().includes(query)).slice(0, 6);
      const container = byId('bulkSearchResults');
      if (!container) return;
      container.innerHTML = matches.length ? matches.map((book) => `
      <div class="search-book-item" onclick="selectBulkBook('${book.id}',this)" style="margin-bottom:0">
        <div style="width:32px;height:42px;border-radius:5px;flex-shrink:0;background:rgba(109,40,217,.12);display:flex;align-items:center;justify-content:center;font-size:1rem">\uD83D\uDCD8</div>
        <div style="flex:1">
          <div class="sbi-title">${book.title}</div>
          <div class="sbi-auth">${book.author} - ${book.avail} copies available</div>
        </div>
      </div>
    `).join('') : '<div style="padding:16px;color:var(--smoke)">No catalog books found.</div>';
    };

    window.selectBulkBook = function selectBulkBook(id, el) {
      document.querySelectorAll('#bulkSearchResults .search-book-item').forEach((entry) => {
        entry.style.borderColor = '';
        entry.style.background = '';
      });
      if (el) {
        el.style.borderColor = 'var(--P400)';
        el.style.background = 'var(--P-bg)';
      }
      bulkBook = getCatalogBooks().find((book) => String(book.id) === String(id)) || null;
      if (!bulkBook) return;
      if (byId('bulkSelectedBook')) byId('bulkSelectedBook').style.display = 'block';
      if (byId('bulkBookTitle')) byId('bulkBookTitle').textContent = bulkBook.title;
      if (byId('bulkBookMeta')) byId('bulkBookMeta').textContent = `${bulkBook.author} - ${bulkBook.avail} copies available`;
    };

    window.submitBulkRequest = function submitBulkRequest() {
      if (!bulkBook) {
        window.toast('err', 'Please select a catalog book first.', '\u274C');
        return;
      }
      const copies = byId('bulkCopies')?.value;
      const location = byId('bulkLocation')?.value;
      if (!copies || !location) {
        window.toast('err', 'Fill in all required bulk issue fields.', '\u274C');
        return;
      }
      byId('bulkModalBody').innerHTML = `
      <div style="background:var(--P-bg);border:1.5px solid rgba(109,40,217,.2);border-radius:var(--r-lg);padding:16px;margin-bottom:14px">
        <div style="font-family:var(--font-d);font-size:1rem;font-weight:700;color:var(--ink);margin-bottom:8px">${bulkBook.title}</div>
        <div style="font-size:.8rem;color:var(--smoke)">${bulkBook.author}</div>
        <div style="margin-top:10px;font-size:.8rem;color:var(--charcoal)">Requested copies: ${copies} - Delivery: ${location}</div>
      </div>
      <p style="font-size:.8rem;color:var(--smoke);line-height:1.6">This request is a live-data draft. Class roster allocation still needs backend support.</p>
    `;
      window.openM('bulkModal');
    };

    window.confirmBulk = function confirmBulk() {
      window.closeM('bulkModal');
      window.toast('ok', 'Bulk issue request drafted for librarian review.', '\uD83D\uDCE6');
    };

    window.renderProc = function renderProc() {
      const list = byId('procRequestsList');
      if (!list) return;
      list.innerHTML = '<div style="padding:18px;border:1px dashed var(--border);border-radius:var(--r-md);color:var(--smoke)">No live procurement history is available yet.</div>';
    };

    window.selectImpact = function selectImpact(el) {
      document.querySelectorAll('.impact-opt').forEach((option) => option.classList.remove('selected'));
      if (el) el.classList.add('selected');
    };

    window.submitProc = function submitProc() {
      const title = String(byId('procTitle')?.value || '').trim();
      const reason = String(byId('procReason')?.value || '').trim();
      if (!title || !reason) {
        window.toast('err', 'Please complete the procurement title and reason.', '\u274C');
        return;
      }
      const impact = document.querySelector('.impact-opt.selected .impact-lbl')?.textContent || 'Low';
      window.toast('ok', `Procurement request for \"${title}\" submitted with ${impact} impact.`, '\uD83D\uDCEC');
      window.clearProcForm();
    };

    window.clearProcForm = function clearProcForm() {
      ['procTitle', 'procAuthor', 'procIsbn', 'procPub', 'procYear', 'procEdition', 'procReason'].forEach((id) => {
        if (byId(id)) byId(id).value = '';
      });
      if (byId('procCopies')) byId('procCopies').value = '3';
      document.querySelectorAll('.impact-opt').forEach((option, index) => option.classList.toggle('selected', index === 0));
    };

    window.confirmPublish = function confirmPublish() {
      const course = String(byId('pubCourse')?.value || '').trim();
      if (!course) {
        window.toast('err', 'Please enter a course name first.', '\u274C');
        return;
      }
      if (!reserveList.length) {
        window.toast('err', 'Add at least one book before publishing.', '\u274C');
        return;
      }
      window.closeM('publishModal');
      window.toast('ok', `Course reserve \"${course}\" published with ${reserveList.length} books.`, '\uD83D\uDCE2');
      window.clearReserve();
    };

    window.showFacultyArrivalToast = function showFacultyArrivalToast() {
      const catalogCount = getCatalogBooks().length;
      window.toast('info', `${catalogCount} live catalog title${catalogCount === 1 ? '' : 's'} loaded for the faculty dashboard.`, '\uD83D\uDD14');
    };

    window.markFacultyNotificationsRead = function markFacultyNotificationsRead() {
      const data = getFacultyData();
      data.notifications = (data.notifications || []).map((item) => ({ ...item, unread: false }));
      if (typeof window.__renderFacultyPortal === 'function') window.__renderFacultyPortal(data);
      window.toast('ok', 'All faculty notifications marked as read.', '\u2705');
    };

    window.refreshFacultyShellData = function refreshFacultyShellData() {
      const catalog = getCatalogBooks();
      const holdings = getFacultyHoldings();
      const notifications = getFacultyData().notifications || [];
      const availableCount = catalog.filter((book) => book.avail > 0).length;
      const overdueCount = holdings.filter((book) => Number(book.days) < 0).length;

      if (byId('facultyIssuedCount')) byId('facultyIssuedCount').textContent = String(holdings.length);
      if (byId('facultyIssuedChip')) byId('facultyIssuedChip').textContent = overdueCount > 0 ? `${overdueCount} overdue` : 'Live loans';
      if (byId('facultyReserveCount')) byId('facultyReserveCount').textContent = String(reserveList.length);
      if (byId('facultyReserveChip')) byId('facultyReserveChip').textContent = reserveList.length ? `${reserveList.length} draft` : 'Draft only';
      if (byId('facultyProcCount')) byId('facultyProcCount').textContent = '0';
      if (byId('facultyProcChip')) byId('facultyProcChip').textContent = 'No history';
      if (byId('facultyCatalogCount')) byId('facultyCatalogCount').textContent = String(catalog.length);
      if (byId('facultyCatalogChip')) byId('facultyCatalogChip').textContent = `${availableCount} available`;
      if (byId('facultyBookshelfSub')) byId('facultyBookshelfSub').textContent = `${holdings.length} live faculty loan${holdings.length === 1 ? '' : 's'} · Due dates from API`;
      if (byId('facultyArrivalsTitle')) byId('facultyArrivalsTitle').textContent = '🆕 Shared Catalog Snapshot';
      if (byId('facultyArrivalsSub')) byId('facultyArrivalsSub').textContent = `${catalog.length} live catalog title${catalog.length === 1 ? '' : 's'} · Current database snapshot`;
      if (byId('facultyChartTitle')) byId('facultyChartTitle').textContent = '📊 Faculty Library Snapshot';
      if (byId('facultyActivityTitle')) byId('facultyActivityTitle').textContent = '📚 Catalog Activity';
      if (byId('facultyActivitySub')) byId('facultyActivitySub').textContent = `${notifications.length} notification${notifications.length === 1 ? '' : 's'} · Titles ranked by available copies`;

      initSearch();
      renderDept();
      initReserves();
      initBulk();
      renderProc();
      initActChart();
    };

    document.addEventListener('DOMContentLoaded', () => {
      window.refreshFacultyShellData();
    });
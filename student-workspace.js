window.__studentPendingReservationBookId = '';
window.__studentPendingRenewTransactionId = '';
window.__studentPendingFineTransactionId = '';

async function refreshStudentPortalOnly() {
  const portalData = await LibraryApp.request('/api/portal-data');
  if (typeof window.__renderStudentPortal === 'function') window.__renderStudentPortal(portalData);
  else window.__portalSyncData = portalData;
  if (typeof window.renderStudentFinesSection === 'function') window.renderStudentFinesSection();
  if (typeof window.renderStudentActivitySection === 'function') window.renderStudentActivitySection();
  return portalData;
}

function getStudentWorkspaceData() {
  return getStudentData();
}

function getOutstandingFineTransactions() {
  return (getStudentWorkspaceData().transactions || []).filter((item) => {
    const fine = Number(item.fine || 0);
    return fine > 0 && !['Paid', 'Waived', 'Clear'].includes(String(item.fineStatus || ''));
  });
}

function findStudentTransaction(transactionId) {
  return (getStudentWorkspaceData().transactions || []).find((item) => String(item.id) === String(transactionId)) || null;
}

function setReserveModalFooter(confirmLabel) {
  const footer = byId('reserveModalFtr');
  if (!footer) return;
  footer.innerHTML = `
    <button class="btn btn-outline" onclick="closeM('reserveModal')">Close</button>
    <button class="btn btn-violet" onclick="confirmStudentReservation()">${confirmLabel}</button>
  `;
}

window.requestBook = function requestBook(id) {
  const book = findLiveBook(id);
  if (!book) {
    window.toast('err', 'Book request could not be prepared.', '\u274C');
    return;
  }
  const isAvailable = Number(book.availCopies || 0) > 0;
  window.__studentPendingReservationBookId = String(book.id);
  if (byId('reserveModalTitle')) {
    byId('reserveModalTitle').textContent = isAvailable ? '📚 Confirm Pickup Request' : '⏳ Confirm Waitlist';
  }
  byId('reserveModalBody').innerHTML = `
    <div style="background:${isAvailable ? 'var(--emerald-bg)' : 'var(--amber-bg)'};border:1px solid ${isAvailable ? 'rgba(16,185,129,.2)' : 'rgba(245,158,11,.25)'};border-radius:var(--r-xl);padding:18px;text-align:center;margin-bottom:14px">
      <div style="font-family:var(--font-d);font-size:1.05rem;font-weight:700;color:var(--ink);margin-bottom:4px">${isAvailable ? 'Pickup Request' : 'Waitlist Request'}</div>
      <div style="font-size:.82rem;color:var(--txt-3)">${isAvailable ? 'This will save a real pickup request for the library desk.' : 'This will save your place in the live waitlist queue for this title.'}</div>
    </div>
    <div style="background:var(--bg);border-radius:var(--r-lg);padding:14px 16px;border:1px solid var(--border)">
      <div style="font-size:.88rem;font-weight:700;color:var(--ink)">${book.title}</div>
      <div style="font-size:.75rem;color:var(--txt-3)">${book.author || 'Library Catalog'}</div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <span class="pill p-violet">Shelf: ${book.location}</span>
        <span class="pill ${isAvailable ? 'p-green' : 'p-amber'}">${isAvailable ? `${book.availCopies} copies available` : 'Join waitlist'}</span>
      </div>
    </div>
  `;
  setReserveModalFooter(isAvailable ? '📥 Save Pickup Request' : '⏳ Join Waitlist');
  window.openM('reserveModal');
};

window.confirmStudentReservation = async function confirmStudentReservation() {
  if (!window.__studentPendingReservationBookId) {
    window.closeM('reserveModal');
    return;
  }
  try {
    const payload = await LibraryApp.request('/api/student/reservations', {
      method: 'POST',
      body: JSON.stringify({ bookId: window.__studentPendingReservationBookId }),
    });
    window.__studentPendingReservationBookId = '';
    window.closeM('reserveModal');
    if (payload.portal && typeof window.__renderStudentPortal === 'function') {
      window.__renderStudentPortal(payload.portal);
      if (typeof window.renderStudentFinesSection === 'function') window.renderStudentFinesSection();
    } else {
      await refreshStudentPortalOnly();
    }
    window.toast('ok', payload.request.type === 'Waitlist' ? 'Waitlist request saved to the database.' : 'Pickup request saved to the database.', payload.request.type === 'Waitlist' ? '⏳' : '📥');
  } catch (error) {
    window.toast(error.status === 409 ? 'amber' : 'err', error.message || 'Book request could not be saved.', error.status === 409 ? '⚠' : '❌');
  }
};

window.openRenew = function openRenew(index) {
  const currentBooks = getStudentWorkspaceData().currentBooks || [];
  const book = currentBooks[index] || currentBooks[0];
  if (!book) {
    window.toast('info', 'No issued books are available for renewal.', '\uD83D\uDCD8');
    return;
  }
  window.__studentPendingRenewTransactionId = String(book.id || book.transactionId || '');
  const dueDate = new Date(book.due);
  if (!Number.isNaN(dueDate.getTime())) {
    dueDate.setDate(dueDate.getDate() + 14);
  }
  byId('renewBody').innerHTML = `
    <div style="background:var(--violet-bg);border:1.5px solid rgba(109,40,217,.2);border-radius:var(--r-lg);padding:16px;margin-bottom:14px">
      <div style="font-size:.88rem;font-weight:700;color:var(--ink);margin-bottom:2px">${book.bookTitle || book.title}</div>
      <div style="font-size:.75rem;color:var(--txt-3)">Current due: <strong style="color:var(--rose)">${book.due || 'Pending'}</strong></div>
      <div style="font-size:.75rem;color:var(--violet-2);margin-top:4px;font-weight:600">Requested due date: ${Number.isNaN(dueDate.getTime()) ? 'Pending librarian approval' : dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
    </div>
    <p style="font-size:.8rem;color:var(--txt-3);line-height:1.6;margin-bottom:10px">
      This will save a real renewal request for librarian approval.
    </p>
  `;
  window.openM('renewModal');
};

window.confirmRenew = async function confirmRenew() {
  if (!window.__studentPendingRenewTransactionId) {
    window.closeM('renewModal');
    return;
  }
  try {
    const payload = await LibraryApp.request('/api/student/transactions/renew', {
      method: 'POST',
      body: JSON.stringify({ transactionId: window.__studentPendingRenewTransactionId }),
    });
    window.__studentPendingRenewTransactionId = '';
    window.closeM('renewModal');
    if (payload.portal && typeof window.__renderStudentPortal === 'function') {
      window.__renderStudentPortal(payload.portal);
      if (typeof window.renderStudentFinesSection === 'function') window.renderStudentFinesSection();
    } else {
      await refreshStudentPortalOnly();
    }
    window.toast('ok', 'Renewal request recorded in the database.', '🔄');
  } catch (error) {
    window.toast(error.status === 409 ? 'amber' : 'err', error.message || 'Renewal request could not be saved.', error.status === 409 ? '⚠' : '❌');
  }
};

window.openPayFine = function openPayFine(transactionId) {
  const transaction = findStudentTransaction(transactionId);
  if (!transaction) {
    window.toast('err', 'No outstanding fine is available for payment.', '❌');
    return;
  }
  window.__studentPendingFineTransactionId = String(transaction.id);
  if (byId('payAmountText')) byId('payAmountText').textContent = String(Number(transaction.fine || 0).toFixed(0));
  if (byId('payReasonText')) {
    const reason = transaction.isOverdue ? `${Math.abs(Number(transaction.dayDiff || 0))} days overdue` : 'Outstanding library fine';
    byId('payReasonText').textContent = `For: ${transaction.bookTitle || transaction.bookTitle || 'Library fine'} · ${reason}`;
  }
  if (byId('payConfirmBtn')) byId('payConfirmBtn').textContent = `💳 Submit ₹${Number(transaction.fine || 0).toFixed(0)} Request`;
  if (byId('payReference')) byId('payReference').value = '';
  window.openM('payModal');
};

window.confirmPay = async function confirmPay() {
  if (!window.__studentPendingFineTransactionId) {
    window.closeM('payModal');
    return;
  }
  try {
    const payload = await LibraryApp.request('/api/student/fine-payments', {
      method: 'POST',
      body: JSON.stringify({
        transactionId: window.__studentPendingFineTransactionId,
        paymentMethod: byId('payMethod')?.value || '',
        reference: byId('payReference')?.value || '',
      }),
    });
    window.__studentPendingFineTransactionId = '';
    window.closeM('payModal');
    if (payload.portal && typeof window.__renderStudentPortal === 'function') {
      window.__renderStudentPortal(payload.portal);
    } else {
      await refreshStudentPortalOnly();
    }
    if (typeof window.renderStudentFinesSection === 'function') window.renderStudentFinesSection();
    window.toast('ok', 'Fine payment request submitted for verification.', '💳');
  } catch (error) {
    window.toast(error.status === 409 ? 'amber' : 'err', error.message || 'Fine payment request could not be saved.', error.status === 409 ? '⚠' : '❌');
  }
};

window.markAllRead = async function markAllRead() {
  try {
    await LibraryApp.request('/api/student/notifications/mark-read', { method: 'POST' });
    await refreshStudentPortalOnly();
    window.toast('ok', 'All notifications marked as read.', '✅');
  } catch (error) {
    window.toast('err', error.message || 'Notifications could not be updated.', '❌');
  }
};

window.handleGS = function handleGS(value) {
  clearTimeout(window.__studentSearchTimer);
  const query = String(value || '').trim();
  if (query.length < 2) return;
  window.__studentSearchTimer = setTimeout(async () => {
    try {
      const payload = await LibraryApp.request(`/api/student/search?q=${encodeURIComponent(query)}`);
      const discoverNav = document.querySelector('[data-sec=discover]');
      if (discoverNav) window.nav('discover', discoverNav);
      setTimeout(() => {
        if (byId('discoverSearch')) {
          byId('discoverSearch').value = query;
          if (typeof window.filterDiscover === 'function') window.filterDiscover();
        }
      }, 120);
      window.toast('info', `${payload.total} live catalog result${payload.total === 1 ? '' : 's'} matched "${query}".`, '🔍');
    } catch (error) {
      window.toast('err', error.message || 'Search could not be completed.', '❌');
    }
  }, 220);
};

window.downloadStudentCard = function downloadStudentCard() {
  window.print();
};

window.renderStudentActivitySection = function renderStudentActivitySection() {
  const data = getStudentWorkspaceData();
  const notifications = data.notifications || [];
  const timeline = byId('fullTimeline');
  if (timeline) {
    timeline.innerHTML = notifications.map((item) => `
      <div class="tline-item">
        <div class="tline-dot ${item.unread ? 'unread' : ''}">${item.icon}</div>
        <div class="tline-body">
          <div class="tline-msg">${LibraryApp.escapeHtml(item.text)}</div>
          <div class="tline-meta">${LibraryApp.escapeHtml(item.ts || '')}</div>
        </div>
      </div>
    `).join('');
  }
};

window.renderStudentFinesSection = function renderStudentFinesSection() {
  const data = getStudentWorkspaceData();
  const outstanding = getOutstandingFineTransactions();
  const paymentRequests = data.paymentRequests || [];
  const submittedPayments = paymentRequests.filter((entry) => entry.status === 'Submitted for Verification');
  const outstandingTotal = outstanding.reduce((sum, item) => sum + Number(item.fine || 0), 0);
  const paidTotal = paymentRequests
    .filter((entry) => ['Verified', 'Paid'].includes(String(entry.status || '')))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  if (byId('fineSummaryAmount')) {
    byId('fineSummaryAmount').textContent = `₹${outstandingTotal.toFixed(2)}`;
    byId('fineSummaryAmount').style.color = outstandingTotal > 0 ? 'var(--rose)' : 'var(--emerald)';
  }
  if (byId('fineSummaryStatus')) {
    byId('fineSummaryStatus').textContent = outstandingTotal > 0
      ? `⚠ ${outstanding.length} outstanding fine item${outstanding.length === 1 ? '' : 's'}`
      : '✅ Account in good standing';
    byId('fineSummaryStatus').style.color = outstandingTotal > 0 ? 'var(--rose)' : 'var(--emerald)';
  }
  if (byId('fineSummaryBanner')) {
    byId('fineSummaryBanner').textContent = outstandingTotal > 0
      ? submittedPayments.length
        ? `${submittedPayments.length} payment request${submittedPayments.length === 1 ? '' : 's'} submitted for verification.`
        : 'Outstanding fines are live from the database. Submit a payment request or visit the library desk.'
      : 'You have no pending fines. Keep returning books on time to maintain your borrowing privileges!';
    byId('fineSummaryBanner').style.background = outstandingTotal > 0 ? 'var(--rose-bg)' : 'var(--emerald-bg)';
    byId('fineSummaryBanner').style.borderColor = outstandingTotal > 0 ? 'rgba(244,63,94,.2)' : 'rgba(16,185,129,.2)';
    byId('fineSummaryBanner').style.color = outstandingTotal > 0 ? 'var(--rose)' : '#059669';
  }
  if (byId('fineActionRow')) {
    byId('fineActionRow').innerHTML = outstanding.length
      ? `<button class="btn btn-violet" onclick="openPayFine('${outstanding[0].id}')">💳 Submit Payment Request</button>`
      : '';
  }
  if (byId('paidSemesterTotal')) {
    byId('paidSemesterTotal').textContent = `₹${paidTotal.toFixed(0)}`;
  }
  if (byId('payHistoryTbody')) {
    const rows = [
      ...paymentRequests.map((entry) => `
        <tr>
          <td style="font-size:.78rem;color:var(--txt-3)">${LibraryApp.escapeHtml((entry.createdAt || '').slice(0, 10) || '-')}</td>
          <td style="font-size:.82rem;font-weight:600;color:var(--ink)">${LibraryApp.escapeHtml(entry.bookTitle || '-')}</td>
          <td style="font-size:.78rem;color:var(--txt-3)">Student payment request</td>
          <td style="font-size:.82rem;font-weight:700;color:var(--rose)">₹${Number(entry.amount || 0).toFixed(0)}</td>
          <td style="font-size:.76rem;color:var(--txt-3)">${LibraryApp.escapeHtml(entry.paymentMethod || '-')}</td>
          <td style="font-size:.76rem;color:${entry.status === 'Submitted for Verification' ? 'var(--amber)' : 'var(--emerald)'}">${LibraryApp.escapeHtml(entry.status || 'Submitted')}</td>
        </tr>
      `),
      ...outstanding
        .filter((item) => !paymentRequests.some((entry) => String(entry.transactionId) === String(item.id)))
        .map((item) => `
          <tr>
            <td style="font-size:.78rem;color:var(--txt-3)">${LibraryApp.escapeHtml(item.returned || item.checkout || '-')}</td>
            <td style="font-size:.82rem;font-weight:600;color:var(--ink)">${LibraryApp.escapeHtml(item.bookTitle || '-')}</td>
            <td style="font-size:.78rem;color:var(--txt-3)">${item.returned ? 'Returned late' : 'Active fine'}</td>
            <td style="font-size:.82rem;font-weight:700;color:var(--rose)">₹${Number(item.fine || 0).toFixed(0)}</td>
            <td style="font-size:.76rem;color:var(--txt-3)">Pending</td>
            <td style="font-size:.76rem;color:var(--rose)">Outstanding</td>
          </tr>
        `),
    ];
    byId('payHistoryTbody').innerHTML = rows.length
      ? rows.join('')
      : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--txt-3)">No fine records in the database yet.</td></tr>';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.renderStudentFinesSection();
});

$ErrorActionPreference = 'Stop'
$path = 'admin-app.js'
$content = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::GetEncoding(1252))
function ReplaceExact([string]$old, [string]$new) { $script:content = $script:content.Replace($old, $new) }

$symHome = [char]::ConvertFromUtf32(0x1F3E0)
$symUsers = [char]::ConvertFromUtf32(0x1F465)
$symBooks = [char]::ConvertFromUtf32(0x1F4DA)
$symSync = [char]::ConvertFromUtf32(0x1F504)
$symChart = [char]::ConvertFromUtf32(0x1F4CA)
$symGear = [string][char]0x2699
$symAudit = [char]::ConvertFromUtf32(0x1F9FE)
$symPin = [char]::ConvertFromUtf32(0x1F4CC)
$symWarn = [string][char]0x26A0
$symInfo = [string][char]0x2139
$symEmpty = [char]::ConvertFromUtf32(0x1F4ED)
$symEdit = [string][char]0x270F
$symPause = [string][char]0x23F8
$symCheck = [char]::ConvertFromUtf32(0x2705)
$symTrash = [char]::ConvertFromUtf32(0x1F5D1)
$symLock = [char]::ConvertFromUtf32(0x1F512)
$symSecure = [char]::ConvertFromUtf32(0x1F510)
$symUser = [char]::ConvertFromUtf32(0x1F464)
$symBlueBook = [char]::ConvertFromUtf32(0x1F4D8)
$symView = [char]::ConvertFromUtf32(0x1F441)
$symSave = [char]::ConvertFromUtf32(0x1F4BE)
$symOpenBook = [char]::ConvertFromUtf32(0x1F4D6)
$symTrophy = [char]::ConvertFromUtf32(0x1F3C6)
$symScales = [string][char]0x2696
$symExport = [char]::ConvertFromUtf32(0x1F4E4)
$symShield = [char]::ConvertFromUtf32(0x1F6E1)
$symClock = [string][char]0x23F0
$symSearch = [char]::ConvertFromUtf32(0x1F50E)
$symTimes = [string][char]0x00D7
$symBullet = [string][char]0x2022
$symRupee = [string][char]0x20B9
$symMenu = [string][char]0x22EE

ReplaceExact "dashboard: ['C:\Users\chitr', 'Dashboard', '/ Overview']," "dashboard: ['$symHome', 'Dashboard', '/ Overview'],"
ReplaceExact "dashboard: ['??', 'Dashboard', '/ Overview']," "dashboard: ['$symHome', 'Dashboard', '/ Overview'],"
ReplaceExact "users: ['??', 'User Management', '/ Accounts & Roles']," "users: ['$symUsers', 'User Management', '/ Accounts & Roles'],"
ReplaceExact "inventory: ['??', 'Library Inventory', '/ Books & Resources']," "inventory: ['$symBooks', 'Library Inventory', '/ Books & Resources'],"
ReplaceExact "transactions: ['??', 'Transactions', '/ Loans & Returns']," "transactions: ['$symSync', 'Transactions', '/ Loans & Returns'],"
ReplaceExact "reports: ['??', 'Reports & Analytics', '/ Insights']," "reports: ['$symChart', 'Reports & Analytics', '/ Insights'],"
ReplaceExact "system: ['??', 'System Maintenance', '/ Backup & Settings']," "system: ['$symGear', 'System Maintenance', '/ Backup & Settings'],"
ReplaceExact "audit: ['??', 'Audit Log', '/ Activity History']," "audit: ['$symAudit', 'Audit Log', '/ Activity History'],"
ReplaceExact "const [icon, title, breadcrumb] = titles[section] || ['??', section, '/'];" "const [icon, title, breadcrumb] = titles[section] || ['$symPin', section, '/'];"
ReplaceExact "document.getElementById('confirmIcon').textContent = icon || '??';" "document.getElementById('confirmIcon').textContent = icon || '$symWarn';"
ReplaceExact "function showToast(type, msg, icon = '??') {" "function showToast(type, msg, icon = '$symInfo') {"
ReplaceExact '<button class="toast-close" onclick="this.parentElement.remove()">?</button>' ('<button class="toast-close" onclick="this.parentElement.remove()">' + $symTimes + '</button>')
ReplaceExact '<div class="es-icon">???</div><p>No admin activity yet.</p>' ('<div class="es-icon">' + $symEmpty + '</div><p>No admin activity yet.</p>')
ReplaceExact '<div class="es-icon">??</div><p>No users match your filters.</p>' ('<div class="es-icon">' + $symUsers + '</div><p>No users match your filters.</p>')
ReplaceExact '<button class="kebab-btn" onclick="toggleKebab(event,''kb-${user.id}'')">?</button>' ('<button class="kebab-btn" onclick="toggleKebab(event,''kb-${user.id}'')">' + $symMenu + '</button>')
ReplaceExact '?? Edit Details' ($symEdit + ' Edit Details')
ReplaceExact '''?? Deactivate'' : ''? Activate''' ('''' + $symPause + ' Deactivate'' : ''' + $symCheck + ' Activate''')
ReplaceExact '??? Delete Account' ($symTrash + ' Delete Account')
ReplaceExact "showToast('error', 'Please fill all required member fields.', '??');" "showToast('error', 'Please fill all required member fields.', '$symWarn');"
ReplaceExact "showToast('error', 'Please set a password for the new member.', '??');" "showToast('error', 'Please set a password for the new member.', '$symLock');"
ReplaceExact "showToast('error', 'Passwords do not match.', '??');" "showToast('error', 'Passwords do not match.', '$symSecure');"
ReplaceExact "showToast('success', 'Member account created successfully.', '??');" "showToast('success', 'Member account created successfully.', '$symUser');"
ReplaceExact "showToast('error', error.message || 'Unable to save member.', '??');" "showToast('error', error.message || 'Unable to save member.', '$symWarn');"
ReplaceExact 'showToast(''success'', `Account marked ${nextStatus}.`, ''??'');' ('showToast(''success'', `Account marked ${nextStatus}.`, ''' + $symSync + ''');')
ReplaceExact "showToast('error', error.message || 'Unable to update status.', '??');" "showToast('error', error.message || 'Unable to update status.', '$symWarn');"
ReplaceExact ", '???', async () => {" (", '$symTrash', async () => {")
ReplaceExact "showToast('success', 'Member deleted successfully.', '???');" "showToast('success', 'Member deleted successfully.', '$symTrash');"
ReplaceExact "showToast('error', error.message || 'Unable to delete member.', '??');" "showToast('error', error.message || 'Unable to delete member.', '$symWarn');"
ReplaceExact '<div class="es-icon">??</div><p>No books found in the shared catalog yet.</p>' ('<div class="es-icon">' + $symBooks + '</div><p>No books found in the shared catalog yet.</p>')
ReplaceExact 'font-size:1.2rem">??</div>' ('font-size:1.2rem">' + $symBlueBook + '</div>')
ReplaceExact 'onclick="event.stopPropagation();viewBook(''${book.id}'')">??</button>' ('onclick="event.stopPropagation();viewBook(''${book.id}'')">' + $symView + '</button>')
ReplaceExact 'onclick="saveBook()">?? Save Book</button>' ('onclick="saveBook()">' + $symSave + ' Save Book</button>')
ReplaceExact "showToast('success', 'Book added to the shared catalog.', '??');" "showToast('success', 'Book added to the shared catalog.', '$symBooks');"
ReplaceExact "showToast('error', error.message || 'Unable to add book.', '??');" "showToast('error', error.message || 'Unable to add book.', '$symWarn');"
ReplaceExact 'font-size:2.5rem;flex-shrink:0">??</div>' ('font-size:2.5rem;flex-shrink:0">' + $symOpenBook + '</div>')
ReplaceExact '<div class="es-icon">??</div><p>No transactions available yet.</p>' ('<div class="es-icon">' + $symSync + '</div><p>No transactions available yet.</p>')
ReplaceExact "title: '?? User Distribution'" "title: '$symUsers User Distribution'"
ReplaceExact "title: '?? Most Borrowed Books'" "title: '$symTrophy Most Borrowed Books'"
ReplaceExact "title: '?? Inventory by Category'" "title: '$symBooks Inventory by Category'"
ReplaceExact "title: '?? Fine Summary'" "title: '$symScales Fine Summary'"
ReplaceExact '`?${finesTotal}`' ('`' + $symRupee + '${finesTotal}`')
ReplaceExact 'showToast(''success'', `Live ${format.toUpperCase()} export can be added next.`, ''??'');' ('showToast(''success'', `Live ${format.toUpperCase()} export can be added next.`, ''' + $symExport + ''');')
ReplaceExact '<div class="es-icon">??</div><p>No audit entries match your filters.</p>' ('<div class="es-icon">' + $symAudit + '</div><p>No audit entries match your filters.</p>')
ReplaceExact "showToast('success', 'Backup completed successfully.', '??');" "showToast('success', 'Backup completed successfully.', '$symSave');"
ReplaceExact "showToast('error', error.message || 'Backup failed.', '??');" "showToast('error', error.message || 'Backup failed.', '$symWarn');"
ReplaceExact "function confirmRestore() { showToast('info', 'Restore flow is disabled to protect the shared JSON database.', '???'); }" "function confirmRestore() { showToast('info', 'Restore flow is disabled to protect the shared JSON database.', '$symShield'); }"
ReplaceExact "function scheduleChanged(name, toggle) { showToast(toggle.checked ? 'success' : 'info', `${name} schedule ${toggle.checked ? 'enabled' : 'disabled'}.`, '?'); }" "function scheduleChanged(name, toggle) { showToast(toggle.checked ? 'success' : 'info', `${name} schedule ${toggle.checked ? 'enabled' : 'disabled'}.`, '$symClock'); }"
ReplaceExact 'map((user) => `?? ${user.user_name}`)' ('map((user) => `' + $symUser + ' ${user.user_name}`)')
ReplaceExact 'map((book) => `?? ${book.title}`)' ('map((book) => `' + $symBooks + ' ${book.title}`)')
ReplaceExact "if (matches.length) showToast('info', matches.join(' Ã‚Â· '), '??');" "if (matches.length) showToast('info', matches.join(' $symBullet '), '$symSearch');"
ReplaceExact "showToast('error', error.message || 'Unable to load admin dashboard.', '??');" "showToast('error', error.message || 'Unable to load admin dashboard.', '$symWarn');"

[System.IO.File]::WriteAllText((Resolve-Path $path), $content, [System.Text.UTF8Encoding]::new($false))

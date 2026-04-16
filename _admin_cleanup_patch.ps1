$ErrorActionPreference = 'Stop'
$path = 'admin-app.js'
$content = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::GetEncoding(1252))
function Rx([string]$pattern, [string]$replacement) { $script:content = [regex]::Replace($script:content, $pattern, $replacement) }
Rx 'let html = `<button class="page-btn" \$\{currentPage === 1 \? ''disabled'' : ''''\} onclick="\$\{callback\.name\}\(\$\{currentPage - 1\}\)">.*?</button>`;' 'let html = `<button class="page-btn" ${currentPage === 1 ? ''disabled'' : ''''} onclick="${callback.name}(${currentPage - 1})">\u2039</button>`;'
Rx 'html \+= ''<span style="padding:0 4px;color:var\(--text-muted\);font-size:\.8rem">.*?</span>'';' 'html += ''<span style="padding:0 4px;color:var(--text-muted);font-size:.8rem">\u2026</span>'';'
Rx 'html \+= `<button class="page-btn" \$\{currentPage === totalPages \? ''disabled'' : ''''\} onclick="\$\{callback\.name\}\(\$\{currentPage \+ 1\}\)">.*?</button>`;' 'html += `<button class="page-btn" ${currentPage === totalPages ? ''disabled'' : ''''} onclick="${callback.name}(${currentPage + 1})">\u203A</button>`;'
Rx '<div class="feed-meta">\$\{LibraryApp\.escapeHtml\(item\.user\)\} .*? \$\{LibraryApp\.escapeHtml\(item\.ts\)\}</div>' '<div class="feed-meta">${LibraryApp.escapeHtml(item.user)} \u2022 ${LibraryApp.escapeHtml(item.ts)}</div>'
Rx '<div style="font-size:\.73rem;color:var\(--text-muted\)">\$\{LibraryApp\.escapeHtml\(book\.author\)\} .*? \$\{LibraryApp\.escapeHtml\(String\(book\.year\)\)\}</div>' '<div style="font-size:.73rem;color:var(--text-muted)">${LibraryApp.escapeHtml(book.author)} \u2022 ${LibraryApp.escapeHtml(String(book.year))}</div>'
Rx '<div style="font-size:\.85rem;color:var\(--text-sec\);margin-bottom:6px">By <strong>\$\{LibraryApp\.escapeHtml\(book\.author\)\}</strong> .*? \$\{LibraryApp\.escapeHtml\(String\(book\.year\)\)\}</div>' '<div style="font-size:.85rem;color:var(--text-sec);margin-bottom:6px">By <strong>${LibraryApp.escapeHtml(book.author)}</strong> \u2022 ${LibraryApp.escapeHtml(String(book.year))}</div>'
[System.IO.File]::WriteAllText((Resolve-Path $path), $content, [System.Text.UTF8Encoding]::new($false))

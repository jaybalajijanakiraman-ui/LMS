const LibraryApp = (() => {
  const TOKEN_KEY = 'library_auth_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  function routeForRole(role) {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'administrator') return 'admin.html';
    if (normalized === 'librarian') return 'librarian.html';
    if (normalized === 'faculty') return 'faculty.html';
    return 'student.html';
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getToken();

    if (!headers['Content-Type'] && options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, { ...options, headers });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const message = payload && payload.error ? payload.error : 'Request failed.';
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function login(identifier, password, role) {
    const payload = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, role }),
    });
    setToken(payload.token);
    return payload;
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      // Ignore logout failures and clear local state anyway.
    }
    setToken('');
    window.location.replace('log.html');
  }

  async function getSession() {
    return request('/api/auth/me');
  }

  async function requireSession(expectedRole) {
    try {
      const payload = await getSession();
      const currentRole = String(payload.user.role || '');
      if (expectedRole && currentRole.toLowerCase() !== String(expectedRole).toLowerCase()) {
        window.location.href = routeForRole(currentRole);
        return null;
      }
      return payload;
    } catch (error) {
      if (error.status === 401) {
        setToken('');
        window.location.replace('log.html');
        return null;
      }
      throw error;
    }
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function truncateText(value, maxLength) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }

  function splitTitleLines(value, maxLength = 18) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return ['Shared Catalog', 'Edition'];
    }
    const first = truncateText(normalized, maxLength);
    const remainder = normalized.slice(first.replace(/…$/, '').length).trim();
    return [first, truncateText(remainder, maxLength)];
  }

  function escapeSvgText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getBookCoverTheme(book) {
    const hint = `${book?.category || ''} ${book?.type || ''}`.toLowerCase();
    const themes = [
      {
        match: /(computer|software|program|coding|data|it|ai|ml|algorithm)/,
        label: 'Computer Science',
        short: 'CODE',
        from: '#0f3d63',
        to: '#2563eb',
        accent: '#7dd3fc',
      },
      {
        match: /(electronic|electrical|circuit|embedded|signal|communication)/,
        label: 'Electronics',
        short: 'CIRC',
        from: '#78350f',
        to: '#f59e0b',
        accent: '#fde68a',
      },
      {
        match: /(math|algebra|calculus|geometry|statistics|probability)/,
        label: 'Mathematics',
        short: 'MATH',
        from: '#134e4a',
        to: '#14b8a6',
        accent: '#99f6e4',
      },
      {
        match: /(manag|business|finance|econom|commerce|account)/,
        label: 'Management',
        short: 'BIZ',
        from: '#14532d',
        to: '#22c55e',
        accent: '#bbf7d0',
      },
      {
        match: /(physics|science|chem|biology|biotech|lab)/,
        label: 'Science',
        short: 'LAB',
        from: '#4c1d95',
        to: '#8b5cf6',
        accent: '#ddd6fe',
      },
      {
        match: /(mechanical|civil|engineering|manufacturing|industrial)/,
        label: 'Engineering',
        short: 'ENG',
        from: '#7c2d12',
        to: '#f97316',
        accent: '#fed7aa',
      },
      {
        match: /(fiction|literature|novel|poetry|story|drama|general)/,
        label: 'Fiction',
        short: 'LIT',
        from: '#7f1d1d',
        to: '#ef4444',
        accent: '#fecaca',
      },
    ];
    return themes.find((theme) => theme.match.test(hint)) || {
      label: String(book?.category || 'Library Catalog'),
      short: 'BOOK',
      from: '#334155',
      to: '#64748b',
      accent: '#e2e8f0',
    };
  }

  function buildBookCoverSvg(book) {
    const theme = getBookCoverTheme(book);
    const title = String(book?.title || book?.bookTitle || theme.label || 'Shared Catalog').trim();
    const author = truncateText(book?.author || 'Library Edition', 24) || 'Library Edition';
    const [lineOne, lineTwo] = splitTitleLines(title);

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" role="img" aria-label="${escapeSvgText(title)}">
        <defs>
          <linearGradient id="coverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${theme.from}" />
            <stop offset="100%" stop-color="${theme.to}" />
          </linearGradient>
        </defs>
        <rect width="240" height="320" rx="24" fill="url(#coverGradient)" />
        <circle cx="194" cy="50" r="46" fill="${theme.accent}" fill-opacity=".18" />
        <circle cx="30" cy="286" r="62" fill="#ffffff" fill-opacity=".08" />
        <rect x="18" y="18" width="204" height="284" rx="18" fill="#ffffff" fill-opacity=".08" stroke="#ffffff" stroke-opacity=".16" />
        <text x="28" y="50" fill="#ffffff" fill-opacity=".88" font-family="Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="1.2">${escapeSvgText(theme.label.toUpperCase())}</text>
        <text x="28" y="140" fill="#ffffff" font-family="Arial, sans-serif" font-size="46" font-weight="800" letter-spacing="1.5">${escapeSvgText(theme.short)}</text>
        <text x="28" y="226" fill="#ffffff" font-family="Arial, sans-serif" font-size="21" font-weight="700">${escapeSvgText(lineOne || 'Shared Catalog')}</text>
        <text x="28" y="252" fill="#ffffff" font-family="Arial, sans-serif" font-size="21" font-weight="700">${escapeSvgText(lineTwo || '')}</text>
        <rect x="28" y="270" width="88" height="2" rx="1" fill="${theme.accent}" fill-opacity=".8" />
        <text x="28" y="292" fill="#ffffff" fill-opacity=".82" font-family="Arial, sans-serif" font-size="14">${escapeSvgText(author)}</text>
      </svg>
    `.trim();
  }

  function getBookCoverDataUri(book) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildBookCoverSvg(book))}`;
  }

  function renderBookCover(book, options = {}) {
    const className = String(options.className || '').trim();
    const attrs = className ? ` class="${escapeHtml(className)}"` : '';
    const style = [
      'position:relative',
      'overflow:hidden',
      'background:#e2e8f0',
      options.style || '',
    ].filter(Boolean).join(';');
    const title = String(book?.title || book?.bookTitle || 'Book').trim() || 'Book';

    return `<div${attrs} style="${escapeHtml(style)}"><img src="${escapeHtml(getBookCoverDataUri(book))}" alt="${escapeHtml(`${title} cover art`)}" loading="lazy" draggable="false" style="width:100%;height:100%;display:block;object-fit:cover;"></div>`;
  }

  return {
    escapeHtml,
    getBookCoverDataUri,
    getBookCoverTheme,
    formatDate,
    getToken,
    getSession,
    initials,
    login,
    logout,
    renderBookCover,
    request,
    requireSession,
    routeForRole,
    setToken,
  };
})();

window.LibraryApp = LibraryApp;


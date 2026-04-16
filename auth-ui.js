(() => {
  async function handleLogout(button) {
    if (button) {
      button.disabled = true;
      button.style.opacity = '0.7';
    }
    try {
      await LibraryApp.logout();
    } catch (error) {
      alert(error.message || 'Unable to log out right now.');
      if (button) {
        button.disabled = false;
        button.style.opacity = '1';
      }
    }
  }

  function styleForButton(button) {
    if (button.classList.contains('tb-btn') || button.classList.contains('topbar-btn')) return button.className;
    return 'tb-btn';
  }

  function injectLogoutButton() {
    if (document.querySelector('[data-real-logout="true"]')) return;
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    const anchor = topbar.querySelector('.id-btn, .topbar-btn, .tb-btn:last-of-type');
    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Logout';
    button.setAttribute('data-real-logout', 'true');
    button.className = anchor ? styleForButton(anchor) : 'tb-btn';
    button.innerHTML = '&#128682;';
    button.onclick = () => handleLogout(button);
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(button, anchor.nextSibling);
    else topbar.appendChild(button);
  }

  function wireExistingButtons() {
    document.querySelectorAll('[title="Logout"]').forEach((button) => {
      button.setAttribute('data-real-logout', 'true');
      button.onclick = () => handleLogout(button);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireExistingButtons();
    if (!document.querySelector('[title="Logout"]')) {
      injectLogoutButton();
    }
  });
})();

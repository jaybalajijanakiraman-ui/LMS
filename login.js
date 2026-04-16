(() => {
  const ROLE_CONFIG = {
    student: { label: 'Student ID', placeholder: 'e.g. 22VR1A0501' },
    faculty: { label: 'Faculty ID', placeholder: 'e.g. FAC-2024-012' },
    librarian: { label: 'Staff ID', placeholder: 'e.g. LIB-001' },
    administrator: { label: 'Admin Email / ID', placeholder: 'e.g. JayBalaji@vemu.org or ADM-001' },
  };

  if (typeof ROLES !== 'undefined') {
    Object.assign(ROLES, ROLE_CONFIG);
  }

  window.handleLogin = async function handleLogin(event) {
    event.preventDefault();

    const identifier = document.getElementById('user-id').value.trim();
    const password = document.getElementById('login-pwd').value;

    if (!identifier) {
      showAlert('login-alert', `Please enter your ${ROLE_CONFIG[currentRole].label}.`);
      return;
    }

    if (!password) {
      showAlert('login-alert', 'Please enter your password.');
      return;
    }

    const button = event.target.querySelector('.btn-primary');
    const originalText = button.textContent;

    try {
      setLoading(button, true, 'Authenticating...');
      hideAlert('login-alert');

      const payload = await LibraryApp.login(identifier, password, currentRole);
      button.textContent = 'Opening portal...';
      window.location.href = payload.redirect;
    } catch (error) {
      showAlert('login-alert', error.message || 'Login failed. Please try again.');
      setLoading(button, false, originalText);
    }
  };

  window.resetPassword = function resetPassword() {
    showAlert('reset-alert', 'Password reset is not connected yet. Please contact the administrator.', 'error');
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const activeButton = document.querySelector(`.role-btn[data-role="${currentRole}"]`);
    if (activeButton) {
      setRole(activeButton);
    }

    try {
      const session = await LibraryApp.getSession();
      if (session && session.user) {
        window.location.href = LibraryApp.routeForRole(session.user.role);
      }
    } catch (error) {
      // No active session yet.
    }
  });
})();

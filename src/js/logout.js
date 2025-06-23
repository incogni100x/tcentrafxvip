import { signOut } from './session.js';

export function initializeLogoutFeature(buttonId) {
  const logoutHandler = async () => {
    const signedOut = await signOut();
    if (signedOut) {
      // Clear any session-related data from storage if necessary
      window.location.href = '/login.html';
    }
  };

  const desktopButton = document.getElementById(`${buttonId}-desktop`);
  const mobileButton = document.getElementById(`${buttonId}-mobile`);

  if (desktopButton) {
    desktopButton.addEventListener('click', logoutHandler);
  }
  if (mobileButton) {
    mobileButton.addEventListener('click', logoutHandler);
  }
} 
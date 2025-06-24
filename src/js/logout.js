import { signOut } from './session.js';

export function initializeLogout(buttonId) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.addEventListener('click', async () => {
      await signOut();
      window.location.href = '/login.html';
    });
  }
} 
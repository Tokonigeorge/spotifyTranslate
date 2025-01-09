import { getCurrentTrack } from './src/services/spotify.js';
import { fetchLyrics } from './src/services/lyrics.js';
import { translateText } from './src/services/translation.js';

document.addEventListener('DOMContentLoaded', async () => {
  const connectButton = document.querySelector('button');

  // Check authentication status
  chrome.runtime.sendMessage({ type: 'checkAuth' }, async (response) => {
    if (response.isAuthenticated) {
      // Already authenticated, update UI accordingly
      showAuthenticatedState();
    } else {
      connectButton.addEventListener('click', async () => {
        // Request new token
        chrome.runtime.sendMessage({ type: 'getToken' }, async (response) => {
          if (response.token) {
            showAuthenticatedState();
          } else {
            console.error('Failed to authenticate with Spotify');
          }
        });
      });
    }
  });
});

function showAuthenticatedState() {
  const mainText = document.getElementById('main-text');
  mainText.innerHTML = `
    <h3>Connected!</h3>
    <p>You're now connected to Spotify. Play a song to see its lyrics and translations.</p>
  `;
}

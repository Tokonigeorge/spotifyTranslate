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
            navigateToSpotifyTab();
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

async function navigateToSpotifyTab() {
  const tabs = await chrome.tabs.query({
    url: 'https://open.spotify.com/*',
  });

  if (tabs.length > 0) {
    // If a Spotify tab exists, switch to it
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // If no Spotify tab exists, create one
    await chrome.tabs.create({ url: 'https://open.spotify.com' });
  }
}

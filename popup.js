import { getCurrentTrack } from './src/services/spotify.js';
import { fetchLyrics } from './src/services/lyrics.js';
import { translateText } from './src/services/translation.js';
import { languages } from './src/services/language.js';

document.addEventListener('DOMContentLoaded', async () => {
  const connectButton = document.querySelector('button');

  const mainTextContainer = document.getElementById('main-text');
  const errorContainer = document.querySelector('.error-container');
  const retryButton = document.querySelector('.retry-button');

  const authView = document.getElementById('auth-view');
  const playerView = document.getElementById('player-view');
  const trackInfo = document.getElementById('track-info');
  const noTrackView = document.getElementById('no-track-view');
  const languageSelect = document.getElementById('language');
  const checkTrackButton = document.querySelector('.check-track-button');
  let currentToken = null;

  function showError() {
    errorContainer.style.display = 'flex';
    mainTextContainer.style.display = 'none';
  }

  function hideError() {
    errorContainer.style.display = 'none';
    mainTextContainer.style.display = 'block';
  }

  function populateLanguages() {
    languages.forEach((lang) => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      languageSelect.appendChild(option);
    });
  }

  function updateTrackDisplay(track) {
    if (track) {
      document.getElementById('track-name').textContent = track.name;
      document.getElementById(
        'track-artists'
      ).textContent = `by ${track.artists.join(', ')}`;

      trackInfo.style.display = 'block';
      noTrackView.style.display = 'none';
    } else {
      trackInfo.style.display = 'none';
      noTrackView.style.display = 'block';
    }
  }

  // Listen for track changes from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'trackChanged') {
      updateTrackDisplay(message.track);
    }
  });

  // async function checkCurrentTrack() {
  //   const track = await getCurrentTrack(currentToken);

  //   if (track && track.item) {
  //     document.getElementById('track-name').textContent = track.item.name;
  //     document.getElementById(
  //       'track-artists'
  //     ).textContent = `by ${track.item.artists
  //       .map((artist) => artist.name)
  //       .join(', ')}`;

  //     trackInfo.style.display = 'block';
  //     noTrackView.style.display = 'none';
  //   } else {
  //     trackInfo.style.display = 'none';
  //     noTrackView.style.display = 'block';
  //   }
  // }

  async function handleAuthenticated() {
    mainTextContainer.style.display = 'none';
    playerView.style.display = 'block';
    populateLanguages();

    const { currentTrack } = await chrome.storage.local.get('currentTrack');
    if (currentTrack) {
      updateTrackDisplay(currentTrack);
    }

    await navigateToSpotifyTab();

    // await navigateToSpotifyTab().then(async () => {
    //   await checkCurrentTrack();
    // });
    // Add a small delay to ensure Spotify has loaded
    // setTimeout(, 1000);
  }

  // Check authentication status
  chrome.runtime.sendMessage({ type: 'checkAuth' }, async (response) => {
    if (response.isAuthenticated) {
      // Already authenticated, update UI accordingly
      // showAuthenticatedState();
      // navigateToSpotifyTab();
      await handleAuthenticated();
      // chrome.runtime.sendMessage({ type: 'getToken' }, async (response) => {
      //   if (response.token) {
      //     console.log(response.token, 'yayy');
      //     await handleAuthenticated();
      //   }
      // });
    } else {
      const handleAuth = async () => {
        chrome.runtime.sendMessage({ type: 'getToken' }, async (response) => {
          if (response.token) {
            await handleAuthenticated();
          } else {
            showError();
          }
        });
      };

      connectButton.addEventListener('click', handleAuth);
      retryButton.addEventListener('click', () => {
        // hideError();
        handleAuth();
      });
    }
  });

  checkTrackButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'getCurrentTrack' }, (response) => {
      if (response.track && response.track.item) {
        updateTrackDisplay({
          name: response.track.item.name,
          artists: response.track.item.artists.map((artist) => artist.name),
          id: response.track.item.id,
        });
      }
    });
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

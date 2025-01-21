'use strict';

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

  // let selectedLanguage = 'en';
  let currentTrackData = null;

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
  function getLyrics() {
    const lyricsList = [];
    if (lyricsWrapperList) {
      lyricsWrapperList.forEach((lyricsWrapper) => {
        const lyrics = lyricsWrapper.firstChild.textContent;
        lyricsList.push(lyrics);
      });
    }
    return lyricsList;
  }

  async function updateTrackDisplay(track, selectedLanguage) {
    currentTrackData = track;
    if (track) {
      document.getElementById('track').textContent =
        track.name + ` by ${track.artists.join(', ')}`;
      // document.getElementById(
      //   'track-artists'
      // ).textContent = ;
      const lyricsContainer = document.getElementById('lyrics-container');
      const translatedLyricsContainer = document.getElementById(
        'translated-lyrics-container'
      );

      if (track.lyrics && track.lyrics.length > 0) {
        if (selectedLanguage && selectedLanguage !== 'en') {
          lyricsContainer.innerHTML = 'Loading translations...';
          const translatedLyrics = await translateText(
            track.lyrics,
            selectedLanguage
          );
          console.log(translatedLyrics, 'translation');
          // Combine original and translated lyrics in alternating pattern
          const combinedLyrics = track.lyrics
            ?.map(
              (line, index) => `
            <div class="lyrics-pair">
                <p class="lyrics-line">${line || '&nbsp;'}</p>
                <p class="translated-lyrics-line">${
                  translatedLyrics[index] || '&nbsp;'
                }</p>
            </div>
            `
            )
            .join('');

          lyricsContainer.innerHTML = combinedLyrics;
        } else {
          // If no translation is requested, just show original lyrics
          const originalLyrics = track.lyrics
            .map(
              (line) => `
            <div class="lyrics-pair">
                <p class="lyrics-line">${line || '&nbsp;'}</p>
            </div>
            `
            )
            .join('');

          lyricsContainer.innerHTML = originalLyrics;
        }
      } else {
        lyricsContainer.innerHTML =
          '<p>You got me, no lyrics available for this track.</p>';
      }
      trackInfo.style.display = 'block';
      noTrackView.style.display = 'none';
    } else {
      trackInfo.style.display = 'none';
      noTrackView.style.display = 'block';
    }
  }

  async function handleAuthenticated() {
    errorContainer.style.display = 'none';
    mainTextContainer.style.display = 'none';
    playerView.style.display = 'block';
    populateLanguages();

    const { currentTrack } = await chrome.storage.local.get('currentTrack');
    const selectedLanguage = languageSelect.value;
    updateTrackDisplay(currentTrack, selectedLanguage);

    await navigateToSpotifyTab();
  }

  // Language selection change handler
  languageSelect.addEventListener('change', async (e) => {
    if (currentTrackData) {
      // selectedLanguage = e.target.value;
      console.log(e.target.value, 'selected');
      await updateTrackDisplay(currentTrackData, e.target.value);
    }
  });

  const { currentLyrics } = await chrome.storage.local.get('currentLyrics');
  if (currentLyrics) {
    const lyricsHtml = currentLyrics
      .map(
        (line) => `
      <div class="lyrics-pair">
        <p class="lyrics-line">${line || '&nbsp;'}</p>
      </div>`
      )
      .join('');

    lyricsContainer.innerHTML = lyricsHtml;
  }

  // Check authentication status
  chrome.runtime.sendMessage({ type: 'checkAuth' }, async (response) => {
    if (response.isAuthenticated) {
      await handleAuthenticated();
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
      retryButton.addEventListener('click', handleAuth);
    }
  });
  checkTrackButton.addEventListener('click', () => {
    console.log('here');
    chrome.runtime.sendMessage({ type: 'getCurrentTrack' }, (response) => {
      updateTrackDisplay(response.track);
    });
  });
});

async function navigateToSpotifyTab() {
  // Get the currently active tab in the focused window
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (
    activeTab &&
    activeTab.url &&
    activeTab.url.startsWith('https://open.spotify.com/')
  ) {
    console.log('Already on a Spotify tab. Doing nothing.');
    return;
  }

  // Search for an existing Spotify tab
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
  // chrome.tabs.executeScript({ file: 'popup.js' });
}

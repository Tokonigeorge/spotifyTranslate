'use strict';
import { languages } from './src/services/language.js';
import { translateText } from './src/services/translation.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('here oo');
  const languageSelect = document.getElementById('language');
  const nowPlaying = document.querySelector(
    "div[data-testid='now-playing-widget']"
  );
  const mainTextContainer = document.getElementById('main-text');

  const { selectedLanguage } = await chrome.storage.local.get(
    'selectedLanguage'
  );
  const lyrics = [];
  const errorMessage = '';

  populateLanguages();

  await navigateToSpotifyTab();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'lyricsUpdate') {
      const lyricsList = message.lyrics;
      console.log('got lyrics', lyricsList);
      if (lyricsList?.length > 0) {
        updateTrackDisplay(selectedLanguage || 'en', lyricsList);
      } else {
        errorMessage = "Couldn't get lyrics";
      }

      console.log('Lyrics received in popup:', lyricsList);
    }
  });

  languageSelect.addEventListener('change', async (e) => {
    console.log(e.target.value, 'selected');
    await chrome.storage.local.set({ selectedLanguage });
    if (lyrics?.length > 0) {
      await updateTrackDisplay(e.target.value, lyrics);
    }
  });
});

async function updateTrackDisplay(language, lyrics) {
  const errorContainer = document.querySelector('.error-container');
  if (lyrics.length > 0) {
    const mutatedLyrics = lyrics?.join('\n');
    const translatedLyrics = await translateText(mutatedLyrics, language);

    if (translatedLyrics?.length > 0) {
      errorContainer.style.display = 'none';

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'translationLyrics',
            translatedLyrics: translatedLyrics,
          });
        } else {
          console.error('No active tab found.');
        }
      });
    } else {
      errorContainer.style.display = 'block';
    }
  } else {
    lyricsContainer.innerHTML =
      '<p>You got me, no lyrics available for this track.</p>';
  }
  // trackInfo.style.display = 'block';
  // noTrackView.style.display = 'none';
}

function populateLanguages() {
  const languageSelect = document.getElementById('language');
  languages.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    languageSelect.appendChild(option);
  });
}

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
}

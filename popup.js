'use strict';
import { languages } from './src/services/language.js';

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

const updateTrackDisplay = (songData) => {
  const nowPlaying = document.querySelector('.now-playing');
  const coverArtEl = document.querySelector('.cover-art');
  const artistsEl = document.querySelector('.song-title');
  const songTitleEl = document.querySelector('.artists-name');

  if (songData.coverArt && songData.songTitle && songData.artists) {
    nowPlaying.style.display = 'block';

    coverArtEl.src = songData.coverArt;

    songTitleEl.textContent = songData.songTitle;

    artistsEl.textContent = songData.artists;
  } else {
    nowPlaying.style.display = 'none';
  }
};

const getSongDataOnLoad = (lastSongData, languageSelector) => {
  if (!lastSongData) {
    chrome.runtime.sendMessage({ action: 'getCurrentSongData' }, (response) => {
      if (response?.songData) {
        const songData = response.songData;
        languageSelector.style.display = 'block';
        updateTrackDisplay(songData);
        return songData;
      } else {
        console.log('No song data found, requesting re-observation.');
        // If no song data is available, trigger content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'triggerObservation' });
          }
        });
        return null;
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  const port = chrome.runtime.connect({ name: 'popup' });
  const languageSelect = document.getElementById('language');
  const languageSelector = document.querySelector('.language-selector');
  let lastSongData = null;
  const { selectedLanguage } = await chrome.storage.local.get(
    'selectedLanguage'
  );

  setSelectedLanguage(selectedLanguage);

  await navigateToSpotifyTab();
  lastSongData = getSongDataOnLoad(lastSongData, languageSelector);

  port.onMessage.addListener((message) => {
    if (message.type === 'lyricsUpdate') {
      const songData = message.songData;

      if (JSON.stringify(lastSongData) !== JSON.stringify(songData)) {
        lastSongData = songData;

        languageSelector.style.display = 'block';

        updateTrackDisplay(songData);
      }
    }
  });

  languageSelect.addEventListener('change', async (e) => {
    if (e.target.value !== selectedLanguage) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'languageChange',
            newValue: e.target.value,
          });
        }
      });
      await chrome.storage.local.set({ selectedLanguage: e.target.value });
    }
  });
});

function setSelectedLanguage(selectedLanguage) {
  const languageSelect = document.getElementById('language');
  const option = languageSelect.querySelector(
    `option[value="${selectedLanguage}"]`
  );
  if (option) {
    option.selected = true;
  }
}

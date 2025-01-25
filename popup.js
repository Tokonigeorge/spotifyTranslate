'use strict';
import { languages } from './src/services/language.js';
import { translateText } from './src/services/translation.js';

document.addEventListener('DOMContentLoaded', async () => {
  const languageSelect = document.getElementById('language');
  const errorContainer = document.querySelector('.error-container');
  const languageSelector = document.querySelector('.language-selector');
  const retryButton = document.querySelector('.retry-button');

  const { selectedLanguage } = await chrome.storage.local.get(
    'selectedLanguage'
  );
  console.log(selectedLanguage, 'wee language');
  let lyrics = [];
  let lastSongData = null;

  populateLanguages(selectedLanguage);

  await navigateToSpotifyTab();
  console.log(lastSongData, 'lastsongdata');
  if (!lastSongData) {
    chrome.runtime.sendMessage({ action: 'getCurrentSongData' }, (response) => {
      console.log('im running 1');
      if (response?.songData) {
        console.log('im running 2');
        const songData = response.songData;
        lastSongData = songData;
        const lyricsList = songData?.lyricsList;
        languageSelector.style.display = 'block';

        errorContainer.style.display = 'none';
        console.log(songData, 'songData');
        updateTrackDisplay(songData);

        if (lyricsList?.length > 0) {
          lyrics = lyricsList;

          updateLyricDisplay(selectedLanguage || 'en', lyricsList);
        }
      } else {
        console.log('No song data found, requesting re-observation.');
        // If no song data is available, trigger content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'triggerObservation' });
          }
        });
      }
    });
  }

  const port = chrome.runtime.connect({ name: 'popup' });
  port.onMessage.addListener((message) => {
    console.log(lastSongData, 'norequest');
    if (message.type === 'lyricsUpdate') {
      const songData = message.songData;
      console.log(lastSongData, 'update', songData);
      if (JSON.stringify(lastSongData) !== JSON.stringify(songData)) {
        lastSongData = songData;

        const lyricsList = songData?.lyricsList;

        languageSelector.style.display = 'block';

        errorContainer.style.display = 'none';
        console.log(songData, 'songData');
        updateTrackDisplay(songData);

        if (lyricsList?.length > 0) {
          lyrics = lyricsList;

          updateLyricDisplay(selectedLanguage || 'en', lyricsList);
        }
      }
    }
  });

  languageSelect.addEventListener('change', async (e) => {
    console.log(e.target.value, 'selected');
    await chrome.storage.local.set({ selectedLanguage: e.target.value });
    console.log('kyrics', lyrics);
    if (lyrics?.length > 0) {
      await updateLyricDisplay(e.target.value, lyrics);
    }
  });

  retryButton.addEventListener('click', async (e) => {
    chrome.runtime.sendMessage({ action: 'getCurrentSongData' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          'Error sending message:',
          chrome.runtime.lastError.message
        );
        return;
      }
      if (response?.songData) {
        const songData = response.songData;
        lastSongData = songData;
        const lyricsList = songData?.lyricsList;
        languageSelector.style.display = 'block';

        errorContainer.style.display = 'none';
        console.log(songData, 'songData');
        updateTrackDisplay(songData);

        if (lyricsList?.length > 0) {
          lyrics = lyricsList;

          updateLyricDisplay(selectedLanguage || 'en', lyricsList);
        }
      }
    });
  });

  async function updateLyricDisplay(language, lyrics) {
    const nowPlaying = document.querySelector('.now-playing');

    const cleanLyricsForTranslation = lyrics
      .filter((line) => line.trim() !== '' && line.trim() !== '♪')
      ?.join('\n');

    const translatedLyrics = await translateText(
      cleanLyricsForTranslation,
      language
    );

    // translatedLyrics?.[0].split('\n');
    const translatedLyricsArray =
      translatedLyrics?.length > 1
        ? translatedLyrics
        : translatedLyrics?.[0].split('\n');

    if (translatedLyricsArray?.length > 0) {
      errorContainer.style.display = 'none';

      const cleanedTranslatedLyrics = alignTranslatedToOriginal(
        lyrics,
        translatedLyricsArray
      );

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'translationLyrics',
            translatedLyrics: cleanedTranslatedLyrics,
          });
        } else {
          console.error('No active tab found.');
        }
      });
    } else {
      //display error
      languageSelector.style.display = 'none';
      nowPlaying.style.display = 'none';
      errorContainer.style.display = 'block';
    }

    // trackInfo.style.display = 'block';
    // noTrackView.style.display = 'none';
  }
});

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

function populateLanguages(selectedLanguage) {
  const languageSelect = document.getElementById('language');
  languages.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    if (lang.code === selectedLanguage) {
      option.selected = true;
    }
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

function alignTranslatedToOriginal(originalLyrics, translatedLyrics) {
  const alignedTranslated = [];
  let translatedIndex = 0; // Pointer for the translated lyrics array

  // Iterate over the original lyrics array
  originalLyrics.forEach((originalLine) => {
    if (originalLine.trim() === '' || originalLine.trim() === '♪') {
      // Preserve empty strings and musical characters
      alignedTranslated.push(originalLine);
    } else {
      // Match translated lyric to the original lyric
      alignedTranslated.push(translatedLyrics[translatedIndex] || '');
      translatedIndex++; // Move to the next translated lyric
    }
  });

  return alignedTranslated;
}

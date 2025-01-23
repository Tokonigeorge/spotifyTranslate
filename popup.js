'use strict';
import { languages } from './src/services/language.js';
import { translateText } from './src/services/translation.js';

document.addEventListener('DOMContentLoaded', async () => {
  const languageSelect = document.getElementById('language');
  const nowPlaying = document.querySelector(
    "div[data-testid='now-playing-widget']"
  );
  const mainTextContainer = document.getElementById('main-text');

  const { selectedLanguage } = await chrome.storage.local.get(
    'selectedLanguage'
  );
  let lastLyrics = [];
  let errorMessage = '';

  populateLanguages();

  await navigateToSpotifyTab();

  const port = chrome.runtime.connect({ name: 'popup' });
  port.onMessage.addListener((message) => {
    if (message.type === 'lyricsUpdate') {
      const lyricsList = message.lyrics;

      if (lyricsList?.length > 0) {
        // if (JSON.stringify(lyricsList) !== JSON.stringify(lastLyrics)) {
        lastLyrics = lyricsList;
        console.log('lyrics again', lyricsList);

        updateTrackDisplay(selectedLanguage || 'en', lyricsList);
        // }
      } else {
        errorMessage = "Couldn't get lyrics";
      }
    }
  });

  // chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  //   if (message.type === 'lyricsUpdate') {
  //     const lyricsList = message.lyrics;

  //     if (lyricsList?.length > 0) {
  //       if (JSON.stringify(lyricsList) !== JSON.stringify(lastLyrics)) {
  //         lastLyrics = lyricsList;
  //         console.log('updating display', lyricsList);
  //         updateTrackDisplay(selectedLanguage || 'en', lyricsList);
  //       }
  //     } else {
  //       errorMessage = "Couldn't get lyrics";
  //     }
  //     sendResponse({ success: true });
  //     return true;
  //   }
  // });

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
    // const mutatedLyrics = lyrics?.join('\n');

    const cleanLyricsForTranslation = lyrics
      .filter((line) => line.trim() !== '' && line.trim() !== '♪')
      ?.join('\n');

    console.log(cleanLyricsForTranslation, 'wee');

    const translatedLyrics = await translateText(
      cleanLyricsForTranslation,
      language
    );
    const translatedLyricsArray = translatedLyrics?.[0].split('\n');

    if (translatedLyricsArray?.length > 0) {
      errorContainer.style.display = 'none';
      const cleanedTranslatedLyrics = alignTranslatedToOriginal(
        lyrics,
        translatedLyricsArray
      );
      console.log('translation', cleanedTranslatedLyrics, lyrics);
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

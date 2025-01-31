console.log('runnings content script');
let lastLyrics = null;
let previouslyTranslatedLyrics = [];

const SERVER_URL = 'http://localhost:3000';

const removeTranslatedLyrics = () => {
  document
    .querySelectorAll('.translated')
    .forEach((element) => element.remove());
};
(() => removeTranslatedLyrics())();

const translateText = async (text, targetLanguage) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        targetLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return null;
  }
};

const updateLyricsContainer = (lyricsTranslations) => {
  const lyricsWrapperList = document.querySelectorAll(
    "div[data-testid='fullscreen-lyric']"
  );
  if (!lyricsWrapperList.length || !lyricsTranslations.length) return;
  removeTranslatedLyrics();

  lyricsWrapperList.forEach((lyricsWrapper, index) => {
    const translationDiv = document.createElement('div');
    translationDiv.textContent = lyricsTranslations[index];
    translationDiv.style.fontStyle = 'italic';
    translationDiv.style.color = '#999';

    translationDiv.className = 'translated';
    const lyricsChildren = Array.from(lyricsWrapper.children);

    if (lyricsChildren.length > 1) {
      lyricsWrapper.insertBefore(translationDiv, lyricsChildren[1].nextSibling);
    } else {
      lyricsWrapper.appendChild(translationDiv);
    }
  });
};

const alignTranslatedToOriginal = (originalLyrics, translatedLyrics) => {
  const alignedTranslatedLyrics = [];
  let translatedIndex = 0;

  // Iterate over the original lyrics array
  originalLyrics.forEach((originalLine) => {
    if (originalLine.trim() === '' || originalLine.trim() === '♪') {
      // Preserve empty strings and musical characters
      alignedTranslatedLyrics.push(originalLine);
    } else {
      // Match translated lyric to the original lyric
      alignedTranslatedLyrics.push(translatedLyrics[translatedIndex] || '');
      translatedIndex++;
    }
  });

  return alignedTranslatedLyrics;
};

const translateLyrics = async (lyrics, language) => {
  previouslyTranslatedLyrics = [];
  const translatedLyrics = [];
  let successfulTranslations = 0;

  for (const line of lyrics) {
    try {
      if (line.trim() !== '' && line.trim() !== '♪') {
        const translatedLine = await translateText(line, language);
        if (translatedLine) successfulTranslations++;
        translatedLyrics.push(translatedLine || '');
      }
      //might not throw error anymore
    } catch (error) {
      console.error(`Error translating line "${line}"`);
      translatedLyrics.push('');
    }
  }

  if (successfulTranslations === 0) {
    console.log('All translations failed. Keeping original lyrics.');
    return;
  }

  const cleanedTranslatedLyrics = alignTranslatedToOriginal(
    lyrics,
    translatedLyrics.filter((text) => text != '')
  );
  previouslyTranslatedLyrics = cleanedTranslatedLyrics;

  updateLyricsContainer(cleanedTranslatedLyrics);
};

const findLyrics = (attempts = 0, maxAttempts = 10) => {
  const lyricsWrapperList = document.querySelectorAll(
    "div[data-testid='fullscreen-lyric']"
  );
  let lyricsList = [];
  if (lyricsWrapperList.length > 0) {
    // Process the "lyricsWrapperList" for the first time
    lyricsWrapperList.forEach((lyricsWrapper) => {
      const firstChild = lyricsWrapper.querySelector('div') || lyricsWrapper;
      const lyric = lyricDiv.textContent.trim();

      if (lyric) lyricsList.push(lyric);
    });
    return lyricsList;
  }

  if (attempts < maxAttempts) {
    requestAnimationFrame(() => findLyrics(attempts + 1));
  }
  return lyricsList;
};

const getCurrentSongData = async () => {
  const lyricsList = findLyrics();
  const coverArtImgEl = document.querySelector(
    "img[data-testid='cover-art-image']"
  );
  const songTitleEl = document.querySelector(
    "div[data-testid='context-item-info-title']"
  );
  const artistsEl = document.querySelector(
    "div[data-testid='context-item-info-subtitles']"
  );
  const { selectedLanguage } = await chrome.storage.local.get(
    'selectedLanguage'
  );

  const coverArtImgSrc = coverArtImgEl ? coverArtImgEl.src : null;
  const songTitle = songTitleEl ? songTitleEl.textContent.trim() : null;
  const artists = artistsEl ? artistsEl.textContent.trim() : null;

  if (chrome.runtime?.id) {
    chrome.runtime.sendMessage({
      type: 'songDataUpdate',
      songData: {
        coverArt: coverArtImgSrc,
        songTitle,
        artists,
      },
    });
  }
  if (!lyricsList.length) return;
  if (JSON.stringify(lastLyrics) == JSON.stringify(lyricsList)) {
    if (previouslyTranslatedLyrics) {
      updateLyricsContainer(previouslyTranslatedLyrics);
      return;
    }
  }

  lastLyrics = lyricsList;
  await translateLyrics(lyricsList, selectedLanguage || 'en');
};

const observeLyrics = (nowPlaying) => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(() => {
      getCurrentSongData();
    });
  });

  observer.observe(nowPlaying, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('unload', () => {
    observer.disconnect();
  });
};

const interval = setInterval(() => {
  const nowPlaying = document.querySelector(
    'footer[data-testid="now-playing-bar"]'
  );
  if (nowPlaying) {
    clearInterval(interval);
    observeLyrics(nowPlaying);
  }
}, 500);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'triggerObservation') {
    observeLyrics();
  }
  if (message.type === 'languageChange') {
    translateLyrics(lastLyrics, message.newValue || 'en');
  }
});

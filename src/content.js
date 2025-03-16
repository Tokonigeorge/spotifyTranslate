console.log('running content script');
const MAX_INIT_TIME = 60000;

let lastLyrics = null;
let previouslyTranslatedLyrics = [];
let currentLyrics = [];

const removeTranslatedLyrics = () => {
  document
    .querySelectorAll('.translated')
    .forEach((element) => element.remove());
};

const translateText = async (text, targetLanguage) => {
  try {
    const TRANSLATION_API =
      'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t';
    const response = await fetch(
      `${TRANSLATION_API}&sl=auto&tl=${targetLanguage}&q=${encodeURIComponent(
        text
      )}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const data = await response.json();
    const translatedTexts = data[0] || [];
    const cleanedTranslatedTexts = translatedTexts.map((translation) => {
      if (Array.isArray(translation) && translation[0]) {
        return translation[0].trim();
      }
      return '';
    });
    return cleanedTranslatedTexts;
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
  let translationIndex = 0;
  lyricsWrapperList.forEach((lyricsWrapper) => {
    const originalLyricsDiv = lyricsWrapper.firstChild;
    const originalText = originalLyricsDiv?.textContent?.trim();

    // Skip empty wrappers
    if (!originalText) return;

    // Create translation div
    const translationDiv = document.createElement('div');
    translationDiv.textContent = lyricsTranslations[translationIndex];
    translationDiv.style.fontStyle = 'italic';
    translationDiv.style.color = '#999';
    translationDiv.className = 'translated';

    originalLyricsDiv.after(translationDiv);

    translationIndex++;
  });
};

const alignTranslatedToOriginal = (originalLyrics, translatedLyrics) => {
  const alignedTranslatedLyrics = [];
  let translatedIndex = 0;

  originalLyrics.forEach((originalLine) => {
    if (originalLine.trim() === '' || originalLine.trim() === '♪') {
      alignedTranslatedLyrics.push('');
    } else {
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

  const batchSize = 10;

  const translationBatches = [];
  for (let i = 0; i < lyrics.length; i += batchSize) {
    const batch = lyrics.slice(i, i + batchSize);
    translationBatches.push(
      Promise.all(
        batch.map(async (line) => {
          try {
            if (line.trim() !== '' && line.trim() !== '♪') {
              const translatedLine = await translateText(line, language);
              if (translatedLine) successfulTranslations++;
              return translatedLine || '';
            }
            return null;
          } catch (error) {
            console.error(`Error translating line "${line}":`, error.message);
            return '';
          }
        })
      )
    );
  }
  const results = await Promise.all(translationBatches);
  translatedLyrics.push(...results.flat());

  if (successfulTranslations === 0) {
    return;
  }

  const cleanedTranslatedLyrics = alignTranslatedToOriginal(
    lyrics,
    translatedLyrics.filter((text) => text != null)
  );
  previouslyTranslatedLyrics = cleanedTranslatedLyrics;

  updateLyricsContainer(cleanedTranslatedLyrics);
};

const findLyrics = async (attempts = 0, maxAttempts = 20) => {
  const lyricsWrapperList = document.querySelectorAll(
    "div[data-testid='fullscreen-lyric']"
  );
  let lyricsList = [];

  if (lyricsWrapperList.length > 0) {
    lyricsWrapperList.forEach((lyricsWrapper) => {
      const lyricDiv = lyricsWrapper.querySelector('div') || lyricsWrapper;
      const lyric = lyricDiv.textContent.trim();
      if (lyric) lyricsList.push(lyric);
    });
  }

  if (!lyricsList.length && attempts < maxAttempts) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(findLyrics(attempts + 1, maxAttempts));
      }, 500);
    });
  }

  return lyricsList;
};

const getCurrentSongMetadata = async () => {
  const coverArtImgEl = document.querySelector(
    "img[data-testid='cover-art-image']"
  );
  const songTitleEl = document.querySelector(
    "div[data-testid='context-item-info-title']"
  );
  const artistsEl = document.querySelector(
    "div[data-testid='context-item-info-subtitles']"
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
};

const handleLyricsUpdate = async (lyrics, lang) => {
  const lyricsList = lyrics ? lyrics : await findLyrics();
  if (!lyricsList.length) return;

  if (JSON.stringify(lastLyrics) == JSON.stringify(lyricsList) && !lang) {
    if (previouslyTranslatedLyrics) {
      updateLyricsContainer(previouslyTranslatedLyrics);
      return;
    }
  }
  let selectedLanguage;
  if (!lang) {
    try {
      ({ selectedLanguage } = await chrome.storage.local.get(
        'selectedLanguage'
      ));
    } catch (error) {
      selectedLanguage = 'en';
    }
  }

  lastLyrics = lyricsList;
  await translateLyrics(lyricsList, lang || selectedLanguage || 'en');
};

const setupNowPlayingListener = (nowPlaying) => {
  removeTranslatedLyrics();

  const initialLyricsCheck = async () => {
    const lyricsList = await findLyrics();
    if (lyricsList.length) {
      handleLyricsUpdate(lyricsList);
    }
  };

  initialLyricsCheck();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      getCurrentSongMetadata();
      handleLyricsUpdate();
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

const initProcess = setInterval(() => {
  const nowPlaying = document.querySelector(
    'footer[data-testid="now-playing-bar"]'
  );
  if (nowPlaying) {
    clearInterval(initProcess);

    setupNowPlayingListener(nowPlaying);
  }
}, 500);

setTimeout(() => {
  clearInterval(initProcess);
  console.log('Timed out');
}, MAX_INIT_TIME);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'triggerObservation') {
    getCurrentSongMetadata();
    handleLyricsUpdate();
  }
  if (message.type === 'languageChange') {
    handleLyricsUpdate(null, message.newValue || 'en');
  }
});

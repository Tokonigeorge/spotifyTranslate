console.log('running content script');
(() => {
  let lastLyrics = null;
  document.querySelectorAll('.translated').forEach((element) => {
    element.remove();
  });

  const updateLyricsContainer = (lyricsTranslations) => {
    const lyricsWrapperList = document.querySelectorAll(
      "div[data-testid='fullscreen-lyric']"
    );

    if (lyricsWrapperList && lyricsTranslations.length > 0) {
      // First, remove all previous injected translations
      document.querySelectorAll('.translated').forEach((element) => {
        element.remove();
      });

      lyricsWrapperList.forEach((lyricsWrapper, index) => {
        const translationDiv = document.createElement('div');
        translationDiv.textContent = lyricsTranslations[index];
        translationDiv.style.fontStyle = 'italic';
        translationDiv.style.color = '#999';

        translationDiv.className = 'translated';
        const lyricsChildren = Array.from(lyricsWrapper.children);

        if (lyricsChildren.length > 1) {
          lyricsWrapper.insertBefore(
            translationDiv,
            lyricsChildren[1].nextSibling
          );
        } else {
          lyricsWrapper.appendChild(translationDiv);
        }
      });
    }
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
    console.log('aligned translations,', alignedTranslatedLyrics);
    return alignedTranslatedLyrics;
  };

  const translateLyrics = async (lyrics, language) => {
    const translatedLyrics = [];

    for (const line of lyrics) {
      try {
        if (line.trim() !== '' && line.trim() !== '♪') {
          const translatedLine = await translateText(line, language);

          translatedLyrics.push(translatedLine || '');
        }
      } catch (error) {
        console.error(`Error translating line "${line}"`);
        translateLyrics.push('');
      }
    }

    const cleanedTranslatedLyrics = alignTranslatedToOriginal(
      lyrics,
      translatedLyrics.filter((text) => text != '')
    );
    console.log(
      'translated lyrics,',
      translatedLyrics,
      'clean translated lyrics:',
      cleanedTranslatedLyrics
    );
    updateLyricsContainer(cleanedTranslatedLyrics);
  };

  const getCurrentSongData = async () => {
    const lyricsWrapperList = document.querySelectorAll(
      "div[data-testid='fullscreen-lyric']"
    );
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
    const lyricsList = [];

    if (lyricsWrapperList.length > 0) {
      const originalLyricsList = document.querySelectorAll('.original-lyrics');

      if (originalLyricsList.length > 0) {
        // Extract text from divs that already have the "original-lyrics" class
        originalLyricsList.forEach((originalLyric) => {
          const lyric = originalLyric.textContent.trim();
          lyricsList.push(lyric);
        });
      } else {
        // Process the "lyricsWrapperList" for the first time
        lyricsWrapperList.forEach((lyricsWrapper) => {
          const firstChild = lyricsWrapper.querySelector('div');
          if (firstChild) {
            const lyric = firstChild.textContent.trim();
            lyricsList.push(lyric);

            // Add the "original-lyrics" class to the first child div
            firstChild.classList.add('original-lyrics');
          }
        });
      }

      // Optionally, stop observing if you're only interested in one capture
      // observer.disconnect();
    }

    const { selectedLanguage } = await chrome.storage.local.get(
      'selectedLanguage'
    );

    const songData = {
      coverArt: coverArtImgSrc,
      songTitle,
      artists,
    };

    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: 'songDataUpdate',
        songData,
      });
    }
    console.log('lastLyrics', lastLyrics, 'current lyrics', lyricsList);
    if (
      JSON.stringify(lastLyrics) !== JSON.stringify(lyricsList) &&
      lyricsList.length > 0
    ) {
      lastLyrics = lyricsList;
      await translateLyrics(lyricsList, selectedLanguage || 'en');
    }
  };

  // chrome.storage.onChanged.addListener(async (changes, area) => {
  //   console.log('here', area, changes.selectedLanguage);
  //   if (area === 'local' && changes.selectedLanguage) {
  //     await translateLyrics(
  //       lastLyrics,
  //       changes.selectedLanguage?.newValue || 'en'
  //     );
  //     console.log('Language changed to:', changes.selectedLanguage.newValue);
  //   }
  // });

  const observeLyrics = () => {
    let isObserving = false;

    const nowPlaying = document.querySelector(
      "div[data-testid='now-playing-widget']"
    );
    if (isObserving) {
      console.log('Already observing, skipping reinitialization.');
      return;
    }
    if (!nowPlaying) {
      console.error(
        "Error: 'now-playing-widget' not found. Observer not initialized."
      );
      return;
    }
    let mutationDetected = false;
    const observer = new MutationObserver((mutations) => {
      mutationDetected = true;
      mutations.forEach(() => {
        const currentLyrics = getCurrentSongData();
        lastLyrics = currentLyrics;
      });
    });

    setTimeout(() => {
      if (!mutationDetected) {
        console.log('No mutations detected; manually fetching song data');
        const currentLyrics = getCurrentSongData();
        lastLyrics = currentLyrics; // Update the lyrics
      }
    }, 1000);

    //  observe only the now playing
    observer.observe(nowPlaying, {
      childList: true,
      subtree: true,
    });
    isObserving = true;
    window.addEventListener('unload', () => {
      if (observer) {
        observer.disconnect();
        isObserving = false;
        console.log('Observer disconnected on unload.');
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeLyrics);
  } else {
    observeLyrics();
  }
  const interval = setInterval(() => {
    const nowPlaying = document.querySelector(
      'div[data-testid="now-playing-widget"]'
    );
    console.log('testing interval');
    if (nowPlaying) {
      clearInterval(interval);
      observeLyrics();
    }
  }, 500);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Language don change o');
    if (message.type === 'triggerObservation') {
      console.log('Manual observation trigger received');
      observeLyrics();
    }
    if (message.type === 'languageChange') {
      const newLanguage = message.newValue || 'en';
      console.log('Language changed to:', newLanguage);
      translateLyrics(lastLyrics, newLanguage);
    }
  });
})();

const SERVER_URL = 'http://localhost:3000';

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

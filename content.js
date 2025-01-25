console.log('here oo');
(() => {
  function observeLyrics() {
    let lastLyrics = null;
    let isObserving = false;

    document.querySelectorAll('.translated').forEach((element) => {
      element.remove();
    });
    if (isObserving) {
      console.log('Already observing, skipping reinitialization.');
      return;
    }

    const observer = new MutationObserver((mutations) => {
      console.log('mutation observed');
      mutations.forEach(() => {
        const lyricsWrapperList = document.querySelectorAll(
          "div[data-testid='fullscreen-lyric']"
        );
        const nowPlaying = document.querySelector(
          "div[data-testid='now-playing-widget']"
        );
        const coverArtImgEl = document.querySelector(
          "img[data-testid='cover-art-image']"
        );
        const coverArtImgSrc = coverArtImgEl ? coverArtImgEl.src : null;
        const songTitleEl = document.querySelector(
          "div[data-testid='context-item-info-title']"
        );
        const songTitle = songTitleEl ? songTitleEl.textContent.trim() : null;
        const artistsEl = document.querySelector(
          "div[data-testid='context-item-info-subtitles']"
        );

        const artists = artistsEl ? artistsEl.textContent.trim() : null;
        const lyricsList = [];
        if (lyricsWrapperList.length > 0) {
          const originalLyricsList =
            document.querySelectorAll('.original-lyrics');

          if (originalLyricsList.length > 0) {
            // Extract text from divs that already have the "original-lyrics" class
            originalLyricsList.forEach((originalLyric) => {
              const lyric = originalLyric.textContent.trim();
              lyricsList.push(lyric);
            });
          } else {
            // Process the "lyricsWrapperList" for the first time
            lyricsWrapperList.forEach((lyricsWrapper) => {
              const firstChild = lyricsWrapper.querySelector('div'); // Get the first child div
              if (firstChild) {
                const lyric = firstChild.textContent.trim(); // Get text content of the first child
                lyricsList.push(lyric);

                // Add the "original-lyrics" class to the first child div
                firstChild.classList.add('original-lyrics');
              }
            });
          }

          const songData = {
            coverArt: coverArtImgSrc,
            songTitle,
            artists,
            lyricsList,
          };

          if (chrome.runtime?.id) {
            chrome.runtime.sendMessage({
              type: 'lyricSend',
              songData,
            });
          }

          // Optionally, stop observing if you're only interested in one capture
          // observer.disconnect();
        }
      });
    });

    //   Start observing the entire document for changes
    observer.observe(document.body, {
      childList: true, // Watch for changes in the direct children of the observed node
      subtree: true, // Also watch for changes in the children of children
    });
    isObserving = true;
    window.addEventListener('unload', () => {
      if (observer) {
        observer.disconnect();
        isObserving = false;
        console.log('Observer disconnected on unload.');
      }
    });
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'triggerObservation') {
      console.log('Manual observation trigger received');
      observeLyrics(); // Trigger the observer manually
    }
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeLyrics);
    console.log('loading');
  } else {
    observeLyrics();
  }

  chrome.runtime.onMessage.addListener(
    async (message, sender, sendResponse) => {
      if (message.type === 'translationLyrics') {
        updateLyricsContainer(message.translatedLyrics);
      }
    }
  );
})();

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

console.log('here oo');
(() => {
  function observeLyrics() {
    let lastLyrics = null;
    const observer = new MutationObserver((mutations) => {
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
        const artistsEl = document.querySelectorAll(
          "span[data-testid='context-item-info-artist']"
        );
        const artists =
          artistsEl.length > 0
            ? Array.from(artistsEl)
                .map((artist) => artist.textContent.trim())
                .join(', ')
            : null;

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

    window.addEventListener('unload', () => {
      if (observer) {
        observer.disconnect();
        console.log('Observer disconnected on unload.');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeLyrics);
  } else {
    observeLyrics();
  }

  chrome.runtime.onMessage.addListener(
    async (message, sender, sendResponse) => {
      if (message.type === 'translationLyrics') {
        const lyricsWrapperList = document.querySelectorAll(
          "div[data-testid='fullscreen-lyric']"
        );
        console.log(message.translatedLyrics, 'translated');
        const lyricsTranslations = message.translatedLyrics;

        if (lyricsWrapperList && lyricsTranslations.length > 0) {
          // First, remove all existing elements with the class name "translated"
          document.querySelectorAll('.translated').forEach((element) => {
            element.remove();
          });
          lyricsWrapperList.forEach((lyricsWrapper, index) => {
            // Create a new <div> for the translation
            const translationDiv = document.createElement('div');
            translationDiv.textContent = lyricsTranslations[index];
            translationDiv.style.fontStyle = 'italic'; // Optional: Add styling
            translationDiv.style.color = '#999'; // Optional: Change text color

            // Add a class name to the new div
            translationDiv.className = 'translated';
            // Insert the translation <div> below the original lyric
            // lyricsWrapper.appendChild(translationDiv);
            const lyricsChildren = Array.from(lyricsWrapper.children);

            if (lyricsChildren.length > 1) {
              // Insert the translation div after the second lyric
              lyricsWrapper.insertBefore(
                translationDiv,
                lyricsChildren[1].nextSibling
              );
            } else {
              // Fallback: Append if there aren't enough children
              lyricsWrapper.appendChild(translationDiv);
            }
          });
        }
      }
    }
  );
})();

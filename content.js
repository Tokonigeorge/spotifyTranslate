console.log('here oo');
(() => {
  function observeLyrics() {
    let lastLyrics = null;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(() => {
        const lyricsWrapperList = document.querySelectorAll(
          "div[data-testid='fullscreen-lyric']"
        );

        if (lyricsWrapperList.length > 0) {
          const lyricsList = [];
          lyricsWrapperList.forEach((lyricsWrapper) => {
            const lyrics = lyricsWrapper.textContent.trim();
            lyricsList.push(lyrics);
          });

          // if (JSON.stringify(lyricsList) !== JSON.stringify(lastLyrics)) {
          //   // Update the stored lyrics
          //   lastLyrics = lyricsList;

          //   // Send the new lyrics to the background script
          //   chrome.runtime.sendMessage(
          //     {
          //       type: 'lyricSend',
          //       lyrics: lyricsList,
          //     },
          //     (response) => {
          //       if (chrome.runtime.lastError) {
          //         console.error(
          //           'Failed to send message:',
          //           chrome.runtime.lastError.message
          //         );
          //       } else {
          //         console.log('Lyrics sent successfully:', response);
          //       }
          //     }
          //   );
          // }
          chrome.runtime.sendMessage({
            type: 'lyricSend',
            lyrics: lyricsList,
          });

          // chrome.runtime.onInstalled.addListener(() => {
          //   chrome.runtime.sendMessage({
          //     type: 'lyricSend',
          //     lyrics: lyricsList,
          //   });
          //   console.log('Extension installed, background script ready');
          // });

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
        const lyricsTranslations = message.translatedLyrics?.[0].split('\n');
        if (lyricsWrapperList && lyricsTranslations.length > 0) {
          lyricsWrapperList.forEach((lyricsWrapper, index) => {
            // Create a new <div> for the translation
            const translationDiv = document.createElement('div');
            translationDiv.textContent = lyricsTranslations[index];
            translationDiv.style.fontStyle = 'italic'; // Optional: Add styling
            translationDiv.style.color = '#999'; // Optional: Change text color

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

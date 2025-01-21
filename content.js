console.log('Content script injected into Spotify page.');
(() => {
  console.log('Content script loaded.');
  const lyricsWrapperList = document.querySelectorAll(
    "div[data-testid='fullscreen-lyric']"
  );

  if (lyricsWrapperList.length > 0) {
    const lyricsList = [];
    lyricsWrapperList.forEach((lyricsWrapper) => {
      const lyrics = lyricsWrapper.textContent.trim();
      lyricsList.push(lyrics);
    });

    console.log(
      'Lyrics found',
      lyricsList.filter((lyric) => !lyric)
    );
    chrome.runtime.sendMessage({ type: 'lyricsUpdate', lyrics: lyricsList });
  }

  function observeLyrics() {
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

          console.log(
            'Lyrics found',
            lyricsList.filter((lyric) => !lyric)
          );
          chrome.runtime.sendMessage({
            type: 'lyricsUpdate',
            lyrics: lyricsList,
          });
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
  }

  observeLyrics();
})();

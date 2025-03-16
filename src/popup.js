'use strict';

class PopupState {
  constructor() {
    // Initialize connection to background script
    this.port = chrome.runtime.connect({ name: 'popup' });

    this.elements = {
      nowPlaying: document.querySelector('.now-playing'),
      coverArt: document.querySelector('.cover-art'),
      songTitle: document.querySelector('.song-title'),
      artistsName: document.querySelector('.artists-name'),
      languageSelect: document.getElementById('language'),
      languageSelector: document.querySelector('.language-selector'),
    };

    this.lastSongData = null;
  }

  async init() {
    const { selectedLanguage } = await chrome.storage.local.get(
      'selectedLanguage'
    );
    this.setSelectedLanguage(selectedLanguage);

    this.setupMessageListener();
    this.setupLanguageChangeListener();

    await this.navigateToSpotifyTab();

    await this.requestInitialSongData();
  }

  setupMessageListener() {
    this.port.onMessage.addListener((message) => {
      if (message.type === 'lyricsUpdate') {
        console.log('handle song update call');
        this.handleSongDataUpdate(message.songData);
      }
    });
  }

  setupLanguageChangeListener() {
    this.elements.languageSelect.addEventListener('change', async (e) => {
      const newLanguage = e.target.value;
      const { selectedLanguage } = await chrome.storage.local.get(
        'selectedLanguage'
      );

      if (newLanguage !== selectedLanguage) {
        await this.updateLanguage(newLanguage);
      }
    });
  }

  async navigateToSpotifyTab() {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab?.url?.startsWith('https://open.spotify.com/')) {
      return; // Already on Spotify tab
    }

    const spotifyTabs = await chrome.tabs.query({
      url: 'https://open.spotify.com/*',
    });

    if (spotifyTabs.length > 0) {
      // Switch to existing Spotify tab
      await chrome.tabs.update(spotifyTabs[0].id, { active: true });
      await chrome.windows.update(spotifyTabs[0].windowId, { focused: true });
    } else {
      // Create new Spotify tab
      await chrome.tabs.create({ url: 'https://open.spotify.com' });
    }
  }
  async requestInitialSongData() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'getCurrentSongData' },
          (response) => {
            resolve(response);
          }
        );
      });

      if (response?.songData) {
        this.handleSongDataUpdate(response.songData);
      } else {
        console.log('No song data found, requesting re-observation.');
        this.triggerContentScriptObservation();
      }
    } catch (error) {
      console.error('Error getting initial song data:', error);
    }
  }

  async triggerContentScriptObservation() {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { type: 'triggerObservation' });
    }
  }

  async updateLanguage(newLanguage) {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, {
        type: 'languageChange',
        newValue: newLanguage,
      });
    }

    await chrome.storage.local.set({ selectedLanguage: newLanguage });
  }

  handleSongDataUpdate(songData) {
    if (
      !songData ||
      JSON.stringify(this.lastSongData) === JSON.stringify(songData)
    ) {
      return;
    }

    this.lastSongData = songData;
    this.updateDisplay(songData);
  }

  updateDisplay(songData) {
    const { coverArt, songTitle, artists } = songData;

    if (coverArt && songTitle && artists) {
      this.elements.nowPlaying.style.display = 'block';
      this.elements.languageSelector.style.display = 'block';
      this.elements.coverArt.src = coverArt;
      this.elements.songTitle.textContent = songTitle;
      this.elements.artistsName.textContent = artists;
    } else {
      this.elements.nowPlaying.style.display = 'none';
      this.elements.languageSelector.style.display = 'none';
    }
  }

  setSelectedLanguage(selectedLanguage) {
    const option = this.elements.languageSelect.querySelector(
      `option[value="${selectedLanguage}"]`
    );
    if (option) {
      option.selected = true;
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const popup = new PopupState();
  popup.init();
});

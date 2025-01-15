// Handle Spotify authentication and background tasks
// const REDIRECT_URI = chrome.identity.getRedirectURL();

// import { fetchLyrics } from './src/services/lyrics';

async function fetchLyrics(trackName, artistName) {
  try {
    const response = await fetch(
      `${SERVER_URL}/api/lyrics/search?track=${encodeURIComponent(
        trackName
      )}&artist=${encodeURIComponent(artistName)}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || !data.lyrics) return null;

    // // Now fetch the lyrics page and scrape it
    // const lyricsResponse = await fetch(data.url);
    // const html = await lyricsResponse.text();

    // // Extract lyrics from the HTML using regex
    // const lyricsMatch = html.match(
    //   /<div class="Lyrics-sc-[^>]+>([^<]+)<\/div>/g
    // );
    // const lyrics = lyricsMatch
    //   ? lyricsMatch
    //       .map((line) => line.replace(/<[^>]+>/g, ''))
    //       .join('\n')
    //       .trim()
    //       .split('\n')
    //   : null;

    return {
      lyrics: data.lyrics,
      url: data.url,
      title: data.title,
      artist: data.artist,
      albumArt: data.album_art,
    };
  } catch (error) {
    console.error('Error searching lyrics:', error);
    return null;
  }
}

const REDIRECT_URI =
  'https://hkjmddjpkjmmnhapealcokhehnoeoogk.chromiumapp.org/';
// const REDIRECT_URI = 'http://localhost:3000';
const SCOPES = ['user-read-currently-playing'];
const SERVER_URL = 'http://localhost:3000';

let accessToken = null;

async function getAuthToken() {
  try {
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `${SERVER_URL}/auth/spotify?redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${state}`;

    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    if (redirectUrl) {
      const hash = redirectUrl.split('#')[1];
      const params = new URLSearchParams(hash);
      accessToken = params.get('access_token');
      await checkCurrentTrack();
      return accessToken;
    }
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

async function checkCurrentTrack() {
  try {
    const response = await fetch(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) return null;

    const currentTrack = await response.json();
    if (!currentTrack || !currentTrack.item) return null;
    console.log('currenttrack', response);
    if (currentTrack) {
      const trackInfo = {
        name: currentTrack.item?.name,
        artists: currentTrack.item?.artists?.map((artist) => artist.name),
        id: currentTrack.item?.id,
      };

      const lyricsInfo = await fetchLyrics(
        trackInfo.name,
        trackInfo.artists[0]
      );
      console.log('lyricsinfo', lyricsInfo);
      if (lyricsInfo) {
        trackInfo.lyrics = lyricsInfo.lyrics;
        trackInfo.lyricsUrl = lyricsInfo.url;
        trackInfo.albumArt = lyricsInfo.albumArt;
      }
      await chrome.storage.local.set({ currentTrack: trackInfo });
      return trackInfo;
    } else {
      await chrome.storage.local.remove('currentTrack');
      return null;
    }
  } catch (error) {
    console.error('Error checking current track:', error);
    return null;
  }
}

// async function fetchLyrics(track, artist) {
//   try {
//     const response = await fetch(
//       `${SERVER_URL}/api/lyrics/search?track=${encodeURIComponent(
//         track
//       )}&artist=${encodeURIComponent(artist)}`
//     );

//     if (!response.ok) return null;

//     return await response.json();
//   } catch (error) {
//     console.error('Error searching lyrics:', error);
//     return null;
//   }
// }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getToken') {
    getAuthToken().then((token) => {
      sendResponse({ token });
    });
    return true;
  }

  if (request.type === 'checkAuth') {
    sendResponse({ isAuthenticated: !!accessToken });
    return true;
  }

  if (request.type === 'getCurrentTrack') {
    checkCurrentTrack().then((track) => {
      sendResponse({ track });
    });
    return true;
  }
});

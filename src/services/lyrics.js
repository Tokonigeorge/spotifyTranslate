export async function fetchLyrics(trackName, artistName) {
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

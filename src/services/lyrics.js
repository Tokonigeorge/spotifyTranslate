export async function searchLyrics(trackName, artistName) {
  try {
    const response = await fetch(
      `${SERVER_URL}/api/lyrics/search?track=${encodeURIComponent(
        trackName
      )}&artist=${encodeURIComponent(artistName)}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching lyrics:', error);
    return null;
  }
}

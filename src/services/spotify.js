// Spotify API service
export async function getCurrentTrack(token) {
  try {
    const response = await fetch(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return await response.json();
  } catch (error) {
    console.error('Error fetching current track:', error);
    return null;
  }
}

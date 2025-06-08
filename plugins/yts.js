const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios"); // Make sure axios is imported

// Helper function to format seconds into a timestamp string (MM:SS or HH:MM:SS)
function formatSecondsToTimestamp(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(String(hours).padStart(2, '0'));
  parts.push(String(minutes).padStart(2, '0'));
  parts.push(String(seconds).padStart(2, '0'));
  return parts.join(':');
}

// --- NEW HELPER FUNCTION: To extract YouTube Video ID ---
function extractVideoId(url) {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/);
  return match ? match[1] : null;
}

// --- NEW FUNCTION: To download audio using RapidAPI ---
async function downloadAudioRapidAPI(youtubeUrl) {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL or video ID not found.');
  }

  const options = {
    method: 'GET',
    url: 'https://youtube-media-downloader.p.rapidapi.com/v2/video/details',
    params: {
      videoId: videoId,
      urlAccess: 'normal',
      videos: 'auto', // You can set this to 'false' if you only need audio, or 'auto' to get all
      audios: 'auto' // Set to 'auto' to get all available audio qualities
    },
    headers: {
      // ** IMPORTANT: REPLACE WITH YOUR ACTUAL RAPIDAPI KEY **
      'x-rapidapi-key': '7fe4b1157dmsh575ef6592b6e2eap18615cjsn670c894bd2bb', // Your key from the provided example
      'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com'
    }
  };

  try {
    const response = await axios.request(options);

    if (response.data.status !== 'ok' || !response.data.data || !response.data.data.audios || response.data.data.audios.length === 0) {
      throw new Error('RapidAPI: Failed to get audio details or no audio streams found.');
    }

    const audioStreams = response.data.data.audios;
    const title = response.data.data.title; // Get the title from the RapidAPI response

    // --- Logic to pick the best audio stream ---
    // This example prioritizes 'mp3' format, then falls back to the first available stream.
    // You might need to adjust this based on the actual qualities/formats returned by the API
    // and your preference (e.g., highest bitrate, smallest size, etc.).
    let bestAudio = audioStreams.find(stream => stream.format === 'mp3' || stream.format === 'm4a');
    
    // If no specific format found, just take the first one
    if (!bestAudio) {
      bestAudio = audioStreams[0];
    }

    if (!bestAudio || !bestAudio.url) {
      throw new Error('RapidAPI: No suitable audio stream found to download.');
    }

    // Download the audio buffer
    const audioBufferResponse = await axios.get(bestAudio.url, { responseType: 'arraybuffer' });
    
    // Determine the mimetype dynamically if possible, otherwise default to 'audio/mpeg'
    const mimetype = bestAudio.format === 'm4a' ? 'audio/mp4' : 'audio/mpeg'; // For mp3 use audio/mpeg

    return { buffer: audioBufferResponse.data, title: title || 'Downloaded Audio', mimetype: mimetype };

  } catch (error) {
    console.error("Error with RapidAPI download:", error.response ? error.response.data : error.message);
    throw new Error("Failed to download audio via RapidAPI: " + (error.response?.data?.message || error.message || 'Unknown error'));
  }
}


cmd(
  {
    pattern: "song", // Command trigger
    react: "🎶",
    desc: "Download YouTube Song/Audio",
    category: "download",
    filename: __filename,
  },
  async (
    conn,
    mek,
    m,
    { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }
  ) => {
    try {
      if (!q) return reply("*🎶 Provide a song name or a YouTube link.*");

      // Regular expression to check if 'q' is a YouTube URL
      const ytUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/g;

      let videoInfo; // This object will store the standardized video details

      if (ytUrlRegex.test(q)) {
        // If 'q' is a YouTube URL, try to get info directly
        try {
          const info = await yts.getInfo(q);
          // Map yts.getInfo structure to a consistent format
          videoInfo = {
            title: info.videoDetails.title,
            url: info.videoDetails.video_url,
            thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url, // Get largest thumbnail
            timestamp: formatSecondsToTimestamp(parseInt(info.videoDetails.lengthSeconds)),
            views: parseInt(info.videoDetails.viewCount).toLocaleString(),
            ago: info.videoDetails.uploadDate, // This will be the upload date string
            author: { name: info.videoDetails.author.name },
          };
        } catch (e) {
          console.error("Error getting info for YouTube URL via yts.getInfo:", e);
          // Fallback to search if direct info fails for a URL (e.g., malformed URL, API error)
          reply("⚠️ Could not get exact information for the provided YouTube link directly. Attempting to search instead...");
          const search = await yts(q);
          videoInfo = search.videos[0];
        }
      } else {
        // If not a URL, perform a regular search
        const search = await yts(q);
        videoInfo = search.videos[0]; // Get the first search result
      }

      if (!videoInfo) return reply("❌ No song found for your query.");

      const url = videoInfo.url; // The YouTube URL for the video

      // Song info message using the standardized videoInfo object
      let desc = `🎶 *APEX-MD SONG DOWNLOADER* 🎶

👻 *Title* : ${videoInfo.title}
👻 *Duration* : ${videoInfo.timestamp || 'N/A'}
👻 *Views* : ${videoInfo.views || 'N/A'}
👻 *Uploaded* : ${videoInfo.ago || 'N/A'}
👻 *Channel* : ${videoInfo.author.name || 'N/A'}
👻 *Link* : ${videoInfo.url}

MADE BY SHEHAN VIMUKYHI`;

      await conn.sendMessage(
        from,
        { image: { url: videoInfo.thumbnail }, caption: desc },
        { quoted: mek }
      );

      reply("*⏳ Downloading your song... Please wait!*");

      // --- REPLACE THE OLD downloadAudio CALL WITH THE NEW ONE ---
      const audio = await downloadAudioRapidAPI(url); 

      const cleanTitle = audio.title.replace(/[\\/:*?"<>|]/g, ""); // Remove invalid characters from filename

      await conn.sendMessage(
        from,
        {
          audio: audio.buffer,
          mimetype: audio.mimetype || "audio/mpeg", // Use dynamic mimetype or default
          fileName: `${cleanTitle}.mp3`, // Can change extension based on actual format if needed
          ptt: false // Set to true if you want to send as voice message
        },
        { quoted: mek }
      );

      await reply(`🎶 *${audio.title}*\n\nMADE BY APEX-MD`);

    } catch (error) {
      console.error("Error in song command:", error);
      reply("❌ Error downloading song. Please try again later. It might be due to an issue with the download service or an invalid link.");
    }
  }
);
const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios"); // axios already imported

// --- NEOXR API CONFIGURATION ---
const NEOXR_BASE_URL = "https://api.neoxr.eu";
// Replace 'YOUR_NEOXR_API_KEY_HERE' with your actual Neoxr API Key.
// IMPORTANT: For production, use process.env.NEOXR_API_KEY to keep your key secure.
const NEOXR_API_KEY = "YOUR_NEOXR_API_KEY_HERE"; 
// Example from screenshot: "gfF9pr". You need your own.

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

cmd(
  {
    pattern: "song", // Command trigger
    react: "🎶",
    desc: "Download YouTube Song/Audio using Neoxr API",
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

      let videoInfo; // This object will store the standardized video details from yts

      if (ytUrlRegex.test(q)) {
        // If 'q' is a YouTube URL, try to get info directly using yts.getInfo
        try {
          const info = await yts.getInfo(q);
          // Map yts.getInfo structure to a consistent format
          videoInfo = {
            id: info.videoDetails.videoId,
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
          reply("⚠️ Could not get exact information for the provided YouTube link directly. Attempting to search instead...");
          const search = await yts(q);
          videoInfo = search.videos[0]; // Fallback to search if direct info fails
        }
      } else {
        // If not a URL, perform a regular search
        const search = await yts(q);
        videoInfo = search.videos[0]; // Get the first search result
      }

      if (!videoInfo) return reply("❌ No song found for your query.");

      const youtubeUrlToDownload = videoInfo.url; // The YouTube URL for the video, used for Neoxr API

      // Song info message using the standardized videoInfo object from yts
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

      reply("*⏳ Fetching audio details from Neoxr API... Please wait!*");

      // --- Call Neoxr API for Audio Download ---
      try {
        const neoxrResponse = await axios.get(`${NEOXR_BASE_URL}/api/youtube`, {
          params: {
            url: youtubeUrlToDownload,
            type: 'audio',
            quality: '128kbps', // As per the screenshot
            apikey: NEOXR_API_KEY
          }
        });

        const json = neoxrResponse.data;

        if (!json.status) {
          // If Neoxr API returns an error status
          return reply(`❌ Neoxr API Error: ${json.message || 'Unknown error occurred from API.'}`);
        }

        const audioData = json.data;
        const audioUrl = audioData.url;
        const audioTitle = json.title;
        const audioSize = audioData.size; // e.g., "3.7 MB"
        const audioFilename = audioData.filename; // e.g., "KOMANG - RAIM LAODE LYRIC OFFICIAL.mp3"

        // Optional: Implement size limit check if your bot has one.
        // Example:
        // const MAX_AUDIO_SIZE_MB = 50; // Set your limit
        // const actualSizeMB = parseFloat(audioSize.replace('MB', '').trim());
        // if (actualSizeMB > MAX_AUDIO_SIZE_MB) {
        //   return reply(`⚠️ File size (${audioSize}) exceeds the maximum limit of ${MAX_AUDIO_SIZE_MB} MB.`);
        // }

        reply(`*✅ Audio details fetched! Size: ${audioSize}. Sending the audio file...*`);

        // Send the audio file using the direct URL from Neoxr API
        // Most WhatsApp bot libraries (like Baileys) support sending documents/audio directly from a URL.
        await conn.sendMessage(
          from,
          {
            document: { url: audioUrl }, // Send as a document for better file management
            mimetype: "audio/mpeg",
            fileName: audioFilename, // Use the filename provided by the API
            caption: `🎶 *${audioTitle}*\n\n_Size: ${audioSize}_\n\nMADE BY APEX-MD`
          },
          { quoted: mek }
        );

      } catch (neoxrApiError) {
        console.error("Error calling Neoxr API:", neoxrApiError);
        // Handle specific Axios errors for better debugging
        if (neoxrApiError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          reply(`❌ Neoxr API Request Failed: ${neoxrApiError.response.status} - ${neoxrApiError.response.statusText}. Data: ${JSON.stringify(neoxrApiError.response.data)}`);
        } else if (neoxrApiError.request) {
          // The request was made but no response was received
          reply(`❌ Neoxr API No Response: Could not reach the API server. Check your internet connection or API server status.`);
        } else {
          // Something happened in setting up the request that triggered an Error
          reply(`❌ Error setting up Neoxr API request: ${neoxrApiError.message}`);
        }
      }

    } catch (error) {
      console.error("Error in song command:", error);
      reply("❌ Error downloading song. Please try again later. It might be due to an issue with the download service or an invalid link.");
    }
  }
);
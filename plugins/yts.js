const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

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

      const downloadAudio = async (url) => {
        const apiUrl = `https://p.oceansaver.in/ajax/download.php?format=mp3&url=${encodeURIComponent(
          url
        )}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`; // Your API Key is hardcoded here. Be cautious if this is public.

        const response = await axios.get(apiUrl);

        if (response.data && response.data.success) {
          const { id, title } = response.data;
          const progressUrl = `https://p.oceansaver.in/ajax/progress.php?id=${id}`;

          while (true) {
            const progress = await axios.get(progressUrl);
            if (progress.data.success && progress.data.progress === 1000) {
              const audioBuffer = await axios.get(
                progress.data.download_url,
                {
                  responseType: "arraybuffer",
                }
              );
              return { buffer: audioBuffer.data, title };
            }
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before checking progress again
          }
        } else {
          throw new Error("Failed to fetch audio details or API error: " + (response.data ? JSON.stringify(response.data) : 'Unknown error'));
        }
      };

      reply("*⏳ Downloading your song... Please wait!*");

      const audio = await downloadAudio(url);

      const cleanTitle = audio.title.replace(/[\\/:*?"<>|]/g, ""); // Remove invalid characters from filename

      await conn.sendMessage(
        from,
        {
          audio: audio.buffer,
          mimetype: "audio/mpeg",
          fileName: `${cleanTitle}.mp3`,
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
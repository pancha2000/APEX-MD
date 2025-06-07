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
    pattern: "video",
    react: "🎥",
    desc: "Download YouTube Video",
    category: "download",
    filename: __filename,
  },
  async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }) => {
    try {
      if (!q) return reply("🎥 Provide a video name or a YouTube link. (e.g., `!video song name` or `!video youtube link 720`)");

      const ytUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/g;

      let videoInfo; // This object will store the standardized video details
      let requestedQuality = "360"; // Default quality if not specified

      // Check if the last argument is a number representing quality
      const potentialQuality = args[args.length - 1]; // args is an array of words in q
      if (potentialQuality && !isNaN(potentialQuality) && parseInt(potentialQuality) > 0) {
          const qNum = parseInt(potentialQuality);
          // Common qualities to validate against (can be extended if the API supports more)
          const validQualities = ["144", "240", "360", "480", "720", "1080"];
          if (validQualities.includes(qNum.toString())) {
              requestedQuality = qNum.toString();
              // Remove the quality from the search query 'q'
              q = q.substring(0, q.lastIndexOf(potentialQuality)).trim();
              if (!q) return reply("Please provide a video name or link along with the quality. (e.g., `!video song name 720`)");
          }
      }

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
          videoInfo = search.videos[0]; // Get the first search result
        }
      } else {
        // If not a URL, perform a regular search
        const search = await yts(q);
        videoInfo = search.videos[0]; // Get the first search result
      }

      if (!videoInfo) return reply("❌ No video results found for your query.");

      const url = videoInfo.url; // The YouTube URL for the video

      // Video info message using the standardized videoInfo object
      let desc = `🎥 *APEX-MD VIDEO DOWNLOADER* 🎥

👻 *Title* : ${videoInfo.title}
👻 *Duration* : ${videoInfo.timestamp || 'N/A'}
👻 *Views* : ${videoInfo.views || 'N/A'}
👻 *Uploaded* : ${videoInfo.ago || 'N/A'}
👻 *Channel* : ${videoInfo.author.name || 'N/A'}
👻 *Link* : ${videoInfo.url}
👻 *Requested Quality* : ${requestedQuality}p

MADE BY SHEHAN VIMUKYHI`;

      await conn.sendMessage(
        from,
        { image: { url: videoInfo.thumbnail }, caption: desc },
        { quoted: mek }
      );

      const downloadVideo = async (url, quality) => {
        const apiUrl = `https://p.oceansaver.in/ajax/download.php?format=${quality}&url=${encodeURIComponent(url)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;

        const response = await axios.get(apiUrl);

        if (response.data && response.data.success) {
          const { id, title } = response.data;
          const progressUrl = `https://p.oceansaver.in/ajax/progress.php?id=${id}`;

          while (true) {
            const progress = await axios.get(progressUrl);
            if (progress.data.success && progress.data.progress === 1000) {
              const videoBuffer = await axios.get(progress.data.download_url, {
                responseType: "arraybuffer",
              });
              return { buffer: videoBuffer.data, title };
            }
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before checking progress again
          }
        } else {
          throw new Error("Failed to fetch video details or API error: " + (response.data ? JSON.stringify(response.data) : 'Unknown error'));
        }
      };

      reply(`*⏳ Downloading your video in ${requestedQuality}p... Please wait!*`);

      const video = await downloadVideo(url, requestedQuality);

      const cleanTitle = video.title.replace(/[\\/:*?"<>|]/g, ""); // Remove invalid characters from filename

      await conn.sendMessage(
        from,
        {
          video: video.buffer,
          caption: `🎥 *${video.title}*\n\nMADE BY APEX-MD`,
          fileName: `${cleanTitle}.mp4`,
        },
        { quoted: mek }
      );

    } catch (error) {
      console.error("Error in video command:", error);
      reply("❌ Error downloading video. Please try again later. It might be due to an issue with the download service, an invalid link, or unavailable quality for the chosen video.");
    }
  }
);
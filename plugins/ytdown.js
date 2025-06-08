import fetch from 'node-fetch'; // Add node-fetch for downloading the final buffer
import { cmd } from "../command"; // Assumes this is how your command handler is imported
import yts from "yt-search"; // Used for YouTube search and getting video info
import api from 'api-qasim'; // Import api-qasim (make sure it's installed: npm install api-qasim)

// Helper function to format seconds into a timestamp string (MM:SS or HH:MM:SS)
function formatSecondsToTimestamp(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return 'N/A'; // Handle invalid input
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

// ----------------------------------------------------
// Common function to handle YouTube download (Video or Audio)
// ----------------------------------------------------
async function handleYouTubeDownload(conn, mek, m, { from, q, reply, command, args, isVideo }) {
  const downloadType = isVideo ? "video" : "audio";
  const reactEmoji = isVideo ? "🎥" : "🎵";
  const exampleCommand = isVideo ? `!video song name` : `!audio song name`;
  const qualityHint = isVideo ? ` or !video youtube link 720` : ``;

  if (!q) return reply(`• Provide a ${downloadType} name or a YouTube link. (e.g., \`${exampleCommand}${qualityHint}\`)`);

  await m.react(reactEmoji);

  const ytUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/g;

  let videoInfo; // This object will store the standardized video details
  let requestedQuality = isVideo ? "360" : "audio"; // Default video quality, or 'audio' for audio downloads

  // Check if the last argument is a number representing quality (only for video)
  if (isVideo) {
    const potentialQuality = args[args.length - 1]; // args is an array of words in q
    if (potentialQuality && !isNaN(potentialQuality) && parseInt(potentialQuality) > 0) {
      const qNum = parseInt(potentialQuality);
      // Common qualities to validate against. Extend if API supports more.
      const validQualities = ["144", "240", "360", "480", "720", "1080"];
      if (validQualities.includes(qNum.toString())) {
        requestedQuality = qNum.toString();
        // Remove the quality from the search query 'q'
        q = q.substring(0, q.lastIndexOf(potentialQuality)).trim();
        if (!q) return reply(`Please provide a ${downloadType} name or link along with the quality. (e.g., \`${exampleCommand} 720\`)`);
      }
    }
  }

  try {
    let isDirectUrl = false;
    if (ytUrlRegex.test(q)) {
      isDirectUrl = true;
      try {
        // Try to get info directly from URL
        const info = await yts.getInfo(q);
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
        // Fallback to search if direct info fails for a URL
        reply("⚠️ Could not get exact information for the provided YouTube link directly. Attempting to search instead...");
        const search = await yts(q);
        videoInfo = search.videos[0]; // Get the first search result
      }
    } else {
      // If not a URL, perform a regular search
      const search = await yts(q);
      videoInfo = search.videos[0]; // Get the first search result
    }

    if (!videoInfo) {
      await m.react('❌');
      return reply(`❌ No ${downloadType} results found for your query.`);
    }

    const ytVideoUrl = videoInfo.url; // The YouTube URL for the video

    // Video/Audio info message using the standardized videoInfo object
    let desc = `🎧 *APEX-MD ${downloadType.toUpperCase()} DOWNLOADER* 🎧\n\n` +
               `👻 *Title* : ${videoInfo.title}\n` +
               `👻 *Duration* : ${videoInfo.timestamp || 'N/A'}\n` +
               `👻 *Views* : ${videoInfo.views || 'N/A'}\n` +
               `👻 *Uploaded* : ${videoInfo.ago || 'N/A'}\n` +
               `👻 *Channel* : ${videoInfo.author.name || 'N/A'}\n` +
               `👻 *Link* : ${videoInfo.url}\n`;
    if (isVideo) {
      desc += `👻 *Requested Quality* : ${requestedQuality}p\n\n`;
    } else {
      desc += `\n`;
    }
    desc += `MADE BY SHEHAN VIMUKYHI`;

    await conn.sendMessage(
      from,
      { image: { url: videoInfo.thumbnail }, caption: desc },
      { quoted: mek }
    );

    // --- NEW DOWNLOAD LOGIC USING api-qasim and node-fetch ---
    reply(`*⏳ Downloading your ${downloadType} in ${isVideo ? requestedQuality + 'p' : ''}... Please wait!*`);

    let downloadResult;
    try {
        if (isVideo) {
            // **IMPORTANT: Replace with actual api-qasim function call for MP4 download**
            // Example: api.youtube.mp4(ytVideoUrl, requestedQuality);
            // Example: api.youtube.getmp4(ytVideoUrl, { quality: requestedQuality });
            downloadResult = await api.youtube.mp4(ytVideoUrl, requestedQuality); // Placeholder. Check API Qasim Docs!
        } else {
            // **IMPORTANT: Replace with actual api-qasim function call for MP3 download**
            // Example: api.youtube.mp3(ytVideoUrl);
            // Example: api.youtube.getmp3(ytVideoUrl);
            downloadResult = await api.youtube.mp3(ytVideoUrl); // Placeholder. Check API Qasim Docs!
        }

        // Validate the downloadResult structure from api-qasim
        // It's expected to have a 'url' property for the direct download link
        if (!downloadResult || typeof downloadResult !== 'object' || !downloadResult.url) {
            console.error("api-qasim download result invalid:", downloadResult);
            throw new Error("Invalid download result structure from API Qasim. Check API Qasim documentation.");
        }
    } catch (apiError) {
        console.error("API Qasim error:", apiError);
        await m.react('❌');
        return reply(`❌ Error fetching ${downloadType} details from APEX-MD API. It might not support this video or quality, or API Qasim returned an error: ${apiError.message || apiError}.`);
    }

    const directDownloadLink = downloadResult.url;
    // Use title from downloadResult if available, otherwise fallback to videoInfo
    const downloadedTitle = downloadResult.title || videoInfo.title;

    let fileBuffer;
    try {
        const response = await fetch(directDownloadLink);
        if (!response.ok) {
            throw new Error(`Failed to download file from provided link: HTTP Status ${response.status} - ${response.statusText}`);
        }
        fileBuffer = await response.buffer(); // Get the file as a buffer
    } catch (fetchError) {
        console.error("node-fetch download error:", fetchError);
        await m.react('❌');
        return reply(`❌ Error downloading the ${downloadType} file. The download link might be broken, temporary, or network issue: ${fetchError.message || fetchError}.`);
    }

    const cleanTitle = downloadedTitle.replace(/[\\/:*?"<>|]/g, ""); // Remove invalid characters for filename

    if (isVideo) {
      await conn.sendMessage(
        from,
        {
          video: fileBuffer,
          caption: `🎥 *${downloadedTitle}*\n\nMADE BY APEX-MD`,
          fileName: `${cleanTitle}.mp4`,
          mimetype: 'video/mp4' // Explicitly set mimetype
        },
        { quoted: mek }
      );
    } else {
      await conn.sendMessage(
        from,
        {
          audio: fileBuffer,
          mimetype: 'audio/mpeg', // Common MIME type for MP3
          fileName: `${cleanTitle}.mp3`,
          ptt: false // Not a voice note
        },
        { quoted: mek }
      );
    }

    await m.react('✅');
    reply(`• *${downloadedTitle} ${downloadType} downloaded successfully!*`);

  } catch (error) {
    console.error(`Unhandled error in ${command} command:`, error);
    await m.react('❌');
    reply("❌ An unexpected error occurred. Please try again later. If the issue persists, contact the bot owner.");
  }
}

// ----------------------------------------------------
// Define the 'video' command
// ----------------------------------------------------
cmd(
  {
    pattern: "video",
    react: "🎥",
    desc: "Download YouTube Video",
    category: "download",
    filename: __filename,
  },
  async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }) => {
    await handleYouTubeDownload(conn, mek, m, { from, q, reply, command, args, isVideo: true });
  }
);

// ----------------------------------------------------
// Define the 'audio' command (New command for audio downloads)
// ----------------------------------------------------
cmd(
  {
    pattern: "audio",
    react: "🎵",
    desc: "Download YouTube Audio (MP3)",
    category: "download",
    filename: __filename,
  },
  async (conn, mek, m, { from, q, reply, command, args, q, isGroup, sender, reply }) => {
    await handleYouTubeDownload(conn, mek, m, { from, q, reply, command, args, isVideo: false });
  }
);
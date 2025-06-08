// plugins/ytdown.js
const fetch = require('node-fetch'); // CHANGE: import fetch from 'node-fetch';
const { cmd } = require("../command"); // CHANGE: import { cmd } from "../command";
const yts = require("yt-search"); // CHANGE: import yts from "yt-search";
const Qasim = require('api-qasim'); // CHANGE: import Qasim from 'api-qasim';

// Helper function to format seconds into a timestamp string (MM:SS or HH:MM:SS)
function formatSecondsToTimestamp(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return 'N/A';
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

  let videoInfo;
  let requestedQuality = isVideo ? "360" : "audio";

  if (isVideo) {
    const potentialQuality = args[args.length - 1];
    if (potentialQuality && !isNaN(potentialQuality) && parseInt(potentialQuality) > 0) {
      const qNum = parseInt(potentialQuality);
      const validQualities = ["144", "240", "360", "480", "720", "1080"];
      if (validQualities.includes(qNum.toString())) {
        requestedQuality = qNum.toString();
        q = q.substring(0, q.lastIndexOf(potentialQuality)).trim();
        if (!q) return reply(`Please provide a ${downloadType} name or link along with the quality. (e.g., \`${exampleCommand} 720\`)`);
        reply(`⚠️ Note: The API Qasim's \`ytmp4\` function might not support specific quality selection (${requestedQuality}p) directly. It will download the default quality available from the API.`);
      }
    }
  }

  try {
    let isDirectUrl = false;
    if (ytUrlRegex.test(q)) {
      isDirectUrl = true;
      try {
        const info = await yts.getInfo(q);
        videoInfo = {
          title: info.videoDetails.title,
          url: info.videoDetails.video_url,
          thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
          timestamp: formatSecondsToTimestamp(parseInt(info.videoDetails.lengthSeconds)),
          views: parseInt(info.videoDetails.viewCount).toLocaleString(),
          ago: info.videoDetails.uploadDate,
          author: { name: info.videoDetails.author.name },
        };
      } catch (e) {
        console.error("Error getting info for YouTube URL via yts.getInfo:", e);
        reply("⚠️ Could not get exact information for the provided YouTube link directly. Attempting to search instead...");
        const search = await yts(q);
        videoInfo = search.videos[0];
      }
    } else {
      const search = await yts(q);
      videoInfo = search.videos[0];
    }

    if (!videoInfo) {
      await m.react('❌');
      return reply(`❌ No ${downloadType} results found for your query.`);
    }

    const ytVideoUrl = videoInfo.url;

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

    reply(`*⏳ Downloading your ${downloadType} in ${isVideo ? requestedQuality + 'p' : ''}... Please wait!*`);

    let rawDownloadResult;
    let downloadResult;

    try {
        if (isVideo) {
            rawDownloadResult = await Qasim.ytmp4(ytVideoUrl);
        } else {
            rawDownloadResult = await Qasim.ytmp3(ytVideoUrl);
        }

        // Check if the response has a 'data' property
        if (rawDownloadResult && rawDownloadResult.data) {
            downloadResult = rawDownloadResult.data;
        } else {
            downloadResult = rawDownloadResult;
        }

        if (!downloadResult || typeof downloadResult !== 'object' || !downloadResult.url) {
            console.error("API Qasim raw result:", rawDownloadResult);
            console.error("API Qasim parsed result:", downloadResult);
            throw new Error("Invalid download result structure from API Qasim. 'url' property not found. The API might have changed or returned an unexpected format.");
        }
    } catch (apiError) {
        console.error("API Qasim error during download link retrieval:", apiError);
        await m.react('❌');
        return reply(`❌ Error fetching ${downloadType} details from APEX-MD API. It might not support this video or quality, or API Qasim returned an error: ${apiError.message || "Unknown API error"}.`);
    }

    const directDownloadLink = downloadResult.url;
    const downloadedTitle = downloadResult.title || videoInfo.title;

    let fileBuffer;
    try {
        const response = await fetch(directDownloadLink);
        if (!response.ok) {
            throw new Error(`Failed to download file from provided link: HTTP Status ${response.status} - ${response.statusText}`);
        }
        fileBuffer = await response.buffer();
    } catch (fetchError) {
        console.error("node-fetch download error:", fetchError);
        await m.react('❌');
        return reply(`❌ Error downloading the ${downloadType} file. The download link might be broken, temporary, or a network issue: ${fetchError.message || "Unknown network error"}.`);
    }

    const cleanTitle = downloadedTitle.replace(/[\\/:*?"<>|]/g, "");

    if (isVideo) {
      await conn.sendMessage(
        from,
        {
          video: fileBuffer,
          caption: `🎥 *${downloadedTitle}*\n\nMADE BY APEX-MD`,
          fileName: `${cleanTitle}.mp4`,
          mimetype: 'video/mp4'
        },
        { quoted: mek }
      );
    } else {
      await conn.sendMessage(
        from,
        {
          audio: fileBuffer,
          mimetype: 'audio/mpeg',
          fileName: `${cleanTitle}.mp3`,
          ptt: false
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
    pattern: "song",
    react: "🎵",
    desc: "Download YouTube Audio (MP3)",
    category: "download",
    filename: __filename,
  },
  async (conn, mek, m, { from, q, reply, command, args, isGroup, sender }) => { // Corrected args destructuring. 'q' is passed through the handleYouTubeDownload.
    await handleYouTubeDownload(conn, mek, m, { from, q, reply, command, args, isVideo: false });
  }
);
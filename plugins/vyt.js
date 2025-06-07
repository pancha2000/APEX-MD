const { cmd } = require("../command");
const yts = require("yt-search");
const ytdl = require("ytdl-core"); // Make sure this is installed: npm install ytdl-core
const axios = require("axios");

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

// Helper to collect stream data into a buffer with a timeout
async function collectStreamToBuffer(stream, timeoutMs = 180000) { // Default 3 minutes timeout for video
    return new Promise((resolve, reject) => {
        const chunks = [];
        const timeoutId = setTimeout(() => {
            stream.destroy(); // Stop the stream
            reject(new Error(`Stream collection timed out after ${timeoutMs / 1000} seconds.`));
        }, timeoutMs);

        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
            clearTimeout(timeoutId);
            resolve(Buffer.concat(chunks));
        });
        stream.on('error', err => {
            clearTimeout(timeoutId);
            reject(err);
        });
    });
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

            let videoInfo;
            let youtubeUrl;
            let requestedQuality = "360p"; // Default quality if not specified

            // Check if the last argument is a resolution (e.g., '720p', '1080p')
            const lastArg = args[args.length - 1]?.toLowerCase();
            if (lastArg && (lastArg.endsWith('p') || !isNaN(lastArg))) {
                const qRes = lastArg.replace('p', '');
                const validQualities = ["144", "240", "360", "480", "720", "1080", "1440", "2160"]; // Common video qualities
                if (validQualities.includes(qRes)) {
                    requestedQuality = qRes + 'p';
                    q = q.substring(0, q.lastIndexOf(lastArg)).trim(); // Remove quality from query
                    if (!q) return reply("Please provide a video name or link along with the quality. (e.g., `!video song name 720`)");
                }
            }
            
            if (ytUrlRegex.test(q)) {
                youtubeUrl = q;
                try {
                    const info = await ytdl.getInfo(youtubeUrl);
                    videoInfo = {
                        title: info.videoDetails.title,
                        url: info.videoDetails.video_url,
                        thumbnail: info.videoDetails.thumbnails.length > 0 ? info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url : 'https://i.imgur.com/fallback_thumbnail.png',
                        timestamp: formatSecondsToTimestamp(parseInt(info.videoDetails.lengthSeconds)),
                        views: parseInt(info.videoDetails.viewCount).toLocaleString(),
                        ago: info.videoDetails.uploadDate,
                        author: { name: info.videoDetails.author.name },
                    };
                } catch (e) {
                    console.error("YTDL-core getInfo error for URL:", e.message);
                    return reply("❌ Could not get information for the provided YouTube link. Please check the URL or try searching by name.");
                }
            } else {
                const search = await yts(q);
                const data = search.videos[0];

                if (!data) return reply("❌ No video results found for your query.");

                videoInfo = {
                    title: data.title,
                    url: data.url,
                    thumbnail: data.thumbnail,
                    timestamp: data.timestamp,
                    views: data.views,
                    ago: data.ago,
                    author: { name: data.author.name },
                };
                youtubeUrl = data.url;
            }

            let desc = `🎥 *APEX-MD VIDEO DOWNLOADER* 🎥

👻 *Title* : ${videoInfo.title}
👻 *Duration* : ${videoInfo.timestamp || 'N/A'}
👻 *Views* : ${videoInfo.views || 'N/A'}
👻 *Uploaded* : ${videoInfo.ago || 'N/A'}
👻 *Channel* : ${videoInfo.author.name || 'N/A'}
👻 *Link* : ${videoInfo.url}
👻 *Requested Quality* : ${requestedQuality}

MADE BY SHEHAN VIMUKYHI`;

            await conn.sendMessage(from, { image: { url: videoInfo.thumbnail }, caption: desc }, { quoted: mek });

            reply(`*⏳ Downloading your video in ${requestedQuality}... Please wait! This might take a while for larger files.*`);

            let videoBuffer;
            let chosenFormat;
            let actualMimeType = "video/mp4"; // Default, but try to be more specific

            try {
                const info = await ytdl.getInfo(youtubeUrl);
                
                // Choose the best format for video and audio combined, matching requested quality
                chosenFormat = ytdl.chooseFormat(info.formats, { 
                    quality: requestedQuality,
                    filter: format => format.hasVideo && format.hasAudio && format.container === 'mp4' 
                });

                if (!chosenFormat) {
                    // Fallback to highest available if requested quality not found
                    chosenFormat = ytdl.chooseFormat(info.formats, { 
                        quality: 'highest', 
                        filter: format => format.hasVideo && format.hasAudio && format.container === 'mp4' 
                    });
                    if (chosenFormat) {
                        await reply(`⚠️ Requested quality ${requestedQuality} not found. Downloading in ${chosenFormat.qualityLabel || chosenFormat.itag} instead.`);
                        requestedQuality = chosenFormat.qualityLabel || chosenFormat.itag;
                    } else {
                        return reply("❌ No suitable video format found for this video. It might be restricted.");
                    }
                }
                
                console.log(`Chosen video format: ITAG=${chosenFormat.itag}, Quality=${chosenFormat.qualityLabel}, Mime=${chosenFormat.mimeType}`);
                actualMimeType = chosenFormat.mimeType || "video/mp4"; // Get precise mime type

                // Download the video stream with timeout
                const videoStream = ytdl(youtubeUrl, { format: chosenFormat });
                videoBuffer = await collectStreamToBuffer(videoStream);

                console.log(`Video buffer collected. Size: ${videoBuffer.length / (1024 * 1024)} MB`);
                if (videoBuffer.length > 200 * 1024 * 1024) { // Warning if buffer is too large (e.g., > 200MB)
                    reply("⚠️ The downloaded video file is very large. It might fail to send due to WhatsApp's file size limits.");
                }

            } catch (ytdlError) {
                console.error("YTDL-core download error (video command):", ytdlError);
                return reply(`❌ Error processing video download: ${ytdlError.message}. The video might be restricted, too long, or an issue occurred.`);
            }

            const cleanTitle = videoInfo.title.replace(/[\\/:*?"<>|]/g, "");

            await conn.sendMessage(
                from,
                {
                    video: videoBuffer,
                    caption: `🎥 *${videoInfo.title}*\n\nMADE BY APEX-MD\nQuality: ${requestedQuality}`,
                    fileName: `${cleanTitle}.mp4`,
                    mimetype: actualMimeType // Use the detected mime type
                },
                { quoted: mek }
            );

        } catch (error) {
            console.error("Critical error in video command:", error);
            reply("❌ An unexpected error occurred while processing your request. Please try again later.");
        }
    }
);
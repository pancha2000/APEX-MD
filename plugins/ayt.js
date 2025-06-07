const { cmd } = require("../command");
const yts = require("yt-search");
const ytdl = require("ytdl-core");
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
async function collectStreamToBuffer(stream, timeoutMs = 120000) { // Default 2 minutes timeout
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
        pattern: "song",
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
            if (!q) return reply("*🎶 Provide a song name or a YouTube link. (e.g., `!song song name` or `!song link highest`)*");

            const ytUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/g;

            let videoInfo;
            let youtubeUrl;
            let requestedAudioQuality = 'highestaudio'; // Default quality

            // Check if the last argument is an audio quality (e.g., 'highest', 'lowest', '128kbps')
            const lastArg = args[args.length - 1]?.toLowerCase();
            if (lastArg && ['highest', 'lowest'].includes(lastArg)) {
                requestedAudioQuality = lastArg + 'audio'; // Becomes 'highestaudio' or 'lowestaudio'
                q = q.substring(0, q.lastIndexOf(lastArg)).trim(); // Remove quality from query
                if (!q) return reply("Please provide a song name or link along with the quality. (e.g., `!song song name lowest`)");
            } else if (lastArg && lastArg.endsWith('kbps') && !isNaN(parseInt(lastArg))) {
                const bitrate = parseInt(lastArg);
                if (bitrate > 0) {
                    requestedAudioQuality = bitrate; // Store as integer bitrate (e.g., 128)
                    q = q.substring(0, q.lastIndexOf(lastArg)).trim();
                    if (!q) return reply("Please provide a song name or link along with the quality. (e.g., `!song song name 128kbps`)");
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

                if (!data) return reply("❌ No song found for your query.");

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

            let desc = `🎶 *APEX-MD SONG DOWNLOADER* 🎶

👻 *Title* : ${videoInfo.title}
👻 *Duration* : ${videoInfo.timestamp || 'N/A'}
👻 *Views* : ${videoInfo.views || 'N/A'}
👻 *Uploaded* : ${videoInfo.ago || 'N/A'}
👻 *Channel* : ${videoInfo.author.name || 'N/A'}
👻 *Link* : ${videoInfo.url}
👻 *Requested Quality* : ${typeof requestedAudioQuality === 'number' ? `${requestedAudioQuality}kbps` : requestedAudioQuality.replace('audio', '')}

MADE BY SHEHAN VIMUKYHI`;

            await conn.sendMessage(from, { image: { url: videoInfo.thumbnail }, caption: desc }, { quoted: mek });

            reply("*⏳ Downloading your song... Please wait! This might take a moment for larger files.*");

            let audioBuffer;
            let chosenFormat;
            let actualMimeType = "audio/mpeg"; // Default, but try to be more specific

            try {
                const info = await ytdl.getInfo(youtubeUrl);

                // Filter for audio-only formats
                let formats = ytdl.filterFormats(info.formats, 'audioonly');

                if (typeof requestedAudioQuality === 'number') { // Specific bitrate requested
                    // Try to find a format close to the requested bitrate
                    chosenFormat = formats.find(f => f.audioBitrate && Math.abs(f.audioBitrate - requestedAudioQuality) < 50); // Allowing some deviation
                    if (!chosenFormat) {
                        // Fallback to highest audio if specific bitrate not found
                        chosenFormat = ytdl.chooseFormat(formats, { quality: 'highestaudio' });
                        if (chosenFormat) {
                            await reply(`⚠️ ${requestedAudioQuality}kbps quality not found. Downloading in ${chosenFormat.audioBitrate || 'highest'}kbps instead.`);
                        }
                    }
                } else { // 'highestaudio' or 'lowestaudio'
                    chosenFormat = ytdl.chooseFormat(formats, { quality: requestedAudioQuality });
                }

                if (!chosenFormat) {
                    return reply("❌ No suitable audio format found for this song. It might be restricted.");
                }

                console.log(`Chosen audio format: ITAG=${chosenFormat.itag}, Quality=${chosenFormat.qualityLabel || chosenFormat.audioBitrate + 'kbps'}, Mime=${chosenFormat.mimeType}`);
                actualMimeType = chosenFormat.mimeType || "audio/mpeg"; // Get precise mime type

                // Download the audio stream with timeout
                const audioStream = ytdl(youtubeUrl, { format: chosenFormat });
                audioBuffer = await collectStreamToBuffer(audioStream);

                console.log(`Audio buffer collected. Size: ${audioBuffer.length / (1024 * 1024)} MB`);
                if (audioBuffer.length > 200 * 1024 * 1024) { // Warning if buffer is too large (e.g., > 200MB)
                    reply("⚠️ The downloaded audio file is very large. It might fail to send due to WhatsApp's file size limits.");
                }

            } catch (ytdlError) {
                console.error("YTDL-core download error (song command):", ytdlError);
                return reply(`❌ Error processing audio download: ${ytdlError.message}. The video might be restricted, too long, or an issue occurred.`);
            }

            const cleanTitle = videoInfo.title.replace(/[\\/:*?"<>|]/g, "");

            await conn.sendMessage(
                from,
                {
                    audio: audioBuffer,
                    mimetype: actualMimeType, // Use the detected mime type
                    fileName: `${cleanTitle}.mp3`, // Use .mp3 for compatibility or .m4a/.opus as needed
                    ptt: false,
                },
                { quoted: mek }
            );

            await reply(`🎶 *${videoInfo.title}*\n\nMADE BY APEX-MD`);

        } catch (error) {
            console.error("Critical error in song command:", error);
            reply("❌ An unexpected error occurred while processing your request. Please try again later.");
        }
    }
);
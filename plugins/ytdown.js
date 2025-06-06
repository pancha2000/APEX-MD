// External API හරහා YouTube download කිරීමට අවශ්‍ය dependencies
const { cmd } = require('../command');
const { fetchJson } = require('../lib/functions'); // fetchJson function එක ඔබගේ lib/functions.js හි ඇත

// !!! වැදගත්: මෙතැනට ඔබ වෙනත් server එකක deploy කළ YouTube API එකේ URL එක දාන්න !!!
// උදාහරණ: "http://YOUR_DEPLOYED_YOUTUBE_API_URL_HERE"
// ඔබට ඔබේම API එක deploy කර නොමැතිනම්, ඔබට යම් public API එකක් සොයාගෙන එය භාවිතා කළ හැක.
// (කලින් තිබූ https://prabath-api.onrender.com වැනි URL එකක් දාන්න පුළුවන්,
// නමුත් එහි විශ්වසනීයත්වය සහ සීමාවන් API සපයන්නා මත රඳා පවතී)
const YOUTUBE_DOWNLOAD_API_URL = "http://YOUR_DEPLOYED_YOUTUBE_API_URL_HERE"; // <<<--- මෙය අනිවාර්යයෙන් වෙනස් කරන්න !!!


const yourName = "*APEX-MD*"; // ඔබේ bot ගේ නම


// --- YouTube Video Downloader (!video / !ytmp4) ---
cmd({
    pattern: "video",
    alias: ["ytmp4", "ytv"], // 'video' pattern එක, 'ytmp4' සහ 'ytv' alias
    desc: "Downloads YouTube videos (MP4) via API.",
    category: "download",
    react: "📩",
    filename: __filename
},
async(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        console.log(`[YT_API_MP4] Command received from ${senderNumber}: !${command} ${q}`);

        if (!q || (!q.startsWith("http://") && !q.startsWith("https://"))) {
            await conn.sendMessage(from, { text: "Please provide a YouTube video URL.\n\nExample: `" + global.prfx + "ytmp4 https://www.youtube.com/watch?v=dQw4w9WgXcQ`" }, { quoted: mek });
            return;
        }

        const youtubeUrl = q;

        // URL validation (simple check, the API should handle deeper validation)
        if (!youtubeUrl.includes("youtube.com/watch") && !youtubeUrl.includes("youtu.be/")) {
            await conn.sendMessage(from, { text: 'Invalid YouTube URL provided. Please enter a valid YouTube video link.' }, { quoted: mek });
            return;
        }

        await conn.sendMessage(from, { text: `⌛ Requesting YouTube video from API...\nPlease wait, this may take a moment.` }, { quoted: mek });

        // API call to download YouTube video
        // pancha2000/youtube-download-api repo එකේ main.js බැලුවම /ytmp4 endpoint එකක් තියෙනවා.
        let data = await fetchJson(`${YOUTUBE_DOWNLOAD_API_URL}/ytmp4?url=${encodeURIComponent(q)}`); // URL encoding වැදගත්

        console.log(`[YT_API_MP4] API Response: ${JSON.stringify(data, null, 2)}`); // API response එක ලොග් කරන්න

        if (!data || data.status !== true || !data.result || !data.result.url) {
             const errorMessage = data && data.message ? data.message : 'API returned no valid data or an error.';
             console.error("[YT_API_MP4] API returned no valid data:", errorMessage);
             return await conn.sendMessage(from, { text: `❌ Failed to download video. API returned: ${errorMessage}. Please check the URL or try again later.` }, { quoted: mek });
        }

        const videoUrl = data.result.url;
        const title = data.result.title || "YouTube Video"; // API response එකෙන් title ගන්න

        if (!videoUrl) {
            await conn.sendMessage(from, { text: '❌ Failed to download video. Could not find a downloadable video URL from the API.' }, { quoted: mek });
            return;
        }
        
        // Video file URL එක කෙලින්ම WhatsApp වෙත යවන්න
        await conn.sendMessage(from, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: `✅ Successfully downloaded: *${title}*\n\n${yourName}`
        }, { quoted: mek });

        console.log(`[YT_API_MP4] Sent video from API: ${videoUrl}`);

    } catch (error) {
        console.error('[YT_API_MP4] Main Error Catch:', error);
        await conn.sendMessage(from, { text: `❌ An error occurred while downloading: ${error.message || String(error)}. Please try again later.` }, { quoted: mek });
    }
});


// --- YouTube Song Downloader (!song / !ytmp3) ---
cmd({
    pattern: "song",
    alias: ["ytmp3", "yta"],
    desc: "Downloads YouTube songs (MP3) via API.",
    category: "download",
    react: "📩",
    filename: __filename
},
async(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        console.log(`[YT_API_MP3] Command received from ${senderNumber}: !${command} ${q}`);

        if (!q || (!q.startsWith("http://") && !q.startsWith("https://"))) {
            await conn.sendMessage(from, { text: "Please provide a YouTube video URL.\n\nExample: `" + global.prfx + "ytmp3 https://www.youtube.com/watch?v=dQw4w9WgXcQ`" }, { quoted: mek });
            return;
        }

        const youtubeUrl = q;

        if (!youtubeUrl.includes("youtube.com/watch") && !youtubeUrl.includes("youtu.be/")) {
            await conn.sendMessage(from, { text: 'Invalid YouTube URL provided. Please enter a valid YouTube video link.' }, { quoted: mek });
            return;
        }

        await conn.sendMessage(from, { text: `⌛ Requesting YouTube audio from API...\nPlease wait, this may take a moment.` }, { quoted: mek });

        // API call to download YouTube audio
        // pancha2000/youtube-download-api repo එකේ main.js බැලුවම /ytmp3 endpoint එකක් තියෙනවා.
        let data = await fetchJson(`${YOUTUBE_DOWNLOAD_API_URL}/ytmp3?url=${encodeURIComponent(q)}`); // URL encoding වැදගත්

        console.log(`[YT_API_MP3] API Response: ${JSON.stringify(data, null, 2)}`); // API response එක ලොග් කරන්න
        
        if (!data || data.status !== true || !data.result || !data.result.url) {
            const errorMessage = data && data.message ? data.message : 'API returned no valid data or an error.';
            console.error("[YT_API_MP3] API returned no valid data:", errorMessage);
            return await conn.sendMessage(from, { text: `❌ Failed to download audio. API returned: ${errorMessage}. Please check the URL or try again later.` }, { quoted: mek });
        }

        const audioUrl = data.result.url;
        const title = data.result.title || "YouTube Audio"; // API response එකෙන් title ගන්න

        if (!audioUrl) {
            await conn.sendMessage(from, { text: '❌ Failed to download audio. Could not find a downloadable audio URL from the API.' }, { quoted: mek });
            return;
        }

        // Audio file URL එක කෙලින්ම WhatsApp වෙත යවන්න
        await conn.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            caption: `✅ Successfully downloaded: *${title}*\n\n${yourName}`
        }, { quoted: mek }
        );

        console.log(`[YT_API_MP3] Sent audio from API: ${audioUrl}`);

    } catch (error) {
        console.error('[YT_API_MP3] Main Error Catch:', error);
        await conn.sendMessage(from, { text: `❌ An error occurred while downloading: ${error.message || String(error)}. Please try again later.` }, { quoted: mek });
    }
});
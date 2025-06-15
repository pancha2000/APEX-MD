// plugins/youtube.js
// මෙම මොඩියුලය WhatsApp Bot හි YouTube Download Commands හැසිරවීමට භාවිතා වේ.

const { cmd } = require("../command"); // <-- මෙලෙස cmd function එක import කරන්න
const yts = require('yt-search'); // yt-search npm package එක ස්ථාපනය කර ඇති බවට වග බලා ගන්න.
const axios = require('axios'); // axios npm package එක ස්ථාපනය කර ඇති බවට වග බලා ගන්න.

// ඔබගේ Koyeb API URL එක මෙහි සඳහන් කරන්න.
// config.js වෙතින් ලබා ගැනීමට අවශ්‍ය නම්, පහත commented line එක භාවිතා කරන්න.
const YOUTUBE_DOWNLOAD_API_URL = 'https://electoral-glad-h79160251-fbc6ed34.koyeb.app';

// -----------------------------------------------------------------------------
// විකල්පය: API URL එක config.js වෙතින් ලබා ගැනීම (වඩාත් හොඳ පුරුද්දක්)
// ඔබගේ config.js ගොනුවේ youtubeApiUrl: 'YOUR_API_URL' ලෙස define කර ඇත්නම්,
// ඔබට ඉහත line එක මෙසේ වෙනස් කළ හැක:
// const { youtubeApiUrl } = require('../config');
// const YOUTUBE_DOWNLOAD_API_URL = youtubeApiUrl || 'https://electoral-glad-h79160251-fbc6ed34.koyeb.app';
// -----------------------------------------------------------------------------

// ----------------------------------------------------------------------
// YouTube Download Commands මෙහිදී Define කරන්න
// ----------------------------------------------------------------------

// !audio command එක define කිරීම
cmd({
    pattern: "audio", // command එකේ pattern එක. ඔබගේ බොට්ගේ prefix එක (e.g., '!') මෙහි අවශ්‍ය නැහැ.
    cmdname: "audio",
    react: "🎵", // ඔබට අවශ්‍ය නම් reaction එකක් දමන්න
    desc: "Download YouTube Audio.",
    category: "download", // ඔබට කැමති category එකක් දමන්න
    fromMe: false, // bot owner ට පමණක්ද, නැතිනම් හැමෝටමද
    filename: __filename // මෙම ගොනුවෙහි නම (debugging සඳහා)
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }) => {
    // command logic එක මෙහිදී ක්‍රියාත්මක වේ.
    // 'audio' download සඳහා common logic එකක් ලෙස youtubeDownloadHandler භාවිතා කරන්න.
    await youtubeDownloadHandler(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }, 'audio');
});

// !video command එක define කිරීම
cmd({
    pattern: "video",
    cmdname: "video",
    react: "🎥", // ඔබට අවශ්‍ය නම් reaction එකක් දමන්න
    desc: "Download YouTube Video.",
    category: "download",
    fromMe: false,
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }) => {
    // command logic එක මෙහිදී ක්‍රියාත්මක වේ.
    // 'video' download සඳහා common logic එකක් ලෙස youtubeDownloadHandler භාවිතා කරන්න.
    await youtubeDownloadHandler(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }, 'video');
});


// ----------------------------------------------------------------------
// Common YouTube Download Logic Function එක
// ----------------------------------------------------------------------

async function youtubeDownloadHandler(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }, type) {
    // type parameter එක 'audio' හෝ 'video' විය යුතුය.

    if (!q) { // q (query) එක හිස් නම්
        return reply("Provide a name or a YouTube link. 🎥❤️");
    }

    let youtubeUrl;
    let videoInfo; // YouTube search result information

    // q එක YouTube URL එකක්දැයි පරීක්ෂා කිරීම
    try {
        const urlObj = new URL(q);
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            youtubeUrl = q; // q එක YouTube URL එකක් නම්, එයම භාවිතා කරන්න.
        } else {
            // q එක URL එකක් නොවේ නම්, search කරන්න.
            const search = await yts(q);
            videoInfo = search.videos[0]; // පළමු වීඩියෝ result එක ගන්න
            if (!videoInfo) return reply("No video results found for your query.");
            youtubeUrl = videoInfo.url;
        }
    } catch (e) {
        // URL validation fail වුවහොත්, එය query එකක් ලෙස සලකා search කරන්න.
        const search = await yts(q);
        videoInfo = search.videos[0];
        if (!videoInfo) return reply("No video results found for your query.");
        youtubeUrl = videoInfo.url;
    }

    // වීඩියෝ තොරතුරු සමග thumbnail එකක් යවන්න (ඔබේ කලින් 'video' command එකේ වගේ)
    if (videoInfo && videoInfo.thumbnail) {
        let desc = `🎬 *YouTube ${type.toUpperCase()} Downloader* 🎬\n\n`;
        desc += `✨ *Title* : ${videoInfo.title}\n`;
        desc += `⏱️ *Duration* : ${videoInfo.timestamp}\n`;
        desc += `👁️ *Views* : ${videoInfo.views}\n`;
        desc += `🗓️ *Uploaded* : ${videoInfo.ago}\n`;
        desc += `📺 *Channel* : ${videoInfo.author.name}\n`;
        desc += `🔗 *Link* : ${videoInfo.url}\n\n`;
        desc += `_Powered by Your API_`; // ඔබට කැමති නමක් දමන්න

        await conn.sendMessage(
            from,
            { image: { url: videoInfo.thumbnail }, caption: desc },
            { quoted: mek }
        );
    } else {
        await reply(`🎵 Fetching ${type} download link for: ${youtubeUrl}`);
    }

    try {
        const endpoint = type === 'audio' ? '/audio' : '/video';
        const apiUrl = `${YOUTUBE_DOWNLOAD_API_URL}${endpoint}?url=${encodeURIComponent(youtubeUrl)}`;

        console.log(`Calling YouTube Download API: ${apiUrl}`); // Debugging සඳහා

        const response = await axios.get(apiUrl);

        if (response.status === 200 && (response.data.audio_url || response.data.video_url)) {
            const downloadUrl = response.data.audio_url || response.data.video_url;
            await reply(`🔗 Here is your direct download link for ${type}: \n${downloadUrl}`);
        } else {
            await reply(`❌ Could not get ${type} link. API responded with an unexpected error.`);
            console.error('API Error Response:', response.data);
        }
    } catch (error) {
        console.error('Error calling YouTube Download API:', error.message);
        const errorDetails = error.response && error.response.data && error.response.data.error
                           ? `Details: ${error.response.data.error}`
                           : `Details: ${error.message}`;
        await reply(`❌ An error occurred while fetching the download link. Please try again later. \n${errorDetails}`);
    }
}
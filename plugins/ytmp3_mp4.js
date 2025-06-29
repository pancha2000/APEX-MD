

// plugins/youtube.js
// මෙම මොඩියුලය WhatsApp Bot හි YouTube Download Commands හැසිරවීමට භාවිතා වේ.

const { cmd } = require("../command"); // <-- මෙලෙස cmd function එක import කරන්න
const yts = require('yt-search'); // yt-search npm package එක ස්ථාපනය කර ඇති බවට වග බලා ගන්න.
const axios = require('axios'); // axios npm package එක ස්ථාපනය කර ඇති බවට වග බලා ගන්න.

// ඔබගේ Koyeb API URL එක මෙහි සඳහන් කරන්න.
// config.js වෙතින් ලබා ගැනීමට අවශ්‍ය නම්, පහත commented line එක භාවිතා කරන්න.
const YOUTUBE_DOWNLOAD_API_URL = 'https://youtube-download-api-gold.vercel.app/'; //'https://electoral-glad-h79160251-fbc6ed34.koyeb.app';

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
    pattern: "ytmp3", // command එකේ pattern එක. ඔබගේ බොට්ගේ prefix එක (e.g., '!') මෙහි අවශ්‍ය නැහැ.
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
    pattern: "ytmp4",
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
    // මේ කොටස එලෙසම තබමු, එය user ට හොඳ අත්දැකීමක් ලබා දෙනවා.
    if (videoInfo && videoInfo.thumbnail) {
        let desc = `🎬 *YouTube ${type.toUpperCase()} Downloader* 🎬\n\n`;
        desc += `✨ *Title* : ${videoInfo.title}\n`;
        desc += `⏱️ *Duration* : ${videoInfo.timestamp}\n`;
        desc += `👁️ *Views* : ${videoInfo.views}\n`;
        desc += `🗓️ *Uploaded* : ${videoInfo.ago}\n`;
        desc += `📺 *Channel* : ${videoInfo.author.name}\n`;
        desc += `🔗 *Link* : ${videoInfo.url}\n\n`;
        desc += `Powered by APEX-MD\n\n`;
        desc += '.ytmp command එක වැඩ නැතිනම් අනෙක් download command උත්සහ කරන්න' // ඔබට කැමති නමක් දමන්න

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

            // ***** මෙතනින් පහලට තමයි ප්‍රධාන වෙනස සිදු කරන්නේ *****
            // API එකෙන් ලැබුණු download URL එකෙන් media file එක download කරගැනීම
            await reply(`⏳ Please wait while I download and send your ${type}...\n_This may take some time depending on the file size._`);

            try {
                const mediaResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' }); // media data එක binary buffer එකක් ලෙස ලබා ගැනීම
                const mediaBuffer = Buffer.from(mediaResponse.data); // Buffer එකක් බවට පත් කිරීම

                let messageOptions = { quoted: mek }; // WhatsApp message options

                if (type === 'audio') {
                    // Audio ලෙස යැවීම
                    // "mimetype" එක නිවැරදිදැයි තහවුරු කරගන්න. mp3 සඳහා 'audio/mpeg' සාමාන්‍යයෙන් භාවිතා වේ.
                    messageOptions.audio = mediaBuffer;
                    messageOptions.mimetype = 'audio/mpeg';
                    messageOptions.fileName = `${videoInfo ? videoInfo.title : 'audio'}.mp3`; // File name එකක් දෙන්න
                    // `ptt: true` යෙදුවොත් voice note එකක් ලෙස යයි. අවශ්‍ය නම් ඉවත් කරන්න.
                    messageOptions.ptt = true; // Voice note ලෙස යැවීම
                } else if (type === 'video') {
                    // Video ලෙස යැවීම
                    // "mimetype" එක නිවැරදිදැයි තහවුරු කරගන්න. mp4 සඳහා 'video/mp4' සාමාන්‍යයෙන් භාවිතා වේ.
                    messageOptions.video = mediaBuffer;
                    messageOptions.mimetype = 'video/mp4';
                    messageOptions.caption = videoInfo ? `🎥 ${videoInfo.title}` : `🎥 YouTube Video`; // Video එකට caption එකක් දෙන්න
                    messageOptions.fileName = `${videoInfo ? videoInfo.title : 'video'}.mp4`; // File name එකක් දෙන්න
                }
                
                // WhatsApp සීමාවන් නිසා විශාල files යැවීමට නොහැකි වුවහොත්, link එකක් යවන්න.
                // මේ කොටස උත්සාහ කරන්න, සාර්ථක නොවුවහොත්, පහත link එක යැවීමට වැටේ.
                await conn.sendMessage(from, messageOptions);
                await reply(`✅ Your ${type} has been sent successfully!`);

            } catch (downloadError) {
                console.error(`Error downloading media from ${downloadUrl} or sending to WhatsApp:`, downloadError.message);
                // WhatsApp file size limit එකක් නිසා හෝ වෙනත් ගැටලුවක් නිසා download කර යැවීමට නොහැකි නම්, link එක යවන්න.
                await reply(`❌ An error occurred while sending the ${type} directly (It might be too large for WhatsApp or a temporary issue).\nHere is the direct download link instead: \n${downloadUrl}`);
            }
            // ***** මෙතැනින් ඉහලට තමයි ප්‍රධාන වෙනස *****

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
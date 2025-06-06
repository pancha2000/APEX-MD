const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');

// command.js වෙතින් cmd function එක import කරන්න.
// ඔබේ bot එකේ command handling ක්‍රමය මෙයයි.
const { cmd } = require('../command');

// Downloads තාවකාලිකව save කිරීමට directory එකක්.
// මේ path එක ඔබේ bot ගේ root directory එකේ 'tmp_downloads' ලෙස සකස් කර ඇත.
const TEMP_DIR = path.join(__dirname, '..', 'tmp_downloads');
fsExtra.ensureDirSync(TEMP_DIR); // directory එක නොමැතිනම් සාදන්න.

const yourName = "*APEX-MD*"; // ඔබේ bot ගේ නම මෙතනින් වෙනස් කරන්න


// --- YouTube Video Downloader (!ytmp4) ---
cmd({
    pattern: "ytmp4",
    alias: ["ytv"], // විකල්ප commands
    desc: "Downloads YouTube videos (MP4).",
    category: "download",
    react: "📩", // command එකට reaction එකක්
    filename: __filename // මෙම file එකේ නම
},
async(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        console.log(`[YTMP4] Command received from ${senderNumber}: !${command} ${q}`); // Debug log

        // q variable එකේ YouTube URL එක තිබේදැයි පරීක්ෂා කිරීම
        if (!q || (!q.startsWith("http://") && !q.startsWith("https://"))) {
            // global.prfx භාවිතා කරමින් prefix එකද සහිතව උදාහරණයක් පෙන්වීම
            return await reply("Please provide a YouTube video URL.\n\nExample: `" + global.prfx + "ytmp4 https://www.youtube.com/watch?v=dQw4w9WgXcQ`");
        }

        const youtubeUrl = q; // q යනු command එකට පසුව ඇති සම්පූර්ණ text එකයි.

        // URL එක YouTube URL එකක්දැයි තහවුරු කිරීම
        if (!ytdl.validateURL(youtubeUrl)) {
            console.warn(`[YTMP4] Invalid URL: ${youtubeUrl}`); // Debug log
            return await reply('Invalid YouTube URL provided. Please enter a valid YouTube video link.');
        }

        // වීඩියෝ තොරතුරු ලබා ගැනීම (මාතෘකාව වැනි)
        const info = await ytdl.getInfo(youtubeUrl);
        // File නමක් ලෙස භාවිතා කිරීමට මාතෘකාව sanitize කිරීම
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9 ]/g, ''); 
        const videoId = info.videoDetails.videoId;

        await reply(`⌛ Processing "${title}"...\nPlease wait, this may take a moment.`);

        const videoFilePath = path.join(TEMP_DIR, `${title}_${videoId}.mp4`);

        // පෙර තිබූ අසාර්ථක බාගත කිරීම් වලින් ඉතිරි වූ ගොනු ඉවත් කරන්න
        if (fs.existsSync(videoFilePath)) {
            console.log(`[YTMP4] Removing existing file: ${videoFilePath}`); // Debug log
            fsExtra.removeSync(videoFilePath);
        }

        // ඉහළම quality ඇති video stream එක පමණක් ලබා ගැනීම
        const videoStream = ytdl(youtubeUrl, {
            quality: 'highestvideo',
            filter: 'videoonly'
        });

        // ඉහළම quality ඇති audio stream එක පමණක් ලබා ගැනීම
        const audioStream = ytdl(youtubeUrl, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        // FFmpeg භාවිතයෙන් video සහ audio streams ඒකාබද්ධ කර MP4 ගොනුවක් ලෙස save කිරීම
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoStream)
                .videoCodec('copy') // වීඩියෝ codec එක කෙලින්ම පිටපත් කරන්න
                .input(audioStream)
                .audioCodec('copy') // ඕඩියෝ codec එක කෙලින්ම පිටපත් කරන්න
                .save(videoFilePath)
                .on('end', () => {
                    console.log(`[YTMP4] FFmpeg merge complete for ${title}`); // Debug log
                    resolve();
                })
                .on('error', (err) => {
                    console.error('[YTMP4] FFmpeg Video Merge Error:', err); // Error log
                    reject(err);
                });
        });

        // ගොනුව සාර්ථකව බාගත වී ඇත්දැයි පරීක්ෂා කිරීම
        if (fs.existsSync(videoFilePath)) {
            console.log(`[YTMP4] Sending video file: ${videoFilePath}`); // Debug log
            await conn.sendMessage(
                from, {
                    video: { url: videoFilePath },
                    mimetype: 'video/mp4',
                    caption: `✅ Successfully downloaded: *${title}*\n\n${yourName}`
                }, { quoted: mek }
            );
            fsExtra.removeSync(videoFilePath); // තාවකාලික ගොනුව ඉවත් කරන්න
            console.log(`[YTMP4] Sent and cleaned up: ${videoFilePath}`); // Debug log
        } else {
            console.error(`[YTMP4] Video file not found after FFmpeg process: ${videoFilePath}`); // Error log
            await reply('❌ Failed to download video. The file was not created or found.');
        }

    } catch (error) {
        console.error('[YTMP4] Main Error Catch:', error); // සාමාන්‍ය දෝෂ log
        if (error.message.includes('No video formats found')) {
            await reply('❌ Could not find downloadable formats for this video. It might be age-restricted, geo-restricted, or private.');
        } else if (error.message.includes('status code: 403')) {
            await reply('❌ YouTube download failed due to a server error (e.g., rate limit, geo-restriction). Please try again later.');
        } else {
            await reply(`❌ An error occurred while downloading: ${error.message}`);
        }
        fsExtra.emptyDirSync(TEMP_DIR); // දෝෂයක් ඇති වුවහොත් තාවකාලික directory එක හිස් කරන්න
        console.log('[YTMP4] Temporary directory cleared on error.'); // Debug log
    }
});


// --- YouTube Song Downloader (!ytmp3) ---
cmd({
    pattern: "ytmp3",
    alias: ["yta"], // විකල්ප commands
    desc: "Downloads YouTube songs (MP3).",
    category: "download",
    react: "📩", // command එකට reaction එකක්
    filename: __filename // මෙම file එකේ නම
},
async(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        console.log(`[YTMP3] Command received from ${senderNumber}: !${command} ${q}`); // Debug log

        // q variable එකේ YouTube URL එක තිබේදැයි පරීක්ෂා කිරීම
        if (!q || (!q.startsWith("http://") && !q.startsWith("https://"))) {
            return await reply("Please provide a YouTube video URL.\n\nExample: `" + global.prfx + "ytmp3 https://www.youtube.com/watch?v=dQw4w9WgXcQ`");
        }

        const youtubeUrl = q;

        // URL එක YouTube URL එකක්දැයි තහවුරු කිරීම
        if (!ytdl.validateURL(youtubeUrl)) {
            console.warn(`[YTMP3] Invalid URL: ${youtubeUrl}`); // Debug log
            return await reply('Invalid YouTube URL provided. Please enter a valid YouTube video link.');
        }

        // වීඩියෝ තොරතුරු ලබා ගැනීම (මාතෘකාව වැනි)
        const info = await ytdl.getInfo(youtubeUrl);
        // File නමක් ලෙස භාවිතා කිරීමට මාතෘකාව sanitize කිරීම
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9 ]/g, '');
        const videoId = info.videoDetails.videoId;

        await reply(`⌛ Processing "${title}"...\nPlease wait, this may take a moment.`);

        const audioFilePath = path.join(TEMP_DIR, `${title}_${videoId}.mp3`);

        // පෙර තිබූ අසාර්ථක බාගත කිරීම් වලින් ඉතිරි වූ ගොනු ඉවත් කරන්න
        if (fs.existsSync(audioFilePath)) {
            console.log(`[YTMP3] Removing existing file: ${audioFilePath}`); // Debug log
            fsExtra.removeSync(audioFilePath);
        }

        // FFmpeg භාවිතයෙන් audio stream එක MP3 ගොනුවක් ලෙස save කිරීම
        await new Promise((resolve, reject) => {
            ffmpeg(ytdl(youtubeUrl, {
                    filter: 'audioonly', // audio stream එක පමණක් ලබා ගැනීම
                    quality: 'highestaudio'
                }))
                .audioBitrate(128) // Audio bitrate එක 128kbps ලෙස සකසන්න (අවශ්‍ය පරිදි වෙනස් කරන්න)
                .save(audioFilePath)
                .on('end', () => {
                    console.log(`[YTMP3] FFmpeg conversion complete for ${title}`); // Debug log
                    resolve();
                })
                .on('error', (err) => {
                    console.error('[YTMP3] FFmpeg Audio Convert Error:', err); // Error log
                    reject(err);
                });
        });

        // ගොනුව සාර්ථකව බාගත වී ඇත්දැයි පරීක්ෂා කිරීම
        if (fs.existsSync(audioFilePath)) {
            console.log(`[YTMP3] Sending audio file: ${audioFilePath}`); // Debug log
            await conn.sendMessage(
                from, {
                    audio: { url: audioFilePath },
                    mimetype: 'audio/mpeg',
                    fileName: `${title}.mp3`,
                    caption: `✅ Successfully downloaded: *${title}*\n\n${yourName}`
                }, { quoted: mek }
            );
            fsExtra.removeSync(audioFilePath); // තාවකාලික ගොනුව ඉවත් කරන්න
            console.log(`[YTMP3] Sent and cleaned up: ${audioFilePath}`); // Debug log
        } else {
            console.error(`[YTMP3] Audio file not found after FFmpeg process: ${audioFilePath}`); // Error log
            await reply('❌ Failed to download audio. The file was not created or found.');
        }

    } catch (error) {
        console.error('[YTMP3] Main Error Catch:', error); // සාමාන්‍ය දෝෂ log
        if (error.message.includes('No video formats found')) {
            await reply('❌ Could not find downloadable formats for this video. It might be age-restricted, geo-restricted, or private.');
        } else if (error.message.includes('status code: 403')) {
            await reply('❌ YouTube download failed due to a server error (e.g., rate limit, geo-restriction). Please try again later.');
        } else {
            await reply(`❌ An error occurred while downloading: ${error.message}`);
        }
        fsExtra.emptyDirSync(TEMP_DIR); // දෝෂයක් ඇති වුවහොත් තාවකාලික directory එක හිස් කරන්න
        console.log('[YTMP3] Temporary directory cleared on error.'); // Debug log
    }
});
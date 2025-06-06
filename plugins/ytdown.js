const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');

const { cmd } = require('../command');

const TEMP_DIR = path.join(__dirname, '..', 'tmp_downloads');
fsExtra.ensureDirSync(TEMP_DIR);

const yourName = "*APEX-MD*"; // Customize your bot's name


// --- YouTube Video Downloader (!video / !ytmp4) ---
cmd({
    pattern: "video",
    alias: ["ytmp4", "ytv"], // 'video' pattern එක, 'ytmp4' සහ 'ytv' alias
    desc: "Downloads YouTube videos (MP4).",
    category: "download",
    react: "📩",
    filename: __filename
},
async(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        console.log(`[YTMP4] Command received from ${senderNumber}: !${command} ${q}`); // Debug log

        if (!q || (!q.startsWith("http://") && !q.startsWith("https://"))) {
            // direct conn.sendMessage භාවිතය
            await conn.sendMessage(from, { text: "Please provide a YouTube video URL.\n\nExample: `" + global.prfx + "ytmp4 https://www.youtube.com/watch?v=dQw4w9WgXcQ`" }, { quoted: mek });
            return;
        }

        const youtubeUrl = q;

        if (!ytdl.validateURL(youtubeUrl)) {
            console.warn(`[YTMP4] Invalid URL: ${youtubeUrl}`);
            // direct conn.sendMessage භාවිතය
            await conn.sendMessage(from, { text: 'Invalid YouTube URL provided. Please enter a valid YouTube video link.' }, { quoted: mek });
            return;
        }

        const info = await ytdl.getInfo(youtubeUrl);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9 ]/g, ''); 
        const videoId = info.videoDetails.videoId;

        // direct conn.sendMessage භාවිතය
        await conn.sendMessage(from, { text: `⌛ Processing "${title}"...\nPlease wait, this may take a moment.` }, { quoted: mek });

        const videoFilePath = path.join(TEMP_DIR, `${title}_${videoId}.mp4`);

        if (fs.existsSync(videoFilePath)) {
            console.log(`[YTMP4] Removing existing file: ${videoFilePath}`);
            fsExtra.removeSync(videoFilePath);
        }

        const videoStream = ytdl(youtubeUrl, {
            quality: 'highestvideo',
            filter: 'videoonly'
        });

        const audioStream = ytdl(youtubeUrl, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoStream)
                .videoCodec('copy')
                .input(audioStream)
                .audioCodec('copy')
                .save(videoFilePath)
                .on('end', () => {
                    console.log(`[YTMP4] FFmpeg merge complete for ${title}`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error('[YTMP4] FFmpeg Video Merge Error:', err);
                    reject(err);
                });
        });

        if (fs.existsSync(videoFilePath)) {
            console.log(`[YTMP4] Sending video file: ${videoFilePath}`);
            await conn.sendMessage(
                from, {
                    video: { url: videoFilePath },
                    mimetype: 'video/mp4',
                    caption: `✅ Successfully downloaded: *${title}*\n\n${yourName}`
                }, { quoted: mek }
            );
            fsExtra.removeSync(videoFilePath);
            console.log(`[YTMP4] Sent and cleaned up: ${videoFilePath}`);
        } else {
            console.error(`[YTMP4] Video file not found after FFmpeg process: ${videoFilePath}`);
            // direct conn.sendMessage භාවිතය
            await conn.sendMessage(from, { text: '❌ Failed to download video. The file was not created or found.' }, { quoted: mek });
        }

    } catch (error) {
        console.error('[YTMP4] Main Error Catch:', error);
        if (error.message.includes('No video formats found')) {
            await conn.sendMessage(from, { text: '❌ Could not find downloadable formats for this video. It might be age-restricted, geo-restricted, or private.' }, { quoted: mek });
        } else if (error.message.includes('status code: 403')) {
            await conn.sendMessage(from, { text: '❌ YouTube download failed due to a server error (e.g., rate limit, geo-restriction). Please try again later.' }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text: `❌ An error occurred while downloading: ${error.message}` }, { quoted: mek });
        }
        fsExtra.emptyDirSync(TEMP_DIR);
        console.log('[YTMP4] Temporary directory cleared on error.');
    }
});


// --- YouTube Song Downloader (!song / !ytmp3) ---
cmd({
    pattern: "song",
    alias: ["ytmp3", "yta"], // 'song' pattern එක, 'ytmp3' සහ 'yta' alias
    desc: "Downloads YouTube songs (MP3).",
    category: "download",
    react: "📩",
    filename: __filename
},
async(conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        console.log(`[YTMP3] Command received from ${senderNumber}: !${command} ${q}`); // Debug log

        if (!q || (!q.startsWith("http://") && !q.startsWith("https://"))) {
            // direct conn.sendMessage භාවිතය
            await conn.sendMessage(from, { text: "Please provide a YouTube video URL.\n\nExample: `" + global.prfx + "ytmp3 https://www.youtube.com/watch?v=dQw4w9WgXcQ`" }, { quoted: mek });
            return;
        }

        const youtubeUrl = q;

        if (!ytdl.validateURL(youtubeUrl)) {
            console.warn(`[YTMP3] Invalid URL: ${youtubeUrl}`);
            // direct conn.sendMessage භාවිතය
            await conn.sendMessage(from, { text: 'Invalid YouTube URL provided. Please enter a valid YouTube video link.' }, { quoted: mek });
            return;
        }

        const info = await ytdl.getInfo(youtubeUrl);
        const title = info.videoDetails.title.replace(/[^a-zA-Z0-9 ]/g, '');
        const videoId = info.videoDetails.videoId;

        // direct conn.sendMessage භාවිතය
        await conn.sendMessage(from, { text: `⌛ Processing "${title}"...\nPlease wait, this may take a moment.` }, { quoted: mek });

        const audioFilePath = path.join(TEMP_DIR, `${title}_${videoId}.mp3`);

        if (fs.existsSync(audioFilePath)) {
            console.log(`[YTMP3] Removing existing file: ${audioFilePath}`);
            fsExtra.removeSync(audioFilePath);
        }

        await new Promise((resolve, reject) => {
            ffmpeg(ytdl(youtubeUrl, {
                    filter: 'audioonly',
                    quality: 'highestaudio'
                }))
                .audioBitrate(128)
                .save(audioFilePath)
                .on('end', () => {
                    console.log(`[YTMP3] FFmpeg conversion complete for ${title}`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error('[YTMP3] FFmpeg Audio Convert Error:', err);
                    reject(err);
                });
        });

        if (fs.existsSync(audioFilePath)) {
            console.log(`[YTMP3] Sending audio file: ${audioFilePath}`);
            await conn.sendMessage(
                from, {
                    audio: { url: audioFilePath },
                    mimetype: 'audio/mpeg',
                    fileName: `${title}.mp3`,
                    caption: `✅ Successfully downloaded: *${title}*\n\n${yourName}`
                }, { quoted: mek }
            );
            fsExtra.removeSync(audioFilePath);
            console.log(`[YTMP3] Sent and cleaned up: ${audioFilePath}`);
        } else {
            console.error(`[YTMP3] Audio file not found after FFmpeg process: ${audioFilePath}`);
            // direct conn.sendMessage භාවිතය
            await conn.sendMessage(from, { text: '❌ Failed to download audio. The file was not created or found.' }, { quoted: mek });
        }

    } catch (error) {
        console.error('[YTMP3] Main Error Catch:', error);
        if (error.message.includes('No video formats found')) {
            await conn.sendMessage(from, { text: '❌ Could not find downloadable formats for this video. It might be age-restricted, geo-restricted, or private.' }, { quoted: mek });
        } else if (error.message.includes('status code: 403')) {
            await conn.sendMessage(from, { text: '❌ YouTube download failed due to a server error (e.g., rate limit, geo-restriction). Please try again later.' }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { text: `❌ An error occurred while downloading: ${error.message}` }, { quoted: mek });
        }
        fsExtra.emptyDirSync(TEMP_DIR);
        console.log('[YTMP3] Temporary directory cleared on error.');
    }
});
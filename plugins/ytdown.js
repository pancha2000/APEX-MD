// plugins/yt.js

const yt = require('yt-search');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath); // FFmpeg path එක සකසන්න

const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // අහඹු ගොනු නම් සෑදීමට

// command.js ගොනුවෙන් cmd ශ්‍රිතය import කරගන්න
const { cmd } = require('../command'); 

// තාවකාලික ගොනු ගබඩා කිරීමට temp ෆෝල්ඩරය සාදන්න (exist නැත්නම්)
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// --- SONG COMMAND (/song) ---
cmd({
    pattern: 'song',
    desc: 'YouTube ගීත බාගත කරන්න (MP3).',
    usage: '<search query>',
    category: 'downloads',
    filename: __filename,
    react: '🎶'
}, async (conn, mek, m, { q, reply }) => {
    if (!q) {
        return reply("ඔබට අවශ්‍ය ගීතය සෙවීමට නමක් සඳහන් කරන්න.\nභාවිතය: `/song <song name>`\nඋදා: `/song Faded Alan Walker`");
    }

    await reply("සොයමින් සිටී... කරුණාකර රැඳී සිටින්න.");

    let tempFilePath = ''; // තාවකාලික ගොනුවේ path එක ගබඩා කිරීමට

    try {
        const videos = await yt.search(q);
        if (!videos.videos.length) {
            return reply("මට කිසිදු ගීතයක් සොයාගත නොහැකි විය. කරුණාකර වෙනත් නමක් උත්සාහ කරන්න.");
        }

        const video = videos.videos[0];
        await reply(`'${video.title}' ගීතය බාගත කරමින් සිටී... (මෙයට ටික වේලාවක් ගත විය හැක)`);

        // තාවකාලික MP3 ගොනුවක් සඳහා අහඹු නමක් සාදන්න
        const randomName = crypto.randomBytes(8).toString('hex');
        tempFilePath = path.join(tempDir, `${randomName}.mp3`);

        // ytdl-core භාවිතයෙන් audio stream එක ලබාගෙන FFmpeg මගින් MP3 බවට පරිවර්තනය කරන්න.
        const audioStream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });

        await new Promise((resolve, reject) => {
            ffmpeg(audioStream)
                .audioBitrate(128) // 128 kbps bitrate
                .save(tempFilePath)
                .on('end', resolve)
                .on('error', reject);
        });

        // ගොනුව යවන්න (Baileys' conn.sendMessage භාවිතයෙන්)
        // Note: conn.sendFileUrl expects a URL, so we use conn.sendMessage directly for local files.
        await conn.sendMessage(m.chat, { 
            audio: fs.readFileSync(tempFilePath), // ගොනුව buffer එකක් ලෙස කියවන්න
            mimetype: 'audio/mpeg', // MP3 mimetype
            fileName: `${video.title}.mp3`,
            ptt: false // Voice note නොවීමට (optional)
        }, { quoted: m });

        await reply(`මෙන්න ඔබේ ගීතය: *${video.title}*`);

    } catch (error) {
        console.error("YouTube Song Download Error (YTDL):", error);
        if (error.message.includes("403") || error.message.includes("age-restricted")) {
            await reply("බාගත කිරීමේදී දෝෂයක් සිදුවිය. සමහරවිට මෙම ගීතය වයස සීමා කළ හෝ භූගෝලීය සීමා සහිත එකක් විය හැක.");
        } else {
            await reply("ගීතය බාගත කිරීමේදී දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.");
        }
    } finally {
        // බාගත කිරීම අවසන් වූ පසු හෝ දෝෂයක් සිදුවූ පසු තාවකාලික ගොනුව මකා දමන්න
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
});

// --- VIDEO COMMAND (/video) ---
cmd({
    pattern: 'video',
    desc: 'YouTube වීඩියෝ බාගත කරන්න (MP4).',
    usage: '<search query>',
    category: 'downloads',
    filename: __filename,
    react: '🎬'
}, async (conn, mek, m, { q, reply }) => {
    if (!q) {
        return reply("ඔබට අවශ්‍ය වීඩියෝව සෙවීමට නමක් සඳහන් කරන්න.\nභාවිතය: `/video <video name>`\nඋදා: `/video How to Train Your Dragon trailer`");
    }

    await reply("සොයමින් සිටී... කරුණාකර රැඳී සිටින්න.");

    let tempFilePath = ''; // තාවකාලික ගොනුවේ path එක ගබඩා කිරීමට

    try {
        const videos = await yt.search(q);
        if (!videos.videos.length) {
            return reply("මට කිසිදු වීඩියෝවක් සොයාගත නොහැකි විය. කරුණාකර වෙනත් නමක් උත්සාහ කරන්න.");
        }

        const video = videos.videos[0];
        await reply(`'${video.title}' වීඩියෝව බාගත කරමින් සිටී... (මෙයට ටික වේලාවක් ගත විය හැක)`);

        // තාවකාලික MP4 ගොනුවක් සඳහා අහඹු නමක් සාදන්න
        const randomName = crypto.randomBytes(8).toString('hex');
        tempFilePath = path.join(tempDir, `${randomName}.mp4`);

        // ytdl-core භාවිතයෙන් වීඩියෝ stream එක ලබාගෙන ගොනුවක් ලෙස save කරන්න.
        // Highest quality MP4 format with both video and audio
        const videoStream = ytdl(video.url, { filter: format => format.container === 'mp4' && format.hasVideo && format.hasAudio, quality: 'highest' });
        
        await new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(tempFilePath);
            videoStream.pipe(fileStream);
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
            videoStream.on('error', reject); // Catch stream errors
        });

        // ගොනුව යවන්න (Baileys' conn.sendMessage භාවිතයෙන්)
        await conn.sendMessage(m.chat, { 
            video: fs.readFileSync(tempFilePath), // ගොනුව buffer එකක් ලෙස කියවන්න
            mimetype: 'video/mp4', // MP4 mimetype
            fileName: `${video.title}.mp4`,
            caption: `මෙන්න ඔබේ වීඩියෝව: *${video.title}*`
        }, { quoted: m });

    } catch (error) {
        console.error("YouTube Video Download Error (YTDL):", error);
        if (error.message.includes("403") || error.message.includes("age-restricted")) {
            await reply("බාගත කිරීමේදී දෝෂයක් සිදුවිය. සමහරවිට මෙම වීඩියෝව වයස සීමා කළ හෝ භූගෝලීය සීමා සහිත එකක් විය හැක.");
        } else {
            await reply("වීඩියෝව බාගත කිරීමේදී දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.");
        }
    } finally {
        // බාගත කිරීම අවසන් වූ පසු හෝ දෝෂයක් සිදුවූ පසු තාවකාලික ගොනුව මකා දමන්න
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
});
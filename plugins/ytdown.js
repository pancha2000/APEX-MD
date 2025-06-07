// plugins/yt.js

const yt = require('yt-search');
const dylux = require('api-dylux');

// command.js ගොනුවෙන් cmd ශ්‍රිතය import කරගන්න.
// ඔබගේ plugins ෆෝල්ඩරය root folder එකට සාපේක්ෂව command.js ගොනුවට පිවිසීමට '..' අවශ්‍ය වේ.
const { cmd } = require('../command'); 

// --- SONG COMMAND ---
// YouTube ගීත බාගත කිරීම සඳහා විධානය
cmd({
    pattern: 'song', // විධානය ක්‍රියාත්මක කිරීමට භාවිතා කරන රටාව (උදා: /song)
    desc: 'YouTube ගීත බාගත කරන්න (MP3).', // විධානයේ විස්තරය
    usage: '<search query>', // භාවිතය පිළිබඳ උපදෙස්
    category: 'downloads', // ඔබගේ commands සඳහා ඇති category එකක් මෙහි සඳහන් කරන්න
    filename: __filename, // මෙම ප්ලගිනයේ ගොනු නාමය
    react: '🎶' // විධානය ක්‍රියාත්මක වන විට බොට් එක යවන reaction emoji එක
}, async (conn, mek, m, { q, reply }) => {
    // q: විධානයෙන් පසු ඇති සියලු arguments string එකක් ලෙස
    // reply: index.js මගින් සපයන ලද message.reply වැනි ක්‍රියාකාරීත්වය සහිත ශ්‍රිතය
    // conn: Baileys connection object එක (ඔබේ index.js මගින් conn.sendFileUrl එකට මෙය අවශ්‍ය වේ)
    // m: sms.js මගින් සකස් කරන ලද simplified message object එක (m.chat, m.quoted වැනි දේ ඇත)

    if (!q) {
        return reply("ඔබට අවශ්‍ය ගීතය සෙවීමට නමක් සඳහන් කරන්න.\nභාවිතය: `/song <song name>`\nඋදා: `/song Faded Alan Walker`");
    }

    await reply("සොයමින් සිටී... කරුණාකර රැඳී සිටින්න.");

    try {
        // YouTube හි වීඩියෝ සොයන්න
        const videos = await yt.search(q);

        if (!videos.videos.length) {
            return reply("මට කිසිදු ගීතයක් සොයාගත නොහැකි විය. කරුණාකර වෙනත් නමක් උත්සාහ කරන්න.");
        }

        // පළමු ප්‍රතිඵලය තෝරා ගන්න
        const video = videos.videos[0];

        await reply(`'${video.title}' ගීතය බාගත කරමින් සිටී... (මෙයට ටික වේලාවක් ගත විය හැක)`);

        // api-dylux භාවිතයෙන් MP3 බාගත කරන්න
        const downloadResult = await dylux.ytmp3(video.url);

        if (!downloadResult || !downloadResult.url) {
            return reply(`'${video.title}' ගීතය බාගත කිරීමේදී දෝෂයක් සිදුවිය. අසම්පූර්ණ ප්‍රතිචාරයක් ලැබුණි.`);
        }

        const captionText = `*${downloadResult.title}*\n\n_බාගත කිරීමේ සබැඳිය:_ ${downloadResult.url}\n_ගොනු ප්‍රමාණය:_ ${downloadResult.filesize || 'N/A'}`;

        // ඔබගේ index.js මගින් conn object එකට එකතු කරන ලද sendFileUrl ශ්‍රිතය භාවිතා කරන්න.
        // මෙය මගින් Baileys හරහා ගොනු යැවීම වඩාත් පහසු සහ කාර්යක්ෂම වේ.
        await conn.sendFileUrl(m.chat, downloadResult.url, captionText, m);

    } catch (error) {
        console.error("YouTube Song Download Error:", error);
        // දෝෂය පිළිබඳව පරිශීලකයාට දැනුම් දෙන්න.
        if (error.message.includes("403") || error.message.includes("failed to retrieve")) {
            await reply("බාගත කිරීමේදී දෝෂයක් සිදුවිය. සමහරවිට මෙම ගීතය බාගත කිරීමට නොහැකි විය හැක (උදා: වයස සීමා කළ).");
        } else {
            await reply("ගීතය බාගත කිරීමේදී දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.");
        }
    }
});

// --- VIDEO COMMAND ---
// YouTube වීඩියෝ බාගත කිරීම සඳහා විධානය
cmd({
    pattern: 'video', // විධානය ක්‍රියාත්මක කිරීමට භාවිතා කරන රටාව (උදා: /video)
    desc: 'YouTube වීඩියෝ බාගත කරන්න (MP4).', // විධානයේ විස්තරය
    usage: '<search query>', // භාවිතය පිළිබඳ උපදෙස්
    category: 'downloads', // ඔබගේ commands සඳහා ඇති category එකක් මෙහි සඳහන් කරන්න
    filename: __filename, // මෙම ප්ලගිනයේ ගොනු නාමය
    react: '🎬' // විධානය ක්‍රියාත්මක වන විට බොට් එක යවන reaction emoji එක
}, async (conn, mek, m, { q, reply }) => {
    // q: විධානයෙන් පසු ඇති සියලු arguments string එකක් ලෙස
    // reply: index.js මගින් සපයන ලද message.reply වැනි ක්‍රියාකාරීත්වය සහිත ශ්‍රිතය
    // conn: Baileys connection object එක
    // m: sms.js මගින් සකස් කරන ලද simplified message object එක

    if (!q) {
        return reply("ඔබට අවශ්‍ය වීඩියෝව සෙවීමට නමක් සඳහන් කරන්න.\nභාවිතය: `/video <video name>`\nඋදා: `/video How to Train Your Dragon trailer`");
    }

    await reply("සොයමින් සිටී... කරුණාකර රැඳී සිටින්න.");

    try {
        // YouTube හි වීඩියෝ සොයන්න
        const videos = await yt.search(q);

        if (!videos.videos.length) {
            return reply("මට කිසිදු වීඩියෝවක් සොයාගත නොහැකි විය. කරුණාකර වෙනත් නමක් උත්සාහ කරන්න.");
        }

        // පළමු ප්‍රතිඵලය තෝරා ගන්න
        const video = videos.videos[0];

        await reply(`'${video.title}' වීඩියෝව බාගත කරමින් සිටී... (මෙයට ටික වේලාවක් ගත විය හැක)`);

        // api-dylux භාවිතයෙන් MP4 බාගත කරන්න
        const downloadResult = await dylux.ytmp4(video.url);

        if (!downloadResult || !downloadResult.url) {
            return reply(`'${video.title}' වීඩියෝව බාගත කිරීමේදී දෝෂයක් සිදුවිය. අසම්පූර්ණ ප්‍රතිචාරයක් ලැබුණි.`);
        }

        const captionText = `*${downloadResult.title}*\n\n_බාගත කිරීමේ සබැඳිය:_ ${downloadResult.url}\n_ගොනු ප්‍රමාණය:_ ${downloadResult.filesize || 'N/A'}`;

        // ඔබගේ index.js මගින් conn object එකට එකතු කරන ලද sendFileUrl ශ්‍රිතය භාවිතා කරන්න.
        await conn.sendFileUrl(m.chat, downloadResult.url, captionText, m);

    } catch (error) {
        console.error("YouTube Video Download Error:", error);
        if (error.message.includes("403") || error.message.includes("failed to retrieve")) {
            await reply("බාගත කිරීමේදී දෝෂයක් සිදුවිය. සමහරවිට මෙම වීඩියෝව බාගත කිරීමට නොහැකි විය හැක (උදා: වයස සීමා කළ).");
        } else {
            await reply("වීඩියෝව බාගත කිරීමේදී දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.");
        }
    }
});
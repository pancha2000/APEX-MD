// plugins/yt.js

const yt = require('yt-search');
const dylux = require('api-dylux');

// command.js ගොනුවෙන් cmd ශ්‍රිතය import කරගන්න.
// ඔබගේ plugins ෆෝල්ඩරය index.js සමග එකම මට්ටමේ තිබේ නම්
// 'command.js' ගොනුව root folder එකේ තිබෙන නිසා, මෙහි path එක '..' වනු ඇත.
const { cmd } = require('../command'); 

// ඔබගේ බොට් එකේ custom 'cmd' ශ්‍රිතය භාවිතයෙන් විධානය ලියාපදිංචි කරන්න.
// මෙම ශ්‍රිතය index.js මගින් cmdObj.function(conn, mek, m, {...}) ලෙස කැඳවනු ලැබේ.
cmd({
    pattern: 'yt', // විධානය ක්‍රියාත්මක කිරීමට භාවිතා කරන රටාව (උදා: /yt)
    desc: 'YouTube ගීත හෝ වීඩියෝ බාගත කරන්න.', // විධානයේ විස්තරය
    usage: '[audio|video] <search query>', // භාවිතය පිළිබඳ උපදෙස්
    category: 'downloads', // ඔබගේ commands සඳහා ඇති category එකක් මෙහි සඳහන් කරන්න
    filename: __filename, // මෙම ප්ලගිනයේ ගොනු නාමය
    react: '🎶' // විධානය ක්‍රියාත්මක වන විට බොට් එක යවන reaction emoji එක
}, async (conn, mek, m, { args, q, reply }) => {
    // conn: Baileys connection object එක (ඔබේ index.js මගින් conn.sendFileUrl එකට මෙය අවශ්‍ය වේ)
    // mek: Baileys raw message object එක
    // m: sms.js මගින් සකස් කරන ලද simplified message object එක (m.quoted, m.chat වැනි දේ ඇත)
    // args: විධානයෙන් පසු ඇති arguments array එක (උදා: ['audio', 'Faded', 'Alan', 'Walker'])
    // q: සියලු arguments string එකක් ලෙස (args.join(' ') හා සමානයි)
    // reply: index.js මගින් සපයන ලද message.reply වැනි ක්‍රියාකාරීත්වය සහිත ශ්‍රිතය

    let type = 'audio'; // පෙරනිමි වර්ගය audio වේ
    let searchKeywords = args.join(' '); // සියලු arguments search query එක ලෙස ගන්න

    // පළමු argument එක 'audio' හෝ 'video' දැයි පරීක්ෂා කරන්න
    if (args.length > 0 && (args[0].toLowerCase() === 'audio' || args[0].toLowerCase() === 'video')) {
        type = args[0].toLowerCase();
        searchKeywords = args.slice(1).join(' '); // පළමු argument එක ඉවත් කර ඉතිරිය search query එක ලෙස ගන්න
    }

    if (!searchKeywords) {
        return reply("ඔබට අවශ්‍ය ගීතය/වීඩියෝව සෙවීමට නමක් සඳහන් කරන්න.\nභාවිතය: `/yt [audio|video] <search query>`\nඋදා: `/yt Faded Alan Walker` හෝ `/yt video How to Train Your Dragon`");
    }

    await reply("සොයමින් සිටී... කරුණාකර රැඳී සිටින්න.");

    try {
        // YouTube හි වීඩියෝ සොයන්න
        const videos = await yt.search(searchKeywords);

        if (!videos.videos.length) {
            return reply("මට කිසිදු ප්‍රතිඵලයක් සොයාගත නොහැකි විය. කරුණාකර වෙනත් නමක් උත්සාහ කරන්න.");
        }

        // පළමු ප්‍රතිඵලය තෝරා ගන්න
        const video = videos.videos[0];

        await reply(`'${video.title}' බාගත කරමින් සිටී (${type})... කරුණාකර රැඳී සිටින්න. (මෙයට ටික වේලාවක් ගත විය හැක)`);

        let downloadResult;
        if (type === 'audio') {
            downloadResult = await dylux.ytmp3(video.url);
        } else { // type === 'video'
            downloadResult = await dylux.ytmp4(video.url);
        }

        if (!downloadResult || !downloadResult.url) {
            return reply(`'${video.title}' බාගත කිරීමේදී දෝෂයක් සිදුවිය. අසම්පූර්ණ ප්‍රතිචාරයක් ලැබුණි.`);
        }

        const captionText = `*${downloadResult.title}*\n\n_බාගත කිරීමේ සබැඳිය:_ ${downloadResult.url}\n_ගොනු ප්‍රමාණය:_ ${downloadResult.filesize || 'N/A'}`;

        // ඔබගේ index.js මගින් conn object එකට එකතු කරන ලද sendFileUrl ශ්‍රිතය භාවිතා කරන්න.
        // මෙය මගින් Baileys හරහා ගොනු යැවීම වඩාත් පහසු සහ කාර්යක්ෂම වේ.
        // m.chat යනු යවන ලද පණිවිඩයේ chat ID එකයි.
        // m යනු quoted message එක සඳහා වන object එකයි. (සමහරවිට m.quoted, m.key වැනි දේ අවශ්‍ය විය හැක, නමුත් m කෙලින්ම ගොනුවක් යැවීමට ප්‍රමාණවත් වේ.)
        await conn.sendFileUrl(m.chat, downloadResult.url, captionText, m);

    } catch (error) {
        console.error("YouTube බාගත කිරීමේ දෝෂය:", error);
        // දෝෂය පිළිබඳව පරිශීලකයාට දැනුම් දෙන්න.
        // API සීමාවන් හෝ වීඩියෝව බාගත කිරීමට නොහැකි වීම වැනි දේ සඳහා වැඩිදුර දෝෂ හැසිරවීමක් එකතු කළ හැක.
        if (error.message.includes("403") || error.message.includes("failed to retrieve")) {
            await reply("බාගත කිරීමේදී දෝෂයක් සිදුවිය. සමහරවිට මෙම වීඩියෝව බාගත කිරීමට නොහැකි විය හැක (උදා: වයස සීමා කළ).");
        } else {
            await reply("බාගත කිරීමේදී දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.");
        }
    }
});
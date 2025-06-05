// plugins/mode.js
const { AddCommand } = require('../command'); // 'command.js' වෙතින් AddCommand function එක import කරන්න
const { updateEnv, readEnv } = require('../lib/database'); // 'lib/database.js' වෙතින් database functions import කරන්න

// Mode change command එක අර්ථ දක්වන්න
AddCommand({
    pattern: "mode",
    alias: ["setmode"],
    desc: "Change bot mode (public, private, inbox, groups)",
    usage: ".mode <mode>",
    fromMe: true, // මෙය owner ට පමණක් භාවිතා කිරීමට ඉඩ දෙයි
    react: "⚙️",
    category: "owner", // ඔබට කැමති category එකක් දිය හැක
    filename: __filename // plugin ගොනුවේ නම ඇතුළත් කිරීම හොඳ පුරුද්දකි
}, async (conn, mek, m, { args, reply, isOwner }) => {
    if (!isOwner) return reply("මෙම විධානය භාවිතා කළ හැක්කේ බොට් හිමිකරුට පමණි.");

    const newMode = args[0] ? args[0].toLowerCase() : '';
    if (!['public', 'private', 'inbox', 'groups'].includes(newMode)) {
        return reply("වලංගු නොවන ආකාරය. කරුණාකර 'public', 'private', 'inbox', හෝ 'groups' භාවිතා කරන්න.");
    }

    try {
        await updateEnv("MODE", newMode); // දත්ත ගබඩාව යාවත්කාලීන කරන්න
        await readEnv(); // lib/database.js හි ඇති _botSettings internal variable එක යාවත්කාලීන කරන්න
                          // මෙය index.js හි botSettings = getBotSettings() මගින් නව අගයන් ලබා ගැනීමට ඉඩ සලසයි.
        reply(`බොට් ආකාරය සාර්ථකව '${newMode}' ලෙස වෙනස් කරන ලදි.`);
    } catch (error) {
        console.error("Error setting bot mode from plugin:", error);
        reply("බොට් ආකාරය වෙනස් කිරීමේදී දෝෂයක් සිදුවිය.");
    }
});
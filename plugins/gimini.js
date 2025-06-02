// commands/ai.js

// const { readEnv } = require('../lib/database'); // මේ ලයින් එක අයින් කරන්න හෝ comment කරන්න
const { cmd } = require('../command');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAIInstance;

cmd({
    pattern: "ai",
    react: "✨",
    desc: "Ask questions to Gemini AI.",
    category: "ai",
    filename: __filename
},
async (conn, mek, m, { from, q, reply, isOwner }) => {
    try {
        if (!q) {
            return reply("🤖 කරුණාකර මගෙන් ප්‍රශ්නයක් අහන්න.\nඋදා: `.ai ලංකාවේ අගනුවර කුමක්ද?`");
        }

        // config.js එකෙන් GEMINI_API_KEY එක කෙලින්ම ගන්න
        const GEMINI_API_KEY = global.GEMINI_API_KEY;

        if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" || GEMINI_API_KEY === "YOUR_API_KEY_FROM_CONFIG_JS") { // config.js එකේ default value එකත් චෙක් කරන්න
            console.error("Gemini API Key is not configured correctly in config.js or as a global variable.");
            // ඔයා config.js එකේ API key එක දාන තැන default value එකක් පාවිච්චි කරනවනම්, ඒකත් මෙතනට දාන්න
            // උදා: GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" (ඔයාගෙ config.js එකේ default එක අනුව)
            return reply("🚫 Gemini API Key එක config.js ෆයිල් එකේ සකසා නැත. කරුණාකර bot හිමිකරු දැනුවත් කරන්න.");
        }

        if (!genAIInstance) {
            genAIInstance = new GoogleGenerativeAI(GEMINI_API_KEY);
        }
        
        const model = genAIInstance.getGenerativeModel({ model: "gemini-pro" });
        const thinkingMessage = await conn.sendMessage(from, { text: "🤔 AI එක හිතන ගමන් ඉන්නේ... කරුණාකර මදක් රැඳී සිටින්න." }, { quoted: mek });
        const result = await model.generateContent(q);
        const response = await result.response;
        const text = response.text();
        return await conn.sendMessage(from, { text: text }, { quoted: mek });

    } catch (e) {
        console.error("Gemini AI Error:", e);
        let errorMessage = "😥 සමාවන්න, Gemini AI වෙත සම්බන්ධ වීමේදී දෝෂයක් සිදු විය.";
        if (e.message) {
            if (e.message.includes('API key not valid') || e.message.includes('permissionDenied')) {
                errorMessage = "🚫 API Key එක වැරදියි හෝ අවසර නැත. කරුණාකර bot හිමිකරු දැනුවත් කරන්න.";
            } else if (e.message.includes('quota') || e.message.includes('rate limit')) {
                errorMessage = "⌛ API සීමාව ඉක්මවා ඇත. කරුණාකර පසුව උත්සාහ කරන්න.";
            } else if (e.response && e.response.candidates && e.response.candidates[0].finishReason === 'SAFETY') {
                errorMessage = "❌ ඔබගේ ඉල්ලීම ආරක්ෂක ප්‍රතිපත්ති හේතුවෙන් ප්‍රතික්ෂේප විය."
            }
        }
        if (isOwner) {
            await reply(`Owner Debug: ${e.toString()}`);
        }
        return reply(errorMessage);
    }
});
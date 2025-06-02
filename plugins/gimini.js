const { readEnv } = require('../lib/database'); // ඔයාගේ readEnv function එකට path එක
const { cmd } = require('../command'); // ඔයාගේ cmd function එකට path එක
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAIInstance; // Store the genAI instance globally or re-initialize per call

cmd({
    pattern: "gemini", // හෝ ඔයාට කැමති pattern එකක්: "ai", "ask"
    react: "✨",
    desc: "Ask questions to Gemini AI.",
    category: "ai",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply("🤖 කරුණාකර මගෙන් ප්‍රශ්නයක් අහන්න.\nඋදා: `.gemini ලංකාවේ අගනුවර කුමක්ද?`");
        }

        const config = await readEnv();
        const GEMINI_API_KEY = config.GEMINI_API_KEY; // .env එකෙන් GEMINI_API_KEY එක ගන්න

        if (!GEMINI_API_KEY) {
            return reply("🚫 Gemini API Key එක සකසා නැත. කරුණාකර bot හිමිකරු දැනුවත් කරන්න.");
        }

        // Initialize genAI if not already done or if you prefer per-call initialization
        if (!genAIInstance) {
            genAIInstance = new GoogleGenerativeAI(GEMINI_API_KEY);
        }
        // For text-only input, use the gemini-pro model
        const model = genAIInstance.getGenerativeModel({ model: "gemini-pro" });

        await reply("🤔 මම හිතන ගමන් ඉන්නේ... කරුණාකර රැඳී සිටින්න."); // Loading message

        const result = await model.generateContent(q); // q කියන්නේ user ගහපු ප්‍රශ්නය
        const response = await result.response;
        const text = response.text();

        return await reply(text);

    } catch (e) {
        console.error("Gemini AI Error:", e);
        let errorMessage = "😥 සමාවන්න, යම් දෝෂයක් සිදු විය.";
        if (e.message) {
            // Check for specific Gemini API errors if needed
            if (e.message.includes('API key not valid')) {
                errorMessage = "🚫 API Key එක වැරදියි. කරුණාකර bot හිමිකරු දැනුවත් කරන්න.";
            } else if (e.message.includes('quota') || e.message.includes('rate limit')) {
                errorMessage = "⌛ API සීමාව ඉක්මවා ඇත. කරුණාකර පසුව උත්සාහ කරන්න.";
            }
        }
        // For debugging, you might want to send the actual error to the owner
        // if (isOwner) reply(`Error for owner: ${e.toString()}`);
        return reply(errorMessage);
    }
});
// commands/ai.js

const { readEnv } = require('../lib/database'); // Correct path to your readEnv
const { cmd } = require('../command');         // Correct path to your cmd
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAIInstance; // To store the initialized GenAI instance

cmd({
    pattern: "ai", // Command to trigger: .ai <your question>
    react: "✨",
    desc: "Ask questions to Gemini AI.",
    category: "ai", // You can create a new category or use an existing one
    filename: __filename
},
async (conn, mek, m, { from, q, reply, isOwner }) => { // Added isOwner for potential owner-only error details
    try {
        if (!q) {
            return reply("🤖 කරුණාකර මගෙන් ප්‍රශ්නයක් අහන්න.\nඋදා: `.ai ලංකාවේ අගනුවර කුමක්ද?`");
        }

        const config = await readEnv(); // Load environment variables
        const GEMINI_API_KEY = config.GEMINI_API_KEY; // Get API key from .env via readEnv

        if (!GEMINI_API_KEY) {
            console.error("Gemini API Key is not configured in .env file.");
            return reply("🚫 Gemini API Key එක සකසා නැත. කරුණාකර bot හිමිකරු දැනුවත් කරන්න.");
        }

        // Initialize genAI if not already done
        if (!genAIInstance) {
            genAIInstance = new GoogleGenerativeAI(GEMINI_API_KEY);
        }
        
        const model = genAIInstance.getGenerativeModel({ model: "gemini-pro" });

        // Send a thinking message
        const thinkingMessage = await conn.sendMessage(from, { text: "🤔 AI එක හිතන ගමන් ඉන්නේ... කරුණාකර මදක් රැඳී සිටින්න." }, { quoted: mek });

        const result = await model.generateContent(q); // 'q' is the user's question
        const response = await result.response;
        const text = response.text();

        // Edit the thinking message with the actual response
        // Or send a new reply, editing might be cleaner if supported well by your conn.sendMessage
        return await conn.sendMessage(from, { text: text }, { quoted: mek });
        // If you want to edit the "thinking" message:
        // return await conn.relayMessage(from, {
        //     protocolMessage: {
        //         key: thinkingMessage.key,
        //         type: 14, // EPHEMERAL_SETTING
        //         editedMessage: {
        //             conversation: text
        //         }
        //     },
        //     messageTimestamp: thinkingMessage.messageTimestamp
        // }, { quoted: mek });
        // Note: Editing messages can be complex; sending a new reply is simpler.

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
        
        // If you want to send detailed error to owner only
        if (isOwner) {
            await reply(`Owner Debug: ${e.toString()}`);
        }
        return reply(errorMessage);
    }
});
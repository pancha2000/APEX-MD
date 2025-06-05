// plugins/gimini.js
const { cmd } = require('../command');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config'); // Import config

let genAIInstance;
const GEMINI_API_KEY = config.GEMINI_API_KEY; // Get from config

cmd({
    pattern: "ai",
    // ... (rest of the command definition)
},
async (conn, mek, m, { q, reply, isOwner }) => {
    try {
        if (!q) {
            return reply("🤖 කරුණාකර මගෙන් ප්‍රශ්නයක් අහන්න.\nඋදා: `.ai ලංකාවේ අගනුවර කුමක්ද?`");
        }

        if (!GEMINI_API_KEY) { // Check if key exists in config
            console.error("Gemini API Key is missing in config.js or .env file!");
            return reply("🚫 Gemini API Key එක සකසා නැත. කරුණාකර bot හිමිකරු දැනුවත් කරන්න.");
        }

        if (!genAIInstance) {
            try {
                genAIInstance = new GoogleGenerativeAI(GEMINI_API_KEY);
            } catch (initError) {
                // ... (your existing good error handling for initError)
                 console.error("Error initializing GoogleGenerativeAI:", initError);
                if (initError.message && (initError.message.includes('API key not valid') || initError.message.includes('permission denied'))) {
                     return reply("🚫 API Key එක වැරදියි හෝ අවසර නැත (ආරම්භ කිරීමේදී දෝෂයකි). කරුණාකර bot හිමිකරු දැනුවත් කරන්න.");
                }
                return reply("😥 සමාවන්න, Gemini AI සේවාව ආරම්භ කිරීමේදී දෝෂයක් සිදු විය.");
            }
        }
        
        const model = genAIInstance.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        await reply("🤔 AI එක හිතන ගමන් ඉන්නේ... කරුණාකර මදක් රැඳී සිටින්න.");
        const result = await model.generateContent(q);
        const response = await result.response;
        const text = response.text();
        return await reply(text);

    } catch (e) {
        // ... (your existing good error handling for execution error)
        console.error("Gemini AI Error in command execution:", e);
        let errorMessage = "😥 සමාවන්න, Gemini AI වෙත සම්බන්ධ වීමේදී දෝෂයක් සිදු විය.";
        
        if (e.message) {
            if (e.message.includes('API key not valid') || e.message.includes('permission denied')) {
                errorMessage = "🚫 API Key එක වැරදියි හෝ අවසර නැත. කරුණාකර bot හිමිකරු දැනුවත් කරන්න.";
            } else if (e.message.includes('quota') || e.message.includes('rate limit')) {
                errorMessage = "⌛ API සීමාව ඉක්මවා ඇත. කරුණාකර පසුව උත්සාහ කරන්න.";
            } else if (e.response && e.response.candidates && e.response.candidates[0] && e.response.candidates[0].finishReason === 'SAFETY') {
                errorMessage = "❌ ඔබගේ ඉල්ලීම ආරක්ෂක ප්‍රතිපත්ති හේතුවෙන් ප්‍රතික්ෂේප විය.";
            } else if (e.message.includes("User location is not supported")) {
                errorMessage = "📍 සමාවන්න, ඔබගේ කලාපය සඳහා මෙම සේවාව ලබා ගත නොහැක (User location not supported).";
            }
        }
        
        if (isOwner && e.message) { // Send only message to owner for brevity, stack is in console
            await reply(`*Owner Debug Info for AI cmd:*\nError: ${e.message}`);
        }
        return reply(errorMessage);
    }
});
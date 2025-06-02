// plugins/ai-gemini.js

// ඔයාගෙ command.js (හෝ command handler) ෆයිල් එක තියෙන තැනට path එක හරිගස්සගන්න
const { cmd } = require('../command'); // උදා: '../command' හෝ './command'
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- ඔයා දීපු Gemini API Key එක මෙතන කෙලින්ම දානවා ---
const GEMINI_API_KEY = "AIzaSyCItRq9qKhyDo5ZjO_ZBtRC1Z-Y3UD9Ma0";

let genAIInstance; // GoogleGenerativeAI instance එක තියාගන්න

cmd({
    pattern: "ai", // Command එක: .ai <ප්‍රශ්නය>
    react: "✨",
    desc: "Gemini AI වෙතින් ප්‍රශ්න අසන්න.",
    category: "ai",
    filename: __filename
},
async (conn, mek, m, { from, q, reply, isOwner }) => {
    try {
        if (!q) {
            return reply("🤖 කරුණාකර මගෙන් ප්‍රශ්නයක් අහන්න.\nඋදා: `.ai ලංකාවේ අගනුවර කුමක්ද?`");
        }

        // API Key එක තියෙනවද කියල පොඩි චෙක් එකක් (හිස්ද බලන්න)
        // ඔයා key එක උඩ hardcode කරල තියෙන නිසා, මේක ගොඩක් වෙලාවට true වෙන්න ඕන
        // හැබැයි, කවුරුහරි අතින් key එක delete කලොත් අල්ලගන්න පුළුවන්
        if (!GEMINI_API_KEY) {
            console.error("Gemini API Key is missing in ai-gemini.js!");
            return reply("🚫 Gemini API Key එක මෙම ෆයිල් එක තුල සකසා නැත. කරුණාකර bot හිමිකරු දැනුවත් කරන්න.");
        }

        // genAIInstance එක initialize කරලා නැත්නම් විතරක් කරන්න
        if (!genAIInstance) {
            try {
                genAIInstance = new GoogleGenerativeAI(GEMINI_API_KEY);
            } catch (initError) {
                console.error("Error initializing GoogleGenerativeAI:", initError);
                // API key එක වැරදි නම් (උදා: අකුරක් එහෙම අඩු වැඩි උනොත්) මෙතන error එකක් එන්න පුළුවන්
                if (initError.message && (initError.message.includes('API key not valid') || initError.message.includes('permission denied'))) {
                     return reply("🚫 API Key එක වැරදියි හෝ අවසර නැත (ආරම්භ කිරීමේදී දෝෂයකි). කරුණාකර bot හිමිකරු දැනුවත් කරන්න.");
                }
                return reply("😥 සමාවන්න, Gemini AI සේවාව ආරම්භ කිරීමේදී දෝෂයක් සිදු විය.");
            }
        }
        
        const model = genAIInstance.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        // "Thinking" message එකක් යවන්න
        await reply("🤔 AI එක හිතන ගමන් ඉන්නේ... කරුණාකර මදක් රැඳී සිටින්න.");

        const result = await model.generateContent(q); // 'q' කියන්නෙ user ගෙ ප්‍රශ්නය
        const response = await result.response;
        const text = response.text();

        // AI එකේ උත්තරේ යවන්න
        return await reply(text);

    } catch (e) {
        console.error("Gemini AI Error in command execution:", e);
        let errorMessage = "😥 සමාවන්න, Gemini AI වෙත සම්බන්ධ වීමේදී දෝෂයක් සිදු විය.";
        
        // Specific error messages
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
            // You can add more specific checks if needed
        }
        
        // Owner ට විතරක් වැඩි විස්තර යවන්න (debug කරන්න ලේසි වෙන්න)
        if (isOwner && e.stack) {
            await reply(`*Owner Debug Info:*\nError: ${e.message}\n\n*Stack (first 500 chars):*\n${e.stack.substring(0, 500)}...`);
        }
        
        return reply(errorMessage);
    }
});
const fs = require('fs');
if (fs.existsSync('config.env')) {
    require('dotenv').config({ path: './config.env' });
}

// convertToBool function was not used, so it's removed.
// If you need it later, you can re-add it.

module.exports = {
    SESSION_ID: process.env.SESSION_ID || "PRlQWQCC#kbL4tob-unW5vicqtShvwBJMX_sq6g00FHwkgT2LCdg",
    MONGODB: process.env.MONGODB || "mongodb+srv://pancha:2006.Shehan@cluster0.hyugfei.mongodb.net/",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSyCItRq9qKhyDo5ZjO_ZBtRC1Z-Y3UD9Ma0",
};
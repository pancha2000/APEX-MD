const fs = require('fs');
if (fs.existsSync('config.env')) {
    require('dotenv').config({ path: './config.env' });
}

// convertToBool function was not used, so it's removed.
// If you need it later, you can re-add it.

module.exports = {
  //===================Bot info===============================
    SESSION_ID: process.env.SESSION_ID || "zrxwSQDK#CIjobxA0bhjba4BJWfv5J0b_jx3BGMwWJv8f3s8-kS8",
    MONGODB: process.env.MONGODB || "mongodb+srv://pancha:2006.Shehan@cluster0.hyugfei.mongodb.net/",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSyCItRq9qKhyDo5ZjO_ZBtRC1Z-Y3UD9Ma0",
    
// ==================Your info=================================

  OWNER_NAME: process.env.OWNER_NAME || "Shehan Vimukthi",
  PUBLIC_NAME: process.env.PUBLIC_NAME || "Real Pancha",
  NICKNAME: process.env.NICKNAME || "Pancha",
  AGE: process.env.AGE || "19",
  OWNER_CONTACT: process.env.OWNER_CONTACT || "wa.me/+94701391585",
  

};
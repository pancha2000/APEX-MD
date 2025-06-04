const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}
module.exports = {
SESSION_ID: process.env.SESSION_ID || "zRMSTCwB#H_FwZ9v2Ym0SkiujciglUybf0ppTc-XbyHW46gwsR4g",
MONGODB: process.env.MONGODB || "mongodb+srv://pancha:2006.Shehan@cluster0.hyugfei.mongodb.net/",
MODE: process.env.MODE || "groups"

};

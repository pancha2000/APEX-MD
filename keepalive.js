const express = require('express');
const app = express();

app.all('/', (req, res) => {
  res.send('✅ Pancha One Bot is alive!');
});

function keepAlive() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 KeepAlive running on http://localhost:${port}`);
  });
}

module.exports = keepAlive;
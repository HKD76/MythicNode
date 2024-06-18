require('dotenv').config();
const express = require('express');
const summonerRoutes = require('./routes/summonerRoutes');
const tokenRoutes = require('./routes/tokenRoutes');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use('/summoner', summonerRoutes);
app.use('/api', tokenRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

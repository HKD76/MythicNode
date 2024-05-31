require('dotenv').config();
const express = require('express');
const summonerRoutes = require('./routes/summonerRoutes');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use('/summoner', summonerRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

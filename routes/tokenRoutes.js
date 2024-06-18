const express = require('express');
const router = express.Router();

router.get('/riot-token', (req, res) => {
  const riotToken = process.env.RIOT_API_KEY;
  res.json({ token: riotToken });
});

module.exports = router;

const express = require('express');
const summonerController = require('../controllers/summonerController');
const router = express.Router();

router.get('/match-history/:puuid', summonerController.getMatchHistory);
router.get('/account/:riotID/:tag', summonerController.getSummonerByRiotID);
router.get('/account-puuid/:puuid', summonerController.getSummonerByPUUID);
router.get('/match-details/:matchId', summonerController.getMatchDetails);
router.get('/ranked-stats/:summonerId', summonerController.getRankedStats);
router.get('/champion-mastery/:summonerId', summonerController.getChampionMastery);

module.exports = router;

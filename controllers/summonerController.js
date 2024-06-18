const axios = require('axios');
const mysqlConnection = require('../models/mysql');
const { connectToMongo } = require('../models/mongodb');

const RIOT_API_KEY = process.env.RIOT_API_KEY;

const getSummonerByRiotID = async (req, res) => {
  const riotID = req.params.riotID;
  const tag = req.params.tag;
  
  try {
    const response = await axios.get(`https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${riotID}/${tag}`, {
      headers: { 'X-Riot-Token': RIOT_API_KEY }
    });

    const accountData = response.data;

    // Save to MySQL
    const query = 'INSERT INTO accounts (puuid, gameName, tagLine) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE gameName=?, tagLine=?';
    mysqlConnection.query(query, [accountData.puuid, accountData.gameName, accountData.tagLine, accountData.gameName, accountData.tagLine], (err) => {
      if (err) throw err;
      console.log('Data saved to MySQL');
    });

    // Save to MongoDB
    const mongoDb = await connectToMongo();
    mongoDb.collection('accounts').updateOne(
      { puuid: accountData.puuid },
      { $set: accountData },
      { upsert: true },
      (err) => {
        if (err) throw err;
        console.log('Data saved to MongoDB');
      }
    );

    res.json(accountData);
  } catch (error) {
    res.status(500).send(error.toString());
  }
};

const getSummonerByPUUID = async (req, res) => {
  const { puuid } = req.params;
  console.log('Received request for PUUID:', puuid);

  const url = `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  console.log('Calling Riot API with URL:', url);
  try {
    const response = await axios.get(url, {
      headers: { 'X-Riot-Token': RIOT_API_KEY }
    });

    // console.log('Response from Riot API:', response.data);

    // Save to MySQL
    // const query = 'INSERT INTO summoners (puuid, summonerName, summonerLevel) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE summonerName=?, summonerLevel=?';
    // mysqlConnection.query(query, [response.data.puuid, response.data.name, response.data.summonerLevel, response.data.name, response.data.summonerLevel], (err) => {
    //   if (err) throw err;
    //   console.log('Summoner data saved to MySQL');
    // });

    // Save to MongoDB
    // const mongoDb = await connectToMongo();
    // mongoDb.collection('summoners').updateOne(
    //   { puuid: response.data.puuid },
    //   { $set: response.data },
    //   { upsert: true },
    //   (err) => {
    //     if (err) throw err;
    //     console.log('Summoner data saved to MongoDB');
    //   }
    // );

    res.json(response.data);
  } catch (error) {
    // console.error('Error fetching data from Riot API:', error);
    res.status(500).send(error.toString());
  }
};

const getMatchHistory = async (req, res) => {
  const { puuid } = req.params;

  console.log('Request received for match history');
  console.log('PUUID:', puuid);

  const url = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`;

  console.log('Calling Riot API with URL:', url);

  try {
    const response = await axios.get(url, {
      headers: { 'X-Riot-Token': RIOT_API_KEY }
    });

    console.log('Riot API response status:', response.status);
    console.log('Riot API response data:', response.data);

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching match history:', error.response ? error.response.data : error.message);
    res.status(500).send(error.response ? error.response.data : error.message);
  }
};

const getMatchDetails = async (req, res) => {
  const { matchId } = req.params;

  try {
    const response = await axios.get(`https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`, {
      headers: { 'X-Riot-Token': RIOT_API_KEY }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
};

const getRankedStats = async (req, res) => {
  const { summonerId } = req.params;

  try {
    const response = await axios.get(`https://europe.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`, {
      headers: { 'X-Riot-Token': RIOT_API_KEY }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
};

const getChampionMastery = async (req, res) => {
  const { summonerId } = req.params;

  try {
    const response = await axios.get(`https://europe.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/${summonerId}`, {
      headers: { 'X-Riot-Token': RIOT_API_KEY }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
};

module.exports = {
  getMatchHistory,
  getSummonerByRiotID,
  getMatchDetails,
  getRankedStats,
  getChampionMastery,
  getSummonerByPUUID
};

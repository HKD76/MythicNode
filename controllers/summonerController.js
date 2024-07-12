const axios = require("axios");
const { handleError } = require("../utils/errorHandler");
const { saveToMongo } = require("../utils/mongoHelper");

const RIOT_API_KEY = process.env.RIOT_API_KEY;

const getSummonerByRiotID = async (req, res) => {
  const { riotID, tag } = req.params;

  try {
    const response = await axios.get(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${riotID}/${tag}`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );

    const accountData = response.data;

    const { puuid, gameName, tagLine } = accountData;

    const summonerResponse = await axios.get(
      `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );

    const summonerData = summonerResponse.data;
    console.log("summonerData", summonerData);
    const { id, accountId, profileIconId, summonerLevel } = summonerData;

    const dataToSave = {
      id,
      accountId,
      puuid,
      gameName,
      tagLine,
      profileIconId,
      summonerLevel,
    };

    await saveToMongo("accounts", { puuid: dataToSave.puuid }, dataToSave);

    res.json(dataToSave);
  } catch (error) {
    handleError(res, error);
  }
};

const getSummonerByPUUID = async (req, res) => {
  const { puuid } = req.params;
  console.log("Received request for PUUID:", puuid);

  const url = `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  console.log("Calling Riot API with URL:", url);

  try {
    const response = await axios.get(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY },
    });

    const summonerData = response.data;
    const { name: gameName, profileIconId, summonerLevel } = summonerData;

    const dataToSave = {
      puuid,
      gameName,
      tagLine: null,
      profileIconId,
      summonerLevel,
    };

    await saveToMongo("summoners", { puuid: dataToSave.puuid }, dataToSave);

    res.json(dataToSave);
  } catch (error) {
    handleError(res, error);
  }
};

const getMatchHistory = async (req, res) => {
  const { puuid } = req.params;

  console.log("Request received for match history");
  console.log("PUUID:", puuid);

  const url = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`;

  console.log("Calling Riot API with URL:", url);

  try {
    const response = await axios.get(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY },
    });

    console.log("Riot API response status:", response.status);
    console.log("Riot API response data:", response.data);

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error fetching match history:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send(error.response ? error.response.data : error.message);
  }
};

const getMatchDetails = async (req, res) => {
  const { matchId } = req.params;

  try {
    const response = await axios.get(
      `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
      {
        headers: { "X-Riot-Token": RIOT_API_KEY },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
};

const getRankedStats = async (req, res) => {
  const { summonerId } = req.params;

  try {
    const response = await axios.get(
      `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
      {
        headers: { "X-Riot-Token": RIOT_API_KEY },
      }
    );

    const rankedStats = response.data.filter(
      (entry) =>
        entry.queueType === "RANKED_SOLO_5x5" ||
        entry.queueType === "RANKED_FLEX_SR"
    );

    res.json(rankedStats);
  } catch (error) {
    res.status(500).send(error.toString());
  }
};

const getChampionMastery = async (req, res) => {
  const { summonerId } = req.params;

  try {
    const response = await axios.get(
      `https://euw1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/${summonerId}`,
      {
        headers: { "X-Riot-Token": RIOT_API_KEY },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.toString());
  }
};

const getRecentMatchesDetails = async (req, res) => {
  const { puuid } = req.params;

  if (!puuid) {
    return res.status(400).send("puuid parameter is required");
  }

  try {
    const matchHistoryResponse = await axios.get(
      `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10`,
      { headers: { "X-Riot-Token": RIOT_API_KEY } }
    );

    const matchIds = matchHistoryResponse.data;

    if (!matchIds.length) {
      return res.status(404).send("No matches found");
    }

    console.log("matchIds", matchIds);

    const matchDetailsPromises = matchIds.map((matchId) =>
      axios.get(
        `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        {
          headers: { "X-Riot-Token": RIOT_API_KEY },
        }
      )
    );

    const matchDetailsResponses = await Promise.all(matchDetailsPromises);

    const matchDetails = matchDetailsResponses.map((response) => response.data);

    res.json(matchDetails);
  } catch (error) {
    console.error("Error fetching match details", error);
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).send(error.toString());
    }
  }
};

const getWorldRank = async (req, res) => {
  const { summonerId } = req.params;

  try {
    const response = await axios.get(
      `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
      {
        headers: { "X-Riot-Token": RIOT_API_KEY },
      }
    );

    const soloQueue = response.data.find(
      (entry) => entry.queueType === "RANKED_SOLO_5x5"
    );

    if (soloQueue) {
      const worldRank = calculateWorldRank(soloQueue);
      res.json({ rank: worldRank });
    } else {
      res.status(404).send("Solo queue data not found");
    }
  } catch (error) {
    res.status(500).send(error.toString());
  }
};

const getServerRank = async (req, res) => {
  const { summonerId } = req.params;

  try {
    const response = await axios.get(
      `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`,
      {
        headers: { "X-Riot-Token": RIOT_API_KEY },
      }
    );

    const soloQueue = response.data.find(
      (entry) => entry.queueType === "RANKED_SOLO_5x5"
    );

    if (soloQueue) {
      res.json({ rank: soloQueue.rank });
    } else {
      res.status(404).send("Solo queue data not found");
    }
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
  getSummonerByPUUID,
  getRecentMatchesDetails,
  getWorldRank,
  getServerRank,
};

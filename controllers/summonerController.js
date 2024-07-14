const axios = require("axios");
const { handleError } = require("../utils/errorHandler");
const { saveToMongo } = require("../utils/mongoHelper");
const { query } = require("../utils/mysqlHelper");

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

  const url = `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;

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

  const url = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`;

  try {
    const response = await axios.get(url, {
      headers: { "X-Riot-Token": RIOT_API_KEY },
    });

    res.json(response.data);
  } catch (error) {
    handleError(res, error);
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

    const matchData = response.data;

    const playerStats = matchData.info.participants.map((participant) => ({
      puuid: participant.puuid,
      match_id: matchId,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      gold_earned: participant.goldEarned,
      total_minions_killed: participant.totalMinionsKilled,
      damage_dealt: participant.totalDamageDealtToChampions,
      game_duration: matchData.info.gameDuration,
      match_date: new Date(matchData.info.gameCreation).toISOString(),
    }));

    const insertPromises = playerStats.map((stats) =>
      query(
        "INSERT INTO match_stats (puuid, match_id, kills, deaths, assists, gold_earned, total_minions_killed, damage_dealt, game_duration, match_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          stats.puuid,
          stats.match_id,
          stats.kills,
          stats.deaths,
          stats.assists,
          stats.gold_earned,
          stats.total_minions_killed,
          stats.damage_dealt,
          stats.game_duration,
          stats.match_date,
        ]
      )
    );

    await Promise.all(insertPromises);

    res.json(matchData);
  } catch (error) {
    console.error("Error in getMatchDetails:", error);
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
    handleError(res, error);
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
    handleError(res, error);
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

    const matchDetailsPromises = matchIds.map(async (matchId) => {
      try {
        const response = await axios.get(
          `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
          {
            headers: { "X-Riot-Token": RIOT_API_KEY },
          }
        );

        const matchData = response.data;

        const playerStats = matchData.info.participants.map((participant) => ({
          puuid: participant.puuid,
          match_id: matchId,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          gold_earned: participant.goldEarned,
          total_minions_killed: participant.totalMinionsKilled,
          damage_dealt: participant.totalDamageDealtToChampions,
          game_duration: matchData.info.gameDuration,
          match_date: new Date(matchData.info.gameCreation)
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
        }));

        const insertPromises = playerStats.map((stats) =>
          query(
            "INSERT INTO match_stats (puuid, match_id, kills, deaths, assists, gold_earned, total_minions_killed, damage_dealt, game_duration, match_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE match_id = match_id",
            [
              stats.puuid,
              stats.match_id,
              stats.kills,
              stats.deaths,
              stats.assists,
              stats.gold_earned,
              stats.total_minions_killed,
              stats.damage_dealt,
              stats.game_duration,
              stats.match_date,
            ]
          )
        );

        await Promise.all(insertPromises);

        return matchData;
      } catch (error) {
        console.error(
          `Error fetching match details for matchId ${matchId}:`,
          error
        );
        throw error;
      }
    });

    const matchDetails = await Promise.all(matchDetailsPromises);
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

const getAverageStats = async (req, res) => {
  try {
    const avgStats = await query(
      `SELECT 
        AVG(kills) as avg_kills,
        AVG(deaths) as avg_deaths,
        AVG(assists) as avg_assists,
        AVG(gold_earned) as avg_gold_earned,
        AVG(total_minions_killed) as avg_total_minions_killed,
        AVG(damage_dealt) as avg_damage_dealt
      FROM match_stats`
    );
    res.json(avgStats[0]);
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
  getAverageStats,
};

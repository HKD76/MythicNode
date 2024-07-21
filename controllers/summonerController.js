const axios = require("axios");
const { handleError } = require("../utils/errorHandler");
const { saveToMongo } = require("../utils/mongoHelper");
const { query } = require("../utils/mysqlHelper");
const { MongoClient } = require("mongodb");
const { connectToMongo } = require("../models/mongodb");

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

const getMatchDetails = async (matchId) => {
  try {
    const response = await axios.get(
      `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
      {
        headers: { "X-Riot-Token": RIOT_API_KEY },
      }
    );

    const matchData = response.data;
    const currentDate = new Date();
    const maxDate = new Date();
    maxDate.setDate(currentDate.getDate() - 30);

    const rankedPromises = matchData.info.participants.map(
      async (participant) => {
        try {
          const rankedResponse = await axios.get(
            `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${participant.summonerId}`,
            {
              headers: { "X-Riot-Token": RIOT_API_KEY },
            }
          );
          const soloQueueRank = rankedResponse.data.find(
            (entry) => entry.queueType === "RANKED_SOLO_5x5"
          );
          return soloQueueRank ? soloQueueRank.tier : "Unranked";
        } catch (error) {
          console.error(
            `Error fetching rank for summoner ${participant.summonerId}:`,
            error
          );
          return "Unranked";
        }
      }
    );

    const ranks = await Promise.all(rankedPromises);

    const playerStats = matchData.info.participants.map(
      (participant, index) => ({
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
        inserted_at: new Date().toISOString().slice(0, 19).replace("T", " "),
        rank: ranks[index],
      })
    );

    if (new Date(matchData.info.gameCreation) >= maxDate) {
      const insertPromises = playerStats.map((stats) =>
        query(
          `INSERT INTO match_stats 
          (puuid, match_id, kills, deaths, assists, gold_earned, total_minions_killed, damage_dealt, game_duration, match_date, inserted_at, rank) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
          ON DUPLICATE KEY UPDATE 
          kills = VALUES(kills), deaths = VALUES(deaths), assists = VALUES(assists), 
          gold_earned = VALUES(gold_earned), total_minions_killed = VALUES(total_minions_killed), 
          damage_dealt = VALUES(damage_dealt), game_duration = VALUES(game_duration), 
          match_date = VALUES(match_date), inserted_at = VALUES(inserted_at), rank = VALUES(rank)`,
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
            stats.inserted_at,
            stats.rank,
          ]
        )
      );

      await Promise.all(insertPromises);

      const totalRows = await query(
        "SELECT COUNT(*) as count FROM match_stats"
      );
      if (totalRows[0].count > 5000) {
        await query(
          `DELETE FROM match_stats ORDER BY inserted_at ASC LIMIT ${
            totalRows[0].count - 5000
          }`
        );
      }
    } else {
      console.log("Match data is older than 30 days and was not inserted.");
    }

    return matchData;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.warn(`Match ${matchId} not found, skipping.`);
      return null;
    } else {
      console.error(
        `Error fetching match details for matchId ${matchId}:`,
        error
      );
      throw error;
    }
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

    const matchDetails = [];
    for (const matchId of matchIds) {
      const matchData = await getMatchDetails(matchId);
      if (matchData && [420, 430, 450].includes(matchData.info.queueId)) {
        matchDetails.push(matchData);
      }
    }

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

const getStatsByRank = async (req, res) => {
  const { rank } = req.params;
  const startTime = Date.now();

  try {
    const stats = await query(`SELECT * FROM match_stats WHERE rank = ?`, [
      rank,
    ]);

    const endTime = Date.now();
    console.log(`Query executed in ${endTime - startTime} ms`);

    if (stats.length === 0) {
      return res.status(404).json({ message: "No stats found for this rank" });
    }

    res.json(stats);
  } catch (error) {
    console.error("Error fetching stats by rank:", error);
    res.status(500).json({ error: "An error occurred while fetching stats" });
  }
};

const searchUsers = async (req, res) => {
  const { query } = req.query;

  if (!query || query.length < 3) {
    return res
      .status(400)
      .json({ error: "Query must be at least 3 characters long" });
  }

  try {
    console.log(`Searching for users with query: ${query}`);
    const db = await connectToMongo();
    const users = await db
      .collection("accounts")
      .find({
        gameName: new RegExp(query, "i"),
      })
      .limit(10)
      .toArray();

    console.log(`Found users: ${JSON.stringify(users)}`);
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Error fetching users" });
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
  getStatsByRank,
  searchUsers,
};

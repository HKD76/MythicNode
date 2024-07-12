const { connectToMongo } = require("../models/mongodb");

const saveToMongo = async (collectionName, query, data) => {
  const mongoDb = await connectToMongo();
  return mongoDb
    .collection(collectionName)
    .updateOne(query, { $set: data }, { upsert: true });
};

module.exports = { saveToMongo };

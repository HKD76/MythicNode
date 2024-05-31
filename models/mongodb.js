const { MongoClient } = require('mongodb');

const mongoClient = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

let mongoDb;

const connectToMongo = async () => {
  if (!mongoDb) {
    try {
      await mongoClient.connect();
      mongoDb = mongoClient.db('league_data');
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('Failed to connect to the database. Error:', err);
      throw new Error('Database connection failed');
    }
  }
  return mongoDb;
};

module.exports = { connectToMongo };

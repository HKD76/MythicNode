const mysql = require("mysql");
require("dotenv").config();

const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    process.exit(1);
  } else {
    console.log("Connected to MySQL database");
    connection.query("SHOW TABLES", (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
      } else {
        console.log("Tables in the database:", results);
      }
      connection.end();
    });
  }
});

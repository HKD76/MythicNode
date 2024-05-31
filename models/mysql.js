const mysql = require('mysql');

const mysqlConnection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

mysqlConnection.connect(err => {
  if (err) throw err;
  console.log('Connected to MySQL');
});

module.exports = mysqlConnection;

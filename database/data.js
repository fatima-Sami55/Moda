require('dotenv').config();
const sql = require('mssql');

const connection = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

const pool = new sql.ConnectionPool(connection);
const poolConnect = pool.connect(); // no callback

pool.on('error', err => {
  console.error('❌ SQL error:', err);
});

process.on('SIGINT', async () => {
  await pool.close();
  process.exit(0);
});

module.exports = { sql, pool, poolConnect };

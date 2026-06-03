const sql = require("mssql");
const config = require("../config");

const connection = {
  user: config.db.user,
  password: config.db.password,
  server: config.db.server,
  port: config.db.port,
  database: config.db.database,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

const pool = new sql.ConnectionPool(connection);
const poolConnect = pool.connect();

pool.on("error", err => {
  console.error("[Database] SQL pool error:", err);
});

process.on("SIGINT", async () => {
  await pool.close();
  process.exit(0);
});

module.exports = { sql, pool, poolConnect };

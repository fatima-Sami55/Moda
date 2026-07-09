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

// Internal state — mutable so the Thenable can swap in a fresh pool on reconnect
let pool = new sql.ConnectionPool(connection);
let _connectPromise = pool.connect();

pool.on("error", err => {
  console.error("[Database] SQL pool error:", err);
});

/**
 * Dynamic Thenable — compatible with `await poolConnect` in every route.
 *
 * On each await, it checks whether the current pool is still connected:
 *   - Connected  → resolves immediately (zero overhead).
 *   - Closed/Errored → creates a brand-new ConnectionPool, reconnects, then resolves.
 *
 * This prevents ECONNCLOSED errors on Render (and Vercel) after the host
 * idles and Azure SQL drops the stale socket.
 */
const poolConnect = {
  then(onFulfilled, onRejected) {
    const ensureConnected = async () => {
      // pool.connected  → pool is open and healthy
      // pool.connecting → a connect() is already in flight, wait for it
      if (!pool.connected && !pool.connecting) {
        console.log("[Database] Pool is closed — reconnecting...");
        pool = new sql.ConnectionPool(connection);
        pool.on("error", err => {
          console.error("[Database] SQL pool error:", err);
        });
        _connectPromise = pool.connect();
      }
      return _connectPromise;
    };

    return ensureConnected().then(onFulfilled, onRejected);
  },
};

// Expose a getter so routes that reference `pool` directly always get the live instance
const poolProxy = new Proxy({}, {
  get(_target, prop) {
    return pool[prop];
  },
  set(_target, prop, value) {
    pool[prop] = value;
    return true;
  },
});

process.on("SIGINT", async () => {
  await pool.close();
  process.exit(0);
});

module.exports = { sql, pool: poolProxy, poolConnect };

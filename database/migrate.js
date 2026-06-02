const { pool, poolConnect } = require("./data");
const sql = require("mssql");

async function runMigrations() {
  try {
    await poolConnect;
    // Check if columns exist
    const checkColumns = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'purchaseditems' 
      AND COLUMN_NAME IN ('arrivalDate', 'shipmentDate', 'deliveryDate')
    `);

    const existingColumns = checkColumns.recordset.map(r => r.COLUMN_NAME.toLowerCase());
    const columnsToAdd = [];

    if (!existingColumns.includes("arrivaldate")) {
      columnsToAdd.push("arrivalDate DATETIME NULL");
    }
    if (!existingColumns.includes("shipmentdate")) {
      columnsToAdd.push("shipmentDate DATETIME NULL");
    }
    if (!existingColumns.includes("deliverydate")) {
      columnsToAdd.push("deliveryDate DATETIME NULL");
    }

    if (columnsToAdd.length > 0) {
      await pool.request().query(`
        ALTER TABLE purchaseditems 
        ADD ${columnsToAdd.join(", ")};
      `);
    }

    // Check if users reset token columns exist
    const checkUsersColumns = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
      AND COLUMN_NAME IN ('reset_token', 'reset_expires')
    `);

    const existingUsersColumns = checkUsersColumns.recordset.map(r => r.COLUMN_NAME.toLowerCase());
    const usersColumnsToAdd = [];

    if (!existingUsersColumns.includes("reset_token")) {
      usersColumnsToAdd.push("reset_token VARCHAR(255) NULL");
    }
    if (!existingUsersColumns.includes("reset_expires")) {
      usersColumnsToAdd.push("reset_expires DATETIME NULL");
    }

    if (usersColumnsToAdd.length > 0) {
      await pool.request().query(`
        ALTER TABLE users 
        ADD ${usersColumnsToAdd.join(", ")};
      `);
    }
  } catch (err) {
    console.error("❌ Database migration failed:", err);
  }
}

module.exports = runMigrations;

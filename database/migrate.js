const fs = require("fs");
const path = require("path");
const { pool, poolConnect } = require("./data");
const sql = require("mssql");

async function runMigrations() {
  try {
    await poolConnect;
    
    // 1. Check & Add purchaseditems columns if they don't exist
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

    // 2. Check & Add users columns if they don't exist (reset_token, reset_expires, is_seed, reset_requested_at)
    const checkUsersColumns = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
      AND COLUMN_NAME IN ('reset_token', 'reset_expires', 'is_seed', 'reset_requested_at')
    `);

    const existingUsersColumns = checkUsersColumns.recordset.map(r => r.COLUMN_NAME.toLowerCase());
    const usersColumnsToAdd = [];

    if (!existingUsersColumns.includes("reset_token")) {
      usersColumnsToAdd.push("reset_token VARCHAR(255) NULL");
    }
    if (!existingUsersColumns.includes("reset_expires")) {
      usersColumnsToAdd.push("reset_expires DATETIME NULL");
    }
    if (!existingUsersColumns.includes("is_seed")) {
      usersColumnsToAdd.push("is_seed BIT DEFAULT 0");
    }
    if (!existingUsersColumns.includes("reset_requested_at")) {
      usersColumnsToAdd.push("reset_requested_at DATETIME NULL");
    }

    if (usersColumnsToAdd.length > 0) {
      await pool.request().query(`
        ALTER TABLE users 
        ADD ${usersColumnsToAdd.join(", ")};
      `);
      
      // Update existing users to have is_seed = 0 if is_seed column was just added
      if (usersColumnsToAdd.some(col => col.includes("is_seed"))) {
        await pool.request().query(`
          UPDATE users SET is_seed = 0 WHERE is_seed IS NULL;
        `);
      }
    }

    // 4. Check & Add email_tokens columns if they don't exist
    const checkTokenColumns = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'email_tokens' 
      AND COLUMN_NAME = 'created_at'
    `);

    if (checkTokenColumns.recordset.length === 0) {
      await pool.request().query(`
        ALTER TABLE email_tokens 
        ADD created_at DATETIME NULL;
      `);
    }

    // 3. Seeding reviews is removed to speed up server startup.


  } catch (err) {
    console.error("❌ Database migration failed:", err);
  }
}

module.exports = runMigrations;

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  // Use DATABASE_URL for Neon / Vercel
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = {
  // Utility for manual transactions
  getConnection: async () => {
    return await pool.connect();
  },
  
  // Wrapper to simulate the old response format [rows, result] 
  query: async (sql, binds = []) => {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(sql, binds);
      return [result.rows, result];
    } catch (err) {
      throw err;
    } finally {
      if (client) {
        client.release();
      }
    }
  }
};

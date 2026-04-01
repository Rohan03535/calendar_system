const oracledb = require('oracledb');
require('dotenv').config();

// Auto-commit configuration
oracledb.autoCommit = true;

async function initPool() {
    try {
        await oracledb.createPool({
            user: process.env.DB_USER || 'system',
            password: process.env.DB_PASSWORD || 'oracle',
            connectString: process.env.DB_CONNECT_STRING || 'localhost:1521/XE' 
        });
        console.log("Oracle DB Pool initialized successfully");
    } catch (err) {
        console.error("Oracle DB init error: ", err.message);
    }
}

initPool();

module.exports = {
    // Utility for manual transactions
    getConnection: async () => {
        return await oracledb.getConnection();
    },
    
    // Wrapper to simulate mysql2's pool.query and map uppercase Oracle columns to lowercase for the frontend
    query: async (sql, binds = [], options = {}) => {
        let connection;
        try {
            connection = await oracledb.getConnection();
            const result = await connection.execute(sql, binds, { 
                outFormat: oracledb.OUT_FORMAT_OBJECT, 
                ...options 
            });
            
            // Map uppercase Oracle keys to lowercase to maintain frontend compatibility
            const rows = (result.rows || []).map(row => {
                const lowerRow = {};
                for (const key in row) {
                    lowerRow[key.toLowerCase()] = row[key];
                }
                return lowerRow;
            });
            
            return [rows, result];
        } catch (err) {
            throw err;
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error("Error closing connection", err);
                }
            }
        }
    }
};

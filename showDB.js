const oracledb = require('oracledb');
require('dotenv').config();

async function showDb() {
    let conn;
    try {
        conn = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECT_STRING
        });
        
        const tables = ['USERS', 'EVENTS', 'EVENT_PARTICIPANTS', 'EVENT_INSTANCES', 'NOTIFICATIONS'];
        const dbDump = {};
        
        for(let table of tables) {
            const res = await conn.execute(`SELECT * FROM ${table}`, [], {outFormat: oracledb.OUT_FORMAT_OBJECT});
            dbDump[table] = res.rows;
        }
        
        console.log(JSON.stringify(dbDump, null, 2));
    } catch (err) {
        console.error("Error fetching DB log: ", err);
    } finally {
        if(conn) await conn.close();
    }
}
showDb();

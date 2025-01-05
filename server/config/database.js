import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { decrypt } from '../utils/encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let connection = null;

export async function initializeDatabase(config) {
  try {
    const tempConnection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password
    });

    const createDbQuery = `CREATE DATABASE IF NOT EXISTS \`${config.database}\``;
    await tempConnection.query(createDbQuery);
    await tempConnection.end();

    const pool = await mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true
    });

    const [rows] = await pool.query('SELECT 1');
    connection = pool;
    return connection;
  } catch (error) {
    throw new Error(`Database initialization failed: ${error.message}`);
  }
}

export async function getConnection() {
  if (!connection) {
    try {
      const configPath = join(__dirname, '../../.env.encrypted');
      const encryptedConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      const dbConfig = encryptedConfig.database;
      
      const config = {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: await decrypt(dbConfig.password),
        database: dbConfig.name
      };

      connection = await mysql.createPool({
        ...config,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
    } catch (error) {
      throw new Error(`Failed to initialize database connection: ${error.message}`);
    }
  }
  return connection;
}

export async function createTables() {
  try {
    const conn = await getConnection();
    const sqlPath = join(__dirname, './migrations/STRUCTURE_LLMEVAL.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf-8');
    
    const statements = sqlContent
      .replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '')
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);

    for (const statement of statements) {
      try {
        if (statement.length > 0) {
          await conn.query(statement);
        }
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
  } catch (error) {
    throw error;
  }
}

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

    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS ${config.database}`);
    await tempConnection.end();

    const pool = await mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    connection = pool;

    const configPath = join(__dirname, '../../.env');
    const envContent = Object.entries(config)
      .map(([key, value]) => `DB_${key.toUpperCase()}=${value}`)
      .join('\n');

    await fs.writeFile(configPath, envContent);

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
  const conn = await getConnection();
  
  const sqlPath = join(__dirname, './migrations/STRUCTURE_LLMEVAL.sql');
  const sqlContent = await fs.readFile(sqlPath, 'utf-8');
  
  const statements = sqlContent
    .split(';')
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0 && !statement.startsWith('--'));

  for (const statement of statements) {
    try {
      await conn.query(statement);
    } catch (error) {
      console.error(`Error executing SQL statement: ${error.message}`);
      console.error('Statement:', statement);
      throw error;
    }
  }
}

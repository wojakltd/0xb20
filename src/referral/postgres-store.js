let sqlClient = null;
let schemaReady = false;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

function isEnabled() {
  return Boolean(databaseUrl());
}

function getSql() {
  if (!isEnabled()) {
    throw new Error('Postgres database URL missing.');
  }

  if (!sqlClient) {
    try {
      const { neon } = require('@neondatabase/serverless');
      sqlClient = neon(databaseUrl());
    } catch (error) {
      throw new Error('Neon database driver unavailable.');
    }
  }

  return sqlClient;
}

async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS referral_records (
      record_key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  schemaReady = true;
}

function parseStoredValue(value, fallback) {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  return value;
}

async function getJson(recordKey, fallback) {
  await ensureSchema();

  const sql = getSql();
  const rows = await sql`
    SELECT value
    FROM referral_records
    WHERE record_key = ${recordKey}
    LIMIT 1
  `;

  return rows[0] ? parseStoredValue(rows[0].value, fallback) : fallback;
}

async function setJson(recordKey, value) {
  await ensureSchema();

  const sql = getSql();
  const serialized = JSON.stringify(value);

  await sql`
    INSERT INTO referral_records (record_key, value, updated_at)
    VALUES (${recordKey}, ${serialized}::jsonb, NOW())
    ON CONFLICT (record_key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;

  return value;
}

function providerInfo() {
  return {
    provider: 'Neon Postgres',
    persistent: true
  };
}

module.exports = {
  isEnabled,
  getJson,
  setJson,
  providerInfo
};

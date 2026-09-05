export const APP_VERSION = '5.0.0-alpha.9';
export const BACKUP_SCHEMA_VERSION = 6;
export const INDEXED_DB_VERSION = 5;
export const VIX_DATA_FORMAT_VERSION = 2;
export const NAVIGATION_MODEL = 'single-slot-vix-v1';

// Seed revision remains owned by the database migration layer: activating a
// seed is a data decision, not merely a presentation version change.
export const GENERATION = Object.freeze({
  app: APP_VERSION,
  schema: BACKUP_SCHEMA_VERSION,
  database: INDEXED_DB_VERSION,
  exchange: VIX_DATA_FORMAT_VERSION,
  navigation: NAVIGATION_MODEL,
});

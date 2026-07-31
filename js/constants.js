export const APP_VERSION = '2.2.1';
export const DB_NAME = 'gual-vocabulary-index';
export const DB_VERSION = 1;
export const HISTORY_LIMIT = 100;
export const HISTORY_SIZE_LIMIT = 30 * 1024 * 1024;
export const UI_STATE_VERSION = 4;
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
export const GROQ_KEY_STORAGE = 'gualVocabulary.groqApiKey';
export const GROQ_MODEL_STORAGE = 'gualVocabulary.groqModel';
export const INSTANCE_CHANNEL_NAME = 'gual-vocabulary-index-state-v1';
export const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
export const POS_ORDER = [
  'n.', 'v.', 'adj.', 'adv.', 'prep.', 'pron.', 'conj.', 'det.', 'art.', 'num.',
  'exclam.', 'modal v.', 'auxiliary v.', 'infinitive marker'
];
export const AI_CHECK_BATCH_SIZE = 70;
export const MAX_IMPORT_BYTES = 64 * 1024 * 1024;
export const MAX_WORD_LENGTH = 160;
export const MAX_CATEGORY_NAME_LENGTH = 40;

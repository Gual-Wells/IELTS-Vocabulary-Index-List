export const APP_VERSION = '2.0.1';
export const DB_NAME = 'gual-vocabulary-index';
export const DB_VERSION = 1;
export const HISTORY_LIMIT = 100;
export const HISTORY_SIZE_LIMIT = 30 * 1024 * 1024;
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
export const GROQ_KEY_STORAGE = 'gualVocabulary.groqApiKey';
export const GROQ_MODEL_STORAGE = 'gualVocabulary.groqModel';
export const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
export const POS_ORDER = [
  'n.', 'v.', 'adj.', 'adv.', 'prep.', 'pron.', 'conj.', 'det.', 'art.', 'num.',
  'exclam.', 'modal v.', 'auxiliary v.', 'infinitive marker'
];
export const ENTRY_BATCH_SIZE = 240;
export const AI_CHECK_BATCH_SIZE = 70;

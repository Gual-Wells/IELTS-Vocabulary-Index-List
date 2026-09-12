const SPEECH_KEY_STORAGE = 'gualVocabulary.groqSpeechApiKey';
const SPEECH_MODEL = 'canopylabs/orpheus-v1-english';
const SPEECH_VOICE = 'hannah';
const SPEECH_ENDPOINT = 'https://api.groq.com/openai/v1/audio/speech';
const MODELS_ENDPOINT = 'https://api.groq.com/openai/v1/models';

export function getGroqSpeechApiKey() {
  return localStorage.getItem(SPEECH_KEY_STORAGE) || '';
}

export function saveGroqSpeechApiKey(value) {
  const key = String(value || '').trim();
  if (!key) throw new Error('语音 API Key 不能为空');
  localStorage.setItem(SPEECH_KEY_STORAGE, key);
}

export function deleteGroqSpeechApiKey() {
  localStorage.removeItem(SPEECH_KEY_STORAGE);
}

export async function validateGroqSpeechApiKey(value) {
  const key = String(value || '').trim();
  if (!key) throw new Error('语音 API Key 不能为空');
  const response = await fetch(MODELS_ENDPOINT, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`语音 API Key 无效（HTTP ${response.status}）`);
  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data.map((item) => item?.id).filter(Boolean) : [];
  if (!models.includes(SPEECH_MODEL)) throw new Error('当前 Groq 账户未返回 Orpheus English TTS 模型');
  return { ok: true, model: SPEECH_MODEL };
}

export async function requestGroqSpeech(text, { signal } = {}) {
  const key = getGroqSpeechApiKey();
  if (!key) throw Object.assign(new Error('未配置 Groq 语音 API Key'), { code: 'speech-unconfigured' });
  const input = String(text || '').trim().slice(0, 200);
  if (!input) throw new Error('没有可朗读内容');
  const response = await fetch(SPEECH_ENDPOINT, {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: SPEECH_MODEL, input, voice: SPEECH_VOICE, response_format: 'wav' }),
  });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.error?.message || ''; } catch {}
    throw new Error(detail || `Groq 语音生成失败（HTTP ${response.status}）`);
  }
  return response.arrayBuffer();
}

export function speakWithSystemTts(text, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance !== 'function') {
      reject(new Error('当前浏览器不支持系统语音')); return;
    }
    const utterance = new SpeechSynthesisUtterance(String(text || ''));
    utterance.lang = 'en-US';
    utterance.rate = 0.92;
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => /^en-US$/i.test(voice.lang) && /Siri|Samantha|Ava|Allison|Susan/i.test(voice.name))
      || voices.find((voice) => /^en-US$/i.test(voice.lang))
      || voices.find((voice) => /^en/i.test(voice.lang)) || null;
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(event?.error === 'canceled' ? '语音已取消' : '系统语音播放失败'));
    const abort = () => { speechSynthesis.cancel(); reject(Object.assign(new Error('语音已取消'), { name: 'AbortError' })); };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });
}

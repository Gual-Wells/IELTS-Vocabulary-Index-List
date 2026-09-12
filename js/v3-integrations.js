// @ts-check
export const OXFORD_LOOKUP_SCHEME = 'hk-com-oupc-oecd-lookup://x-callback-url/s';

function clean(value) { return String(value ?? '').trim(); }

export function buildOxfordLookupUrl(text) {
  const query = clean(text);
  if (!query) throw new Error('没有可查询的英文');
  return `${OXFORD_LOOKUP_SCHEME}?q=${encodeURIComponent(query)}`;
}

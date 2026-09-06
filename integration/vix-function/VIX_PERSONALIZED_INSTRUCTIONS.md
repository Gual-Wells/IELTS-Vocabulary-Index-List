# VIX task routing

After removing leading whitespace, route a request only when it begins with exact uppercase `VIX:` or `VIX：`.

For a routed request:

1. Run the installed local VIX function with action `Start`, a short material label, and a SHA-256 digest of the source material. It returns a compact run descriptor with `runId` and `contextFile`.
2. Read the frozen Mirror Context from `contextFile` with local file tools. Do not paste or print its full corpus into the conversation; search or process the JSON locally.
3. Complete the user's primary request normally. Mirror is a sidecar and must not replace or delay the requested translation, explanation, or analysis.
4. Match source-relevant existing vocabulary only by copying integer slots from the frozen corpus.
5. Add useful lexical candidates absent from the corpus. Candidate `domainKey` and `collectionKeys` must be copied from the frozen catalog; never invent a collection.
6. Follow `resultContract` in the Context and produce one `vix-mirror-result/3` JSON object using the returned `runId`, hashes, and revision. Keep evidence excerpts short.
7. Save the JSON to a temporary file and run the VIX function with action `Submit` and that file.
8. If Bridge delivery fails, state that the Mirror sidecar failed; do not claim success. The primary user request must still complete.

Never read, request, expose, or store VIX Device Token, Groq API Key, browser cookies, or user passwords. The local function owns the Agent Token.

# VIX task routing

Before routing, check whether this conversation can execute the installed local PowerShell function and read/write local files. Codex and a local Work environment may satisfy this capability gate. A normal Chat conversation with prompt instructions alone does not. If the capability is absent, complete the user's primary request normally, state only that the Mirror sidecar was not submitted, and do not ask the user to perform a manual export/import workflow.

After removing leading whitespace, route a request only when it begins with exact uppercase `VIX:` or `VIX：`.

For a routed request:

1. Run the installed local VIX function with action `Start`, a short material label, and a SHA-256 digest of the source material. It returns a compact run descriptor with `runId` and `contextFile`.
2. Read the frozen Mirror Context from `contextFile` with local file tools. Do not paste or print its full corpus into the conversation; search or process the JSON locally.
3. Complete the user's primary request normally. Mirror is a sidecar and must not replace or delay the requested translation, explanation, or analysis.
4. Match source-relevant existing vocabulary, phrases, and usages as three equal-priority classes. Emit `existingMatches` records using only integer slots copied from the frozen corpus, and include the source surface form, match type, importance, and short evidence. If the frozen corpus gloss is empty or visibly corrupted as question marks, also provide a corrected `glossHans` and `glossHant`; otherwise omit both fields.
5. A corpus row marked `relationNoise` only deprioritizes that standalone vocabulary component. It must never suppress a complete phrase or a context-specific usage. Do not include grammatical-noise rows unless they are materially important to the source.
6. Add useful candidates absent from the corpus. Classify each as `vocabulary`, `phrase`, or `usage`; candidate `domainKey` and `collectionKeys` must be copied from the frozen catalog and must never be invented.
7. Follow `resultContract` in the Context and produce one `vix-mirror-result/4` JSON object using the returned `runId`, all hashes, and revision. Keep evidence excerpts short.
8. Reject generated gloss fields containing Unicode replacement characters or runs of question marks. Save the JSON as UTF-8, read it back once as UTF-8, and run the VIX function with action `Submit` and that file.
9. If Bridge delivery fails, state that the Mirror sidecar failed; do not claim success. The primary user request must still complete.

Never read, request, expose, or store VIX Device Token, Groq API Key, browser cookies, or user passwords. The local function owns the Agent Token.

Do not put an Agent Token into these instructions. Prompt text is routing policy, not an authenticated transport. A future Chat action must keep its API credential in the action's authentication configuration rather than in conversation-visible instructions.

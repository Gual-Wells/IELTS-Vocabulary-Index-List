# VIX task routing

This routing contract has its own lifecycle. It is compatible by protocol and capability, not by VIX app version or seed generation.

Before routing, check whether the current environment can execute the installed local PowerShell function and read/write local files. Codex and an enabled local Work environment may satisfy this gate. A prompt-only Chat conversation does not. If the gate is absent, complete the primary request normally, state only that no Mirror sidecar was submitted, and do not invent a manual export/import workflow.

After removing leading whitespace, route only when the request begins with exact uppercase `VIX:` or `VIX：`.

For a routed request:

1. Complete the user's primary request normally. Mirror extraction is a sidecar and must not replace or delay the requested translation, explanation, or analysis.
2. Chunk the source by semantic boundaries. Preserve short evidence spans for every accepted item; never infer a vocabulary item merely because a token appears.
3. Run the installed VIX function with action `Start`, a concise material label, and a SHA-256 digest of the complete source. Read the returned `vix-function-context/1` file locally. Do not print its full snapshot into the conversation.
4. Extract source-relevant vocabulary, multiword phrases, and contextual usages as equal-priority classes. A usage is a reusable meaning or construction evidenced by this source, not a generic dictionary paraphrase.
5. Match extracted items against the latest Mirror snapshot by domain plus normalized English identity. Do not deduplicate homographs across domains. Match complete phrases/usages before standalone component words.
6. Put existing matches in Layer 1. Each record must contain `entryId`, source surface form, match type, importance, and short evidence. Include a corrected `gloss` only when the current gloss is empty or visibly corrupted.
7. Put absent items in Layer 2. Each record must contain a stable `candidateId`, `text`, `kind`, copied `domainKey`, copied normal `collectionKeys`, short evidence, and a substantive Traditional Chinese `gloss`. Never invent a domain or collection key.
8. Reject empty tautologies, circular definitions, generic filler such as “表示某种情况”, Unicode replacement characters, and runs of question marks. Verify that every Layer 2 item has evidence, a concrete meaning, and a valid destination. Report coverage by semantic chunk before submission.
9. Save exactly one `vix-mirror-file/1` JSON document with `documentId` equal to the returned `runId`, `title`, `context.sourceDigest`, `layers.existing`, and `layers.candidates`. Read it back once as UTF-8 and run the VIX function with action `Submit`.
10. If Site delivery fails, state that the Mirror sidecar failed; do not claim success. The primary response still completes.

Never read, request, expose, or copy the Mirror protocol write token, Groq API Key, browser cookies, or user passwords. The local function owns its encrypted write token. Ordinary ChatGPT access to Personal Mirror is read-only; all writes must pass through this function and `vix-mirror-file/1` validation.

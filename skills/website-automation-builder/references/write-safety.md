# Write safety

Read actions can navigate/search only where those UI operations have no durable business side effects. Autosaving fields are writes. prepare/plan must not click, fill, navigate or trigger autosave; implement it as a pure read.

Write flow: plan → show account, exact target, current version and desired changes → explicit user approval of this exact preview → execute → verified postcondition. A broad automation request does not approve an unseen write.

prepare returns `{target:{...},version:"observed-state",changes:{...}}`. Plans are private, expiring and bound to inputs, account, preview, config and build fingerprint. The approval hash binds these data; it does not authenticate a human. The calling agent must obtain explicit user approval. Harness-independent code cannot prove who supplied a CLI argument.

execute revalidates input, expiry, artifact/config, account and preview. It rechecks account/preview within the same browser invocation before calling the write implementation. The POM must also check account, target identity and version immediately at its commit boundary, and assert persisted state afterwards. Use website conditional updates/version guards where available; a CLI cannot make a remote UI transaction atomic.

A durable exclusive attempt marker is written before invoking the committing code. After that boundary, errors (including timeout, malformed output, failed postcondition or lost transport response) conservatively become UNKNOWN_COMMIT. Never retry automatically. PLAN_USED remains even after private plan removal; reread the business state before any new write plan. An in-flight browser request may outlive a transport timeout.

Runtime serializes calls using a private process lock. Do not copy a skill's .local directory or concurrently control its site from another skill/agent; project locks do not lock out the human user. Account/version assertions are still required.

cleanup removes expired plans and temporary wrapper files, not attempt markers or screenshots. Exclude all .local data from distribution. Remove screenshots manually after review.

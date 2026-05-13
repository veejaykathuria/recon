# Workflow: fallback_to_sonnet

## Objective
If the build is running on Kimchi via Claude Code and we approach 90% of usage limits, switch the Claude Code session over to a paid Sonnet model to finish the demo without dying mid-sentence.

## Trigger
- `/status` in Claude Code shows context usage / request usage ≥ 90% of the Kimchi quota
- OR demo-time minus current time ≤ 20 min AND any flakiness observed in Kimchi responses

## Steps
1. Save current work: `git add -A && git commit -m "WIP: pre-fallback"`.
2. In Claude Code, `/model claude-sonnet-4-6` (or whichever Sonnet variant is live).
3. Confirm via `/status` — model should now read `claude-sonnet-*`.
4. Continue the build. Runtime calls in the deployed app are still on Kimchi — do not touch `KIMCHI_*` env vars.
5. After demo, switch back if desired: `/model` cycles back to the kimchi-routed default.

## Rules
- **Never switch before 90%.** The whole point is to maximize free credits.
- **Runtime stays on Kimchi.** Only the build-time agent switches. The deployed app still demonstrates Kimchi in production.
- **Note the switch in PROJECT.md** so judges asking about Kimchi see honesty: "build switched to Sonnet at HH:MM, runtime remained on Kimchi."

## Status
- [ ] Not yet triggered

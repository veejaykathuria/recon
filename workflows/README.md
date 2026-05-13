# Workflows

SOPs the orchestrator follows. Each one names its inputs, the tools it uses, and how QA verifies the output.

| Workflow | Purpose | Primary agent |
|---|---|---|
| [setup_env.md](setup_env.md) | Local + cloud env ready | Backend |
| [analyze_repo.md](analyze_repo.md) | Clone → parse → cluster → push graph | Backend |
| [ask_question.md](ask_question.md) | NL → Cypher → answer | Backend |
| [qa_verify.md](qa_verify.md) | Gate before push/deploy | QA |
| [deploy_vercel.md](deploy_vercel.md) | Ship to public URL | Backend (with QA sign-off) |
| [fallback_to_sonnet.md](fallback_to_sonnet.md) | Kimchi 90% → Sonnet swap | Orchestrator |

# Huy Locket — Agent instructions

## Branding

- **App display name:** Huy Locket (not "Locket Dio" in UI)
- Repo folder / GitHub may still be `locket-dio`; service Docker name: **huy-locket**

## Production deploy target (user request 2026-07-10)

Service name: **huy-locket**  
Runtime: **Docker** · Region: **Singapore**  
Repo: `https://github.com/buiduchuy2010qn-prog/locket-dio.git`  
Branch: **`main`**

### Auto-update rule (mandatory)

Whenever you change code in this project for the user:

1. Finish the feature/fix and verify locally if practical.
2. **Commit** with a clear message (complete sentences).
3. **`git push origin main`** so the **huy-locket** Docker service rebuilds/redeploys.
4. Tell the user the commit hash and that deploy to **huy-locket** was triggered (or report push/deploy errors).

Do **not** leave production-bound changes only on the local machine.

### If push fails

- Do not force-push unless the user explicitly asks.
- Report auth/remote errors and ask the user to re-auth GitHub or check that **huy-locket** is still linked to this repo for auto-deploy from `main`.

### Related (secondary)

- Render static blueprint: see `DEPLOY.txt` / `render.yaml` (`locket-dio-ly9t.onrender.com`) — only use if the user asks for Render specifically.
- Primary live target the user cares about: **huy-locket** (Docker, Singapore).

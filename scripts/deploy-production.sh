
#!/usr/bin/env bash
set -Eeuo pipefail

# ==========================================
# PULSEWATCH PRODUCTION DEPLOYMENT
# ==========================================

APP_DIR="/home/devops_deploy_engineer/workspace/devops-practice"
BRANCH="main"
SERVICE="app"

PREVIOUS_IMAGE="pulsewatch:rollback"
CURRENT_IMAGE="pulsewatch:latest"

cd "$APP_DIR"

echo "=========================================="
echo " PULSEWATCH PRODUCTION DEPLOYMENT"
echo "=========================================="

# ==========================================
# 1. PRE-DEPLOYMENT SAFETY CHECKS
# ==========================================

echo "===== PRE-DEPLOYMENT CHECK ====="

CURRENT_BRANCH=$(git branch --show-current)

if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
    echo "ERROR: Expected branch '$BRANCH', found '$CURRENT_BRANCH'."
    exit 1
fi

# Allow known EC2-specific configuration changes only.
UNEXPECTED_CHANGES=$(
    git diff --name-only |
    grep -Ev '^(Caddyfile|docker-compose\.yml)$' || true
)

if [[ -n "$UNEXPECTED_CHANGES" ]]; then
    echo "ERROR: Unexpected tracked-file changes:"
    echo "$UNEXPECTED_CHANGES"
    exit 1
fi

# Do not deploy if staged changes exist.
if ! git diff --cached --quiet; then
    echo "ERROR: Staged changes detected."
    exit 1
fi

# Allow only known production-specific untracked files.
UNEXPECTED_FILES=$(
    git ls-files --others --exclude-standard |
    grep -Ev '^(\.env|docker-compose\.yml\.backup)$' || true
)

if [[ -n "$UNEXPECTED_FILES" ]]; then
    echo "ERROR: Unexpected untracked files:"
    echo "$UNEXPECTED_FILES"
    exit 1
fi

# ==========================================
# 2. FETCH LATEST SOURCE CODE
# ==========================================

echo "===== FETCH LATEST CODE ====="

git fetch origin "$BRANCH"

# Do not automatically replace production configuration.
if ! git diff --quiet HEAD origin/main -- Caddyfile docker-compose.yml; then
    echo "ERROR: Incoming production configuration changes detected."
    echo "Review them manually before deployment."
    exit 1
fi

# ==========================================
# 3. UPDATE APPLICATION SOURCE
# ==========================================

echo "===== UPDATE APPLICATION SOURCE ====="

git merge --ff-only origin/main

# ==========================================
# 4. SAVE PREVIOUS DOCKER IMAGE
# ==========================================

echo "===== SAVE PREVIOUS IMAGE ====="

if ! docker image inspect "$CURRENT_IMAGE" >/dev/null 2>&1; then
    echo "ERROR: Current application image not found."
    exit 1
fi

docker tag "$CURRENT_IMAGE" "$PREVIOUS_IMAGE"

echo "Previous image saved as: $PREVIOUS_IMAGE"

# ==========================================
# 5. BUILD NEW APPLICATION IMAGE
# ==========================================

echo "===== BUILD NEW APPLICATION IMAGE ====="

if ! docker compose build "$SERVICE"; then
    echo "ERROR: Application image build failed."
    echo "Existing running application has not been redeployed."
    exit 1
fi

# ==========================================
# 6. DEPLOY APPLICATION ONLY
# ==========================================

echo "===== DEPLOY APPLICATION ONLY ====="

docker compose up -d --no-deps "$SERVICE"

# ==========================================
# 7. APPLICATION HEALTH CHECK FUNCTION
# ==========================================

wait_for_health() {
    local max_attempts="$1"

    for ((attempt=1; attempt<=max_attempts; attempt++)); do

        local container_id
        container_id=$(docker compose ps -q "$SERVICE")

        if [[ -z "$container_id" ]]; then
            echo "Application container not found."
        else
            local status

            status=$(docker inspect \
                --format='{{.State.Health.Status}}' \
                "$container_id" 2>/dev/null || echo "missing")

            echo "Health status: $status (attempt $attempt/$max_attempts)"

            if [[ "$status" == "healthy" ]]; then
                return 0
            fi
        fi

        sleep 5
    done

    return 1
}

# ==========================================
# 8. VERIFY NEW DEPLOYMENT
# ==========================================

echo "===== VERIFY APPLICATION HEALTH ====="

if wait_for_health 18; then
    echo "=========================================="
    echo " DEPLOYMENT SUCCESSFUL"
    echo " Application is healthy."
    echo "=========================================="

    docker compose ps "$SERVICE"
    exit 0
fi

# ==========================================
# 9. AUTOMATIC ROLLBACK
# ==========================================

echo "ERROR: New deployment failed health checks."

echo "===== ROLLING BACK APPLICATION ====="

docker tag "$PREVIOUS_IMAGE" "$CURRENT_IMAGE"

docker compose up -d --no-deps "$SERVICE"

if wait_for_health 12; then
    echo "=========================================="
    echo " ROLLBACK SUCCESSFUL"
    echo " Previous application is healthy."
    echo "=========================================="

    docker compose ps "$SERVICE"
    exit 1
fi

# ==========================================
# 10. ROLLBACK FAILURE
# ==========================================

echo "=========================================="
echo " CRITICAL: ROLLBACK HEALTH CHECK FAILED"
echo " Manual investigation required."
echo "=========================================="

docker compose ps "$SERVICE"

exit 1

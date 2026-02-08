FROM oven/bun:1 AS base

# Install common CLI tools that may be needed at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    jq \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY src/ src/
COPY tsconfig.json ./

# Pre-add common install target directories to PATH
ENV PATH="/root/.local/bin:/root/.cargo/bin:/root/.bun/bin:/usr/local/go/bin:$PATH"

# Persistent data lives here -- mount a volume
ENV DATA_DIR=/data
VOLUME /data

CMD ["bun", "run", "src/cli.ts"]

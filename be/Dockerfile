FROM node:22

RUN curl -fsSL https://bun.sh/install | bash

ENV PATH="/root/.bun/bin:${PATH}"

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN bun install
COPY . .
EXPOSE 6969

# Start the application
CMD ["bun", "run", "index.ts"]

# BTB MCP server: the agent connector as a small standalone container.
# Build from the repo root:  docker build -f mcp-server/Dockerfile -t btb-mcp .
# Run:                       docker run -p 8080:8080 -e NEXT_PUBLIC_CONVEX_URL=... btb-mcp

FROM node:22-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts --network-timeout 600000
COPY tsconfig.json ./
COPY src ./src
COPY convex ./convex
COPY mcp-server ./mcp-server
# One file with everything except zod (its circular imports break when bundled) and the optional
# @x402 packages a dependency loads only on demand.
RUN node_modules/.bin/esbuild mcp-server/main.ts --bundle --platform=node --target=node22 --format=esm \
      --outfile=dist/mcp.mjs --tsconfig=tsconfig.json --external:zod --external:@x402/* \
      "--banner:js=import{createRequire as __cr}from'module';const require=__cr(import.meta.url);" \
      --log-level=warning

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/dist/mcp.mjs ./mcp.mjs
COPY --from=build /app/node_modules/zod ./node_modules/zod
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "mcp.mjs"]

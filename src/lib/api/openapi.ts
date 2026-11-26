import { ROUTES, listTools, type JsonSchema } from './v1';

// OpenAPI 3.1 for the REST API, built from the connector's own tool schemas so it never drifts from what runs.
// Agents and SDK generators read it at /api/v1/openapi.json.

const SERVER = 'https://btb.finance/api/v1';

const errorResponses = {
  400: { description: 'Bad arguments or the tool could not answer; `error.message` says why.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  401: { description: 'The API key is unknown or turned off.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  404: { description: 'Not found (pool, protocol, function).', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  429: { description: 'Rate limit reached. Wait until `X-RateLimit-Reset` (unix seconds), or use a key for a higher limit.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
};

const strip = (s: JsonSchema): JsonSchema => {
  const { $schema: _drop, ...rest } = s as JsonSchema & { $schema?: string };
  return rest;
};

export async function openApi() {
  const tools = await listTools();
  const byName = new Map(tools.map((t) => [t.name, t]));
  const paths: Record<string, Record<string, unknown>> = {};

  for (const r of ROUTES) {
    const tool = byName.get(r.tool);
    if (!tool) continue;
    const props = tool.inputSchema.properties ?? {};
    const required = new Set(tool.inputSchema.required ?? []);
    const pathParams = [...r.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const toArg = (n: string) => r.rename?.[n] ?? n;
    const fromArg = Object.fromEntries(Object.entries(r.rename ?? {}).map(([a, b]) => [b, a]));
    const parameters: unknown[] = pathParams.map((n) => ({
      name: n, in: 'path', required: true, schema: { type: 'string' }, description: props[toArg(n)]?.description,
    }));
    const rest = Object.entries(props).filter(([k]) => !pathParams.some((p) => toArg(p) === k) && !(r.fixed && k in r.fixed));
    const op: Record<string, unknown> = {
      operationId: `${r.tool}${pathParams.length ? '_by_path' : ''}${r.path === '/chains' ? '_all' : ''}`,
      summary: r.summary,
      description: tool.description,
      tags: [r.tag],
      responses: { 200: { description: 'The result, as JSON.', content: { 'application/json': { schema: { type: 'object' } } } }, ...errorResponses },
    };
    if (r.method === 'GET') {
      parameters.push(...rest.map(([k, s]) => ({
        name: fromArg[k] ?? k, in: 'query', required: required.has(k), description: s.description,
        schema: strip(s), ...(typesOf(s).includes('array') ? { style: 'form', explode: false } : {}),
      })));
    } else {
      op.requestBody = {
        required: true,
        content: { 'application/json': { schema: { type: 'object', properties: Object.fromEntries(rest.map(([k, s]) => [k, strip(s)])), required: rest.filter(([k]) => required.has(k)).map(([k]) => k) } } },
      };
    }
    op.parameters = parameters;
    (paths[r.path] ??= {})[r.method.toLowerCase()] = op;
  }

  // Every tool, by name, with its full input schema as the body: one call shape for everything.
  for (const t of tools) {
    paths[`/tools/${t.name}`] = {
      post: {
        operationId: t.name,
        summary: t.title ?? t.name,
        description: t.description,
        tags: ['Tools'],
        requestBody: { required: true, content: { 'application/json': { schema: strip(t.inputSchema) } } },
        responses: { 200: { description: 'The result, as JSON.', content: { 'application/json': { schema: { type: 'object' } } } }, ...errorResponses },
      },
    };
  }

  paths['/keys'] = {
    post: {
      operationId: 'create_api_key', tags: ['Keys'], summary: 'Get a free API key (120 calls a minute instead of 20). Shown once: store it.',
      security: [],
      requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string', description: 'Your app or agent.' }, contact: { type: 'string', description: 'Optional email or URL.' } } } } } },
      responses: { 201: { description: 'The new key.', content: { 'application/json': { schema: { type: 'object' } } } }, 429: errorResponses[429] },
    },
  };
  paths['/keys/me'] = {
    get: { operationId: 'api_key_usage', tags: ['Keys'], summary: 'Usage and limit of the key you send.', responses: { 200: { description: 'Key info.' }, 401: errorResponses[401] } },
  };

  return {
    openapi: '3.1.0',
    info: {
      title: 'BTB Finance API',
      version: '1.0.0',
      description: [
        'Live DeFi data and transaction building for agents and apps: liquidity pools with risk grades across many chains, token safety, wallet LP positions, a registry of 50 protocols with official contract addresses, any contract\'s ABI, reads, and unsigned transactions (swaps, LP deposits, any contract call) with dry runs.',
        'Nothing here signs or sends: build endpoints return unsigned transactions for your own wallet to sign. Not financial advice.',
        'No key needed for 20 calls a minute per IP. A free key (POST /keys) gives 120. Send it as `Authorization: Bearer <key>` or `X-API-Key`.',
        'The same tools are available over MCP at https://btb.finance/api/mcp.',
      ].join('\n\n'),
      contact: { url: 'https://btb.finance/agents/docs' },
    },
    servers: [{ url: SERVER }],
    security: [{}, { bearer: [] }, { apiKey: [] }],
    tags: [
      { name: 'Pools' }, { name: 'Tokens' }, { name: 'Wallets' }, { name: 'Protocols' }, { name: 'Contracts' }, { name: 'Build' },
      { name: 'Tools', description: 'Every connector tool by name: POST its arguments as JSON.' }, { name: 'Keys' },
    ],
    paths,
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer' },
        apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      schemas: {
        Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } }, required: ['code', 'message'] } } },
      },
    },
  };
}

function typesOf(s: JsonSchema | undefined): string[] {
  if (!s) return [];
  if (Array.isArray(s.type)) return s.type;
  if (s.type) return [s.type];
  return (s.anyOf ?? []).flatMap(typesOf);
}

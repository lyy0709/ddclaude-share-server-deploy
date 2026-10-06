import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { pipeline } from 'node:stream';

const domain = process.env.FRAME_PROXY_DOMAIN;
const parents = (process.env.FRAME_PARENT_ORIGINS || '').split(',').filter(Boolean);
if (!domain || !/^[a-z0-9.-]+$/.test(domain) || !parents.length ||
    parents.some(value => { const u = new URL(value); return u.protocol !== 'https:' || u.origin !== value; })) {
  throw new Error('Configure FRAME_PROXY_DOMAIN and exact HTTPS FRAME_PARENT_ORIGINS');
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const cookieName = /^__Host-frame-(?:asset|rt)-[A-Za-z0-9._-]+$/;
const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade']);
const requestHeaders = ['accept', 'accept-language',
  'range', 'if-range', 'if-none-match', 'if-modified-since', 'user-agent'];
const agent = new https.Agent({ keepAlive: true, maxSockets: 64, maxTotalSockets: 64, maxFreeSockets: 8 });
const maxHTML = 16 * 1024 * 1024;
let activeHTML = 0;

function csp(value) {
  const directives = (value || "default-src 'none'").split(';').map(s => s.trim()).filter(Boolean)
    .filter(s => !/^frame-ancestors(?:\s|$)/i.test(s));
  directives.push("frame-ancestors 'self' " + parents.join(' '));
  return directives.join('; ');
}

function destination(host) {
  host = (host || '').toLowerCase();
  if (!host.endsWith('.' + domain)) return null;
  const id = host.slice(0, -domain.length - 1);
  if (!uuid.test(id) && id !== 'fonts') return null;
  return id + '.frame.claudeusercontent.com';
}

function fail(res, status, message) {
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end(message);
}

function serve(req, res) {
  if (req.url === '/healthz' && req.headers.host === 'localhost') {
    res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok\n'); return;
  }
  const upstreamHost = destination(req.headers.host);
  if (!upstreamHost || !req.url?.startsWith('/') || req.url.startsWith('//')) {
    fail(res, 421, 'Unknown Frame host'); return;
  }
  // This service only transports Frame resources. Capabilities/writes remain
  // behind the owning application, and there is no arbitrary upstream URL.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS'); fail(res, 405, 'Read-only Frame proxy'); return;
  }
  const origin = req.headers.origin;
  const ownOrigin = 'https://' + req.headers.host;
  const originHost = origin?.startsWith('https://') ? origin.slice(8) : '';
  const fontConsumer = upstreamHost === 'fonts.frame.claudeusercontent.com' &&
    uuid.test(originHost.slice(0, -domain.length - 1)) && destination(originHost);
  const allowedOrigin = origin === ownOrigin || parents.includes(origin) || !!fontConsumer;
  if (origin && !allowedOrigin) { fail(res, 403, 'Origin not allowed'); return; }
  if (req.method === 'OPTIONS') {
    if (!allowedOrigin) { fail(res, 403, 'Origin required'); return; }
    res.writeHead(204, { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, HEAD, OPTIONS', 'access-control-allow-headers': 'Range',
      'vary': 'Origin', 'cache-control': 'no-store' }); res.end(); return;
  }
  const headers = { host: upstreamHost, 'accept-encoding': 'identity' };
  for (const name of requestHeaders) if (req.headers[name]) headers[name] = req.headers[name];
  const cookies = (req.headers.cookie || '').split(';').map(s => s.trim())
    .filter(s => cookieName.test(s.split('=', 1)[0]));
  if (cookies.length) headers.cookie = cookies.join('; ');
  if (origin) headers.origin = origin === ownOrigin ? 'https://' + upstreamHost : 'https://claude.ai';
  // No site sessionKey, Authorization, or unrelated Cookie can reach upstream.
  const upstream = https.request({ hostname: upstreamHost, servername: upstreamHost, port: 443,
    path: req.url, method: req.method, headers, agent, timeout: 90000 }, response => {
    const outgoing = {};
    for (const [name, value] of Object.entries(response.headers)) {
      if (hopHeaders.has(name) || ['set-cookie', 'content-security-policy', 'content-security-policy-report-only',
        'x-frame-options', 'access-control-allow-origin', 'access-control-allow-credentials',
        'report-to', 'nel', 'alt-svc'].includes(name)) continue;
      outgoing[name] = value;
    }
    outgoing['content-security-policy'] = csp(response.headers['content-security-policy']);
    outgoing['cache-control'] = 'private, no-store';
    outgoing['referrer-policy'] = 'no-referrer';
    outgoing['x-content-type-options'] = 'nosniff';
    const setCookies = (response.headers['set-cookie'] || []).filter(s => cookieName.test(s.split('=', 1)[0]));
    if (setCookies.length) outgoing['set-cookie'] = setCookies;
    if (allowedOrigin) {
      outgoing['access-control-allow-origin'] = origin;
      outgoing['access-control-allow-credentials'] = 'true';
      outgoing.vary = [outgoing.vary, 'Origin'].filter(Boolean).join(', ');
    }
    if (outgoing.location) {
      let location;
      try { location = new URL(outgoing.location, 'https://' + upstreamHost); }
      catch { response.destroy(); fail(res, 502, 'Invalid Frame redirect'); return; }
      if (location.protocol !== 'https:' || location.hostname !== upstreamHost) {
        response.destroy(); fail(res, 502, 'Unexpected Frame redirect'); return;
      }
      outgoing.location = ownOrigin + location.pathname + location.search + location.hash;
    }
    const isHTML = /^text\/html\b/i.test(response.headers['content-type'] || '') && req.method !== 'HEAD';
    if (!isHTML) {
      res.writeHead(response.statusCode, outgoing);
      pipeline(response, res, () => {}); return;
    }
    // The native runtime reads its allowed parent origins from the preamble.
    // Update that protocol field, not minified runtime symbols or user code.
    if (activeHTML >= 2) { response.destroy(); fail(res, 503, 'Frame transport busy'); return; }
    activeHTML++;
    const chunks = []; let bytes = 0;
    response.once('close', () => { activeHTML--; chunks.length = 0; });
    response.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxHTML) { response.destroy(); fail(res, 502, 'Frame HTML exceeds transport limit'); return; }
      chunks.push(chunk);
    });
    response.on('error', () => fail(res, 502, 'Frame response interrupted'));
    response.on('end', () => {
      if (res.destroyed || res.writableEnded) return;
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        fail(res, 502, 'Unexpected compressed Frame HTML'); return;
      }
      let body = Buffer.concat(chunks).toString('utf8');
      chunks.length = 0;
      try {
        body = body.replace(/(window\.__FRAME_PREAMBLE\s*=\s*)(\{[^<]*?\})(\s*<\/script>)/,
          (match, prefix, json, suffix) => {
            const preamble = JSON.parse(json); preamble.origins = parents;
            return prefix + JSON.stringify(preamble).replaceAll('<', '\\u003c') + suffix;
          });
      } catch { fail(res, 502, 'Invalid Frame runtime preamble'); return; }
      // Error documents also use the upstream frame-ancestors policy; do not
      // translate their status to success or store authorization error bodies.
      const data = Buffer.from(body);
      delete outgoing['content-encoding']; delete outgoing.etag; delete outgoing['last-modified'];
      outgoing['content-length'] = data.length;
      res.writeHead(response.statusCode, outgoing); res.end(data);
    });
    res.once('close', () => { if (!res.writableFinished) response.destroy(); });
  });
  upstream.on('timeout', () => upstream.destroy(new Error('timeout')));
  upstream.on('error', () => fail(res, 502, 'Frame upstream unavailable'));
  req.on('aborted', () => upstream.destroy());
  res.once('close', () => { if (!res.writableFinished) upstream.destroy(); });
  upstream.end();
}

http.createServer(serve).listen(8080, '0.0.0.0');
let tls;
function certificates() { return { cert: readFileSync(process.env.TLS_CERT), key: readFileSync(process.env.TLS_KEY) }; }
if (process.env.TLS_CERT && process.env.TLS_KEY) {
  tls = https.createServer(certificates(), serve).listen(8443, '0.0.0.0');
  process.on('SIGHUP', () => {
    try { tls.setSecureContext(certificates()); console.log('TLS certificate reloaded'); }
    catch { console.error('TLS reload failed; keeping current certificate'); }
  });
}
console.log(JSON.stringify({ service: 'claude-frame-proxy', domain, parents, tls: !!tls }));

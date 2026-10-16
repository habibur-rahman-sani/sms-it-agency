// 'use strict';
// // SMS IT Agency — Vercel ভার্সন: ডেটা Upstash Redis-এ, ছবি/ভিডিও Cloudinary-তে
// const crypto = require('crypto'), fs = require('fs'), path = require('path');
// const PASS = process.env.ADMIN_PASSWORD || '';
// const SECRET = process.env.SECRET || crypto.createHash('sha256').update('sms-' + PASS).digest('hex');
// const R_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
// const R_TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
// const CLD = { name: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };
// const COLS = ['settings', 'sections', 'items', 'pages', 'orders'];

// /* ---------- Upstash Redis (REST) ---------- */
// async function redis(cmds) {
//   if (!R_URL || !R_TOK) throw err(503, 'সার্ভারে Upstash Redis সেট করা হয়নি');
//   const r = await fetch(R_URL + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + R_TOK, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
//   const j = await r.json();
//   if (!r.ok) throw err(500, 'ডেটাবেস সমস্যা');
//   return j.map(x => { if (x.error) throw err(500, 'ডেটাবেস সমস্যা'); return x.result; });
// }
// async function load() {
//   const vals = await redis(COLS.map(c => ['GET', 'sms:' + c]));
//   let db = {};
//   COLS.forEach((c, i) => { if (vals[i] != null) db[c] = JSON.parse(vals[i]); });
//   if (!db.settings) { // প্রথমবার: seed.json থেকে ভরা হবে
//     db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed.json'), 'utf8'));
//     COLS.forEach(c => db[c] = db[c] || (c === 'settings' ? {} : []));
//     await save(db, COLS);
//   }
//   COLS.forEach(c => db[c] = db[c] || (c === 'settings' ? {} : []));
//   return db;
// }
// const save = (db, cols) => redis(cols.map(c => ['SET', 'sms:' + c, JSON.stringify(db[c])]));

// /* ---------- হেল্পার ---------- */
// const F = {
//   sections: 'title desc icon message orderable order enabled'.split(' '),
//   items: 'section type title desc src poster alt w h featured facts order enabled'.split(' '),
//   pages: 'slug title content inNav order enabled'.split(' ')
// };
// const SET_F = 'name slogan logo heroImage heroTitle heroLead aboutText whatsappNumber messengerUrl facebookPageUrl email youtube instagram tiktok defaultMessage'.split(' ');
// const err = (status, message) => Object.assign(new Error(message), { status });
// const id = () => crypto.randomBytes(5).toString('hex');
// function pick(o, keys) {
//   const r = {};
//   for (const k of keys) {
//     if (!(k in o)) continue;
//     let v = o[k];
//     if (typeof v === 'string') v = v.slice(0, 20000);
//     else if (Array.isArray(v)) v = v.slice(0, 8).map(x => ({ v: String((x && x.v) || '').slice(0, 80), l: String((x && x.l) || '').slice(0, 120) }));
//     else if (typeof v !== 'boolean' && typeof v !== 'number') continue;
//     r[k] = v;
//   }
//   if (r.slug) r.slug = r.slug.trim().replace(/[\s\/#?%]+/g, '-');
//   return r;
// }
// const sign = e => crypto.createHmac('sha256', SECRET).update(String(e)).digest('hex');
// const mint = () => { const e = Date.now() + 7 * 864e5; return e + '.' + sign(e); };
// function auth(req) {
//   const [e, s] = (req.headers.authorization || '').replace(/^Bearer /, '').split('.');
//   if (!PASS || !e || !s || +e < Date.now()) throw err(401, 'লগইন করুন');
//   const a = Buffer.from(s), b = Buffer.from(sign(e));
//   if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw err(401, 'লগইন করুন');
// }
// // রেট লিমিট (ইন-মেমোরি; সার্ভারলেসে সীমিত সুরক্ষা)
// const hits = new Map();
// function limit(key, max, ms) {
//   const n = Date.now(), h = (hits.get(key) || []).filter(t => n - t < ms);
//   if (h.length >= max) throw err(429, 'অনেকবার চেষ্টা হয়েছে, একটু পরে আবার করুন');
//   h.push(n); hits.set(key, h);
// }
// const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
// function send(res, code, obj) {
//   res.statusCode = code;
//   res.setHeader('Content-Type', 'application/json; charset=utf-8');
//   res.setHeader('Cache-Control', 'no-store');
//   res.end(JSON.stringify(obj));
// }
// async function body(req, max = 4e6) {
//   if (req.body !== undefined && req.body !== null && req.body !== '') {
//     if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
//     try { return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body); } catch { throw err(400, 'ভুল ডেটা'); }
//   }
//   const c = []; let n = 0;
//   for await (const d of req) { n += d.length; if (n > max) throw err(413, 'ডেটা অনেক বড়'); c.push(d); }
//   try { return c.length ? JSON.parse(Buffer.concat(c).toString('utf8')) : {}; } catch { throw err(400, 'ভুল ডেটা'); }
// }
// const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
// function publicData(db) {
//   const on = x => x.enabled !== false, s = db.settings;
//   return {
//     settings: { ...s, social: { youtube: s.youtube || '', instagram: s.instagram || '', tiktok: s.tiktok || '' } },
//     sections: db.sections.filter(on).sort(byOrder),
//     items: db.items.filter(on).sort(byOrder),
//     pages: db.pages.filter(on).sort(byOrder)
//   };
// }

// /* ---------- Cloudinary সাইন (ব্রাউজার থেকে সরাসরি আপলোডের জন্য) ---------- */
// function cloudSign(u) {
//   if (!CLD.name || !CLD.key || !CLD.secret) throw err(503, 'সার্ভারে Cloudinary সেট করা হয়নি');
//   const type = u.searchParams.get('type') === 'video' ? 'video' : 'image';
//   const timestamp = Math.floor(Date.now() / 1000), folder = 'sms-it-agency';
//   const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${CLD.secret}`).digest('hex');
//   return { url: `https://api.cloudinary.com/v1_1/${CLD.name}/${type}/upload`, apiKey: CLD.key, timestamp, folder, signature };
// }

// /* ---------- API ---------- */
// async function api(req, res) {
//   const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname).replace(/\/+$/, '');
//   const m = req.method, seg = p.split('/').filter(Boolean);

//   if (p === '/api/site' && m === 'GET') {
//     const out = publicData(await load());
//     res.setHeader('Cache-Control', 'no-store');
//     return send(res, 200, out);
//   }
//   if (p === '/api/orders' && m === 'POST') {
//     limit('o' + ipOf(req), 8, 36e5);
//     const b = await body(req, 2e4), t = (v, n) => String(v || '').trim().slice(0, n);
//     if (b.website) return send(res, 200, { ok: true });
//     const o = { id: id(), createdAt: new Date().toISOString(), name: t(b.name, 100), phone: t(b.phone, 30), email: t(b.email, 120), section: t(b.section, 40), message: t(b.message, 2000), status: 'new', note: '' };
//     if (!o.name || o.phone.replace(/\D/g, '').length < 6) throw err(400, 'নাম ও সঠিক ফোন নম্বর দিন');
//     const db = await load();
//     const sec = db.sections.find(s => s.id === o.section);
//     o.service = sec ? sec.title : 'অন্যান্য';
//     db.orders.unshift(o); db.orders = db.orders.slice(0, 2000);
//     await save(db, ['orders']);
//     return send(res, 200, { ok: true });
//   }
//   if (p === '/api/login' && m === 'POST') {
//     limit('l' + ipOf(req), 10, 9e5);
//     if (!PASS) throw err(503, 'সার্ভারে ADMIN_PASSWORD সেট করা হয়নি');
//     const b = await body(req, 2e3), h = x => crypto.createHash('sha256').update(String(x || '')).digest();
//     if (!crypto.timingSafeEqual(h(b.password), h(PASS))) throw err(401, 'পাসওয়ার্ড ভুল');
//     return send(res, 200, { token: mint() });
//   }

//   if (seg[1] !== 'admin') throw err(404, 'পাওয়া যায়নি');
//   auth(req);
//   if (p === '/api/admin/sign-upload' && m === 'GET') return send(res, 200, cloudSign(u));

//   const db = await load();
//   if (p === '/api/admin/all' && m === 'GET') return send(res, 200, db);
//   if (p === '/api/admin/settings' && m === 'PUT') { Object.assign(db.settings, pick(await body(req), SET_F)); await save(db, ['settings']); return send(res, 200, db.settings); }
//   if (p === '/api/admin/import' && m === 'POST') {
//     const b = await body(req, 4e6);
//     if (!b.settings || !Array.isArray(b.sections) || !Array.isArray(b.items)) throw err(400, 'এটি সঠিক ব্যাকআপ ফাইল নয়');
//     const n = { settings: b.settings, sections: b.sections, items: b.items, pages: b.pages || [], orders: b.orders || [] };
//     await save(n, COLS); return send(res, 200, { ok: true });
//   }

//   const c = seg[2], rid = seg[3];
//   if (c === 'orders') {
//     const o = db.orders.find(x => x.id === rid);
//     if (!o) throw err(404, 'অর্ডার পাওয়া যায়নি');
//     if (m === 'PUT') {
//       const b = await body(req, 1e4);
//       if (['new', 'processing', 'done', 'cancelled'].includes(b.status)) o.status = b.status;
//       if (typeof b.note === 'string') o.note = b.note.slice(0, 2000);
//     } else if (m === 'DELETE') db.orders = db.orders.filter(x => x !== o);
//     else throw err(405, 'অনুমোদিত নয়');
//     await save(db, ['orders']); return send(res, 200, { ok: true });
//   }
//   if (!F[c]) throw err(404, 'পাওয়া যায়নি');
//   const list = db[c];
//   if (m === 'POST') {
//     const b = pick(await body(req), F[c]);
//     const rec = { id: c[0] + id(), ...b };
//     if (c === 'sections') rec.id = (String(b.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 's') + '-' + id().slice(0, 4);
//     list.push(rec); await save(db, [c]); return send(res, 200, rec);
//   }
//   const rec = list.find(x => x.id === rid);
//   if (!rec) throw err(404, 'পাওয়া যায়নি');
//   if (m === 'PUT') { Object.assign(rec, pick(await body(req), F[c])); await save(db, [c]); return send(res, 200, rec); }
//   if (m === 'DELETE') {
//     db[c] = list.filter(x => x !== rec);
//     const cols = [c];
//     if (c === 'sections') { db.items = db.items.filter(i => i.section !== rid); cols.push('items'); }
//     await save(db, cols); return send(res, 200, { ok: true });
//   }
//   throw err(405, 'অনুমোদিত নয়');
// }

// module.exports = async (req, res) => {
//   try { await api(req, res); }
//   catch (e) {
//     if (!e.status) console.error(e);
//     if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'সার্ভারে সমস্যা হয়েছে' });
//   }
// };


'use strict';
// SMS IT Agency — Vercel ভার্সন: ডেটা Upstash Redis-এ, ছবি/ভিডিও Cloudinary-তে
const crypto = require('crypto');
const PASS = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SECRET || crypto.createHash('sha256').update('sms-' + PASS).digest('hex');
const R_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const R_TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const CLD = { name: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };
const COLS = ['settings', 'sections', 'items', 'pages', 'orders'];

/* ---------- Upstash Redis (REST) ---------- */
async function redis(cmds) {
  if (!R_URL || !R_TOK) throw err(503, 'সার্ভারে Upstash Redis সেট করা হয়নি');
  const r = await fetch(R_URL + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + R_TOK, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('UPSTASH HTTP', r.status, JSON.stringify(j).slice(0, 300)); throw err(500, 'ডেটাবেস সমস্যা'); }
  return j.map(x => { if (x.error) { console.error('UPSTASH ERR', x.error); throw err(500, 'ডেটাবেস সমস্যা'); } return x.result; });
}
async function load() {
  const vals = await redis(COLS.map(c => ['GET', 'sms:' + c]));
  let db = {};
  COLS.forEach((c, i) => { if (vals[i] != null) db[c] = JSON.parse(vals[i]); });
  if (!db.settings) { // প্রথমবার: seed.json থেকে ভরা হবে
    db = JSON.parse(JSON.stringify(require('../seed.json')));
    COLS.forEach(c => db[c] = db[c] || (c === 'settings' ? {} : []));
    await save(db, COLS);
  }
  COLS.forEach(c => db[c] = db[c] || (c === 'settings' ? {} : []));
  return db;
}
const save = (db, cols) => redis(cols.map(c => ['SET', 'sms:' + c, JSON.stringify(db[c])]));

/* ---------- হেল্পার ---------- */
const F = {
  sections: 'title desc icon message orderable order enabled'.split(' '),
  items: 'section type title desc src poster alt w h featured facts order enabled'.split(' '),
  pages: 'slug title content inNav order enabled'.split(' ')
};
const SET_F = 'name slogan logo heroImage heroTitle heroLead aboutText whatsappNumber messengerUrl facebookPageUrl email youtube instagram tiktok defaultMessage'.split(' ');
const err = (status, message) => Object.assign(new Error(message), { status });
const id = () => crypto.randomBytes(5).toString('hex');
function pick(o, keys) {
  const r = {};
  for (const k of keys) {
    if (!(k in o)) continue;
    let v = o[k];
    if (typeof v === 'string') v = v.slice(0, 20000);
    else if (Array.isArray(v)) v = v.slice(0, 8).map(x => ({ v: String((x && x.v) || '').slice(0, 80), l: String((x && x.l) || '').slice(0, 120) }));
    else if (typeof v !== 'boolean' && typeof v !== 'number') continue;
    r[k] = v;
  }
  if (r.slug) r.slug = r.slug.trim().replace(/[\s\/#?%]+/g, '-');
  return r;
}
const sign = e => crypto.createHmac('sha256', SECRET).update(String(e)).digest('hex');
const mint = () => { const e = Date.now() + 7 * 864e5; return e + '.' + sign(e); };
function auth(req) {
  const [e, s] = (req.headers.authorization || '').replace(/^Bearer /, '').split('.');
  if (!PASS || !e || !s || +e < Date.now()) throw err(401, 'লগইন করুন');
  const a = Buffer.from(s), b = Buffer.from(sign(e));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw err(401, 'লগইন করুন');
}
// রেট লিমিট (ইন-মেমোরি; সার্ভারলেসে সীমিত সুরক্ষা)
const hits = new Map();
function limit(key, max, ms) {
  const n = Date.now(), h = (hits.get(key) || []).filter(t => n - t < ms);
  if (h.length >= max) throw err(429, 'অনেকবার চেষ্টা হয়েছে, একটু পরে আবার করুন');
  h.push(n); hits.set(key, h);
}
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
async function body(req, max = 4e6) {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    try { return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body); } catch { throw err(400, 'ভুল ডেটা'); }
  }
  const c = []; let n = 0;
  for await (const d of req) { n += d.length; if (n > max) throw err(413, 'ডেটা অনেক বড়'); c.push(d); }
  try { return c.length ? JSON.parse(Buffer.concat(c).toString('utf8')) : {}; } catch { throw err(400, 'ভুল ডেটা'); }
}
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
function publicData(db) {
  const on = x => x.enabled !== false, s = db.settings;
  return {
    settings: { ...s, social: { youtube: s.youtube || '', instagram: s.instagram || '', tiktok: s.tiktok || '' } },
    sections: db.sections.filter(on).sort(byOrder),
    items: db.items.filter(on).sort(byOrder),
    pages: db.pages.filter(on).sort(byOrder)
  };
}

/* ---------- Cloudinary সাইন (ব্রাউজার থেকে সরাসরি আপলোডের জন্য) ---------- */
function cloudSign(u) {
  if (!CLD.name || !CLD.key || !CLD.secret) throw err(503, 'সার্ভারে Cloudinary সেট করা হয়নি');
  const type = u.searchParams.get('type') === 'video' ? 'video' : 'image';
  const timestamp = Math.floor(Date.now() / 1000), folder = 'sms-it-agency';
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${CLD.secret}`).digest('hex');
  return { url: `https://api.cloudinary.com/v1_1/${CLD.name}/${type}/upload`, apiKey: CLD.key, timestamp, folder, signature };
}

/* ---------- API ---------- */
async function api(req, res) {
  const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname).replace(/\/+$/, '');
  const m = req.method, seg = p.split('/').filter(Boolean);

  if (p === '/api/site' && m === 'GET') {
    const out = publicData(await load());
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, out);
  }
  if (p === '/api/orders' && m === 'POST') {
    limit('o' + ipOf(req), 8, 36e5);
    const b = await body(req, 2e4), t = (v, n) => String(v || '').trim().slice(0, n);
    if (b.website) return send(res, 200, { ok: true });
    const o = { id: id(), createdAt: new Date().toISOString(), name: t(b.name, 100), phone: t(b.phone, 30), email: t(b.email, 120), section: t(b.section, 40), message: t(b.message, 2000), status: 'new', note: '' };
    if (!o.name || o.phone.replace(/\D/g, '').length < 6) throw err(400, 'নাম ও সঠিক ফোন নম্বর দিন');
    const db = await load();
    const sec = db.sections.find(s => s.id === o.section);
    o.service = sec ? sec.title : 'অন্যান্য';
    db.orders.unshift(o); db.orders = db.orders.slice(0, 2000);
    await save(db, ['orders']);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/login' && m === 'POST') {
    limit('l' + ipOf(req), 10, 9e5);
    if (!PASS) throw err(503, 'সার্ভারে ADMIN_PASSWORD সেট করা হয়নি');
    const b = await body(req, 2e3), h = x => crypto.createHash('sha256').update(String(x || '')).digest();
    if (!crypto.timingSafeEqual(h(b.password), h(PASS))) throw err(401, 'পাসওয়ার্ড ভুল');
    return send(res, 200, { token: mint() });
  }

  if (seg[1] !== 'admin') throw err(404, 'পাওয়া যায়নি');
  auth(req);
  if (p === '/api/admin/sign-upload' && m === 'GET') return send(res, 200, cloudSign(u));

  const db = await load();
  if (p === '/api/admin/all' && m === 'GET') return send(res, 200, db);
  if (p === '/api/admin/settings' && m === 'PUT') { Object.assign(db.settings, pick(await body(req), SET_F)); await save(db, ['settings']); return send(res, 200, db.settings); }
  if (p === '/api/admin/import' && m === 'POST') {
    const b = await body(req, 4e6);
    if (!b.settings || !Array.isArray(b.sections) || !Array.isArray(b.items)) throw err(400, 'এটি সঠিক ব্যাকআপ ফাইল নয়');
    const n = { settings: b.settings, sections: b.sections, items: b.items, pages: b.pages || [], orders: b.orders || [] };
    await save(n, COLS); return send(res, 200, { ok: true });
  }

  const c = seg[2], rid = seg[3];
  if (c === 'orders') {
    const o = db.orders.find(x => x.id === rid);
    if (!o) throw err(404, 'অর্ডার পাওয়া যায়নি');
    if (m === 'PUT') {
      const b = await body(req, 1e4);
      if (['new', 'processing', 'done', 'cancelled'].includes(b.status)) o.status = b.status;
      if (typeof b.note === 'string') o.note = b.note.slice(0, 2000);
    } else if (m === 'DELETE') db.orders = db.orders.filter(x => x !== o);
    else throw err(405, 'অনুমোদিত নয়');
    await save(db, ['orders']); return send(res, 200, { ok: true });
  }
  if (!F[c]) throw err(404, 'পাওয়া যায়নি');
  const list = db[c];
  if (m === 'POST') {
    const b = pick(await body(req), F[c]);
    const rec = { id: c[0] + id(), ...b };
    if (c === 'sections') rec.id = (String(b.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 's') + '-' + id().slice(0, 4);
    list.push(rec); await save(db, [c]); return send(res, 200, rec);
  }
  const rec = list.find(x => x.id === rid);
  if (!rec) throw err(404, 'পাওয়া যায়নি');
  if (m === 'PUT') { Object.assign(rec, pick(await body(req), F[c])); await save(db, [c]); return send(res, 200, rec); }
  if (m === 'DELETE') {
    db[c] = list.filter(x => x !== rec);
    const cols = [c];
    if (c === 'sections') { db.items = db.items.filter(i => i.section !== rid); cols.push('items'); }
    await save(db, cols); return send(res, 200, { ok: true });
  }
  throw err(405, 'অনুমোদিত নয়');
}

module.exports = async (req, res) => {
  try { await api(req, res); }
  catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'সার্ভারে সমস্যা হয়েছে' });
  }
};
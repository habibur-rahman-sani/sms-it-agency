'use strict';
// অ্যাডমিন প্যানেলের ডেটা থেকে HTML-এ সার্ভিস, পোর্টফোলিও ও JSON-LD বসায়, যাতে Google ও AI ক্রলার সরাসরি পড়তে পারে।
const SITE = 'https://sms-it-agency.vercel.app';
const NAME = 'SMS IT Agency';
const ALT = ['SMS IT', 'SMS-IT Agency', 'sms-it-agency', 'smsitagency', 'SMS IT Agency BD', 'SMS IT Agency Bangladesh'];

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ld = o => JSON.stringify(o, null, 2).replace(/</g, '\\u003c');
const isUrl = u => /^https?:\/\//i.test(String(u || '').trim());

function services(sections) {
  return sections.map(s => `\n          <li class="service"><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p></li>`).join('');
}

function grid(items) {
  return items.map(i => {
    const src = i.type === 'video' ? i.poster : i.src;
    const wh = i.w && i.h ? ` width="${esc(i.w)}" height="${esc(i.h)}"` : '';
    const img = src ? `<div class="card__media"><img src="${esc(src)}" alt="${esc(i.alt || i.title)}"${wh} loading="lazy" decoding="async"></div>` : '';
    return `\n          <article class="card">${img}<div class="card__body"><h3>${esc(i.title)}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ''}</div></article>`;
  }).join('');
}

function schema(pub) {
  const s = pub.settings || {};
  const o = {
    '@context': 'https://schema.org', '@type': 'ProfessionalService', name: NAME, alternateName: ALT,
    url: SITE + '/', logo: SITE + '/assets/logos/icon-512.png', image: SITE + '/assets/images/og-image.jpg',
    description: 'Facebook Ads, ডিজিটাল মার্কেটিং, গ্রাফিক ডিজাইন, ভিডিও এডিটিং ও ওয়েবসাইট ডেভেলপমেন্ট সার্ভিস।',
    areaServed: { '@type': 'Country', name: 'Bangladesh' }, inLanguage: 'bn'
  };
  const tel = String(s.whatsappNumber || '').trim();
  if (tel) o.telephone = tel;
  if (s.email) o.email = String(s.email).trim();
  const same = [s.facebookPageUrl, s.youtube, s.instagram, s.tiktok].filter(isUrl).map(u => u.trim());
  if (same.length) o.sameAs = same;
  o.hasOfferCatalog = {
    '@type': 'OfferCatalog', name: 'সার্ভিস',
    itemListElement: (pub.sections || []).map(x => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: x.title, description: x.desc } }))
  };
  return o;
}

// html: _home.html-এর লেখা, pub: publicData(db) এর ফলাফল
function render(html, pub) {
  const put = (tag, body) => {
    const re = new RegExp('<!--SEO:' + tag + '-->[\\s\\S]*?<!--/SEO:' + tag + '-->');
    return (h) => re.test(h) ? h.replace(re, () => '<!--SEO:' + tag + '-->' + body + '<!--/SEO:' + tag + '-->') : h;
  };
  let out = html;
  out = put('SERVICES', services(pub.sections || []))(out);
  out = put('GRID', grid(pub.items || []) + '\n        ')(out);
  out = put('LD', '<script type="application/ld+json">\n' + ld(schema(pub)) + '\n  </script>')(out);
  return out;
}


/* ---------- আলাদা পেজ (/p/<slug>) ও সাইটম্যাপ ---------- */
const pageUrl = slug => SITE + '/p/' + encodeURIComponent(slug);

function pageBlocks(content) {
  return String(content || '').split(/\n\s*\n/).map(blk => {
    const parts = [];
    blk.split('\n').forEach(ln => {
      ln = ln.trim(); if (!ln) return;
      const im = /^!\s*(\S+)$/.exec(ln);
      if (/^##\s+/.test(ln)) parts.push('<h2>' + esc(ln.replace(/^##\s+/, '')) + '</h2>');
      else if (im && /^(\/uploads\/|assets\/|https:\/\/)/.test(im[1])) parts.push('<img src="' + esc(im[1]) + '" alt="" loading="lazy">');
      else parts.push('<p>' + esc(ln) + '</p>');
    });
    return parts.length ? '<div class="page__blk">' + parts.join('') + '</div>' : '';
  }).join('');
}

function pageDesc(page) {
  const line = String(page.content || '').split('\n').map(x => x.trim()).find(x => x && !/^(##\s|!\s)/.test(x)) || '';
  return (line || page.title).replace(/\s+/g, ' ').slice(0, 155);
}

function findPage(pub, slug) {
  return (pub.pages || []).find(x => x.slug === slug) || null;
}

function renderPage(html, pub, page) {
  const url = pageUrl(page.slug), title = page.title + ' | ' + NAME, desc = pageDesc(page);
  let out = render(html, pub);
  out = out.replace(/<head>/, '<head>\n  <base href="/">');
  out = out.replace(/<title>[\s\S]*?<\/title>/, () => '<title>' + esc(title) + '</title>');
  out = out.replace(/<meta name="description"[^>]*>/, () => '<meta name="description" content="' + esc(desc) + '">');
  out = out.replace(/<link rel="canonical"[^>]*>/, () => '<link rel="canonical" href="' + esc(url) + '">');
  out = out.replace(/<meta property="og:url"[^>]*>/, () => '<meta property="og:url" content="' + esc(url) + '">');
  out = out.replace(/<meta property="og:title"[^>]*>/, () => '<meta property="og:title" content="' + esc(title) + '">');
  out = out.replace(/<meta property="og:description"[^>]*>/, () => '<meta property="og:description" content="' + esc(desc) + '">');
  // হোমের সেকশনগুলো লুকিয়ে পেজের লেখা দেখানো (main.js এর route() এর মতোই)
  out = out.replace(/(<main[^>]*>)([\s\S]*?)(<\/main>)/, (m, a, body, c) => {
    body = body.replace(/<section (?![^>]*id="pageView")/g, '<section data-hidden="true" ');
    const view = '<section class="section" id="pageView"><div class="wrap page" id="pageBody"><a class="page__back" href="/">← হোম পেজ</a><h1>' + esc(page.title) + '</h1>' + pageBlocks(page.content) + '</div></section>';
    body = body.replace(/<section class="section" id="pageView"[^>]*>[\s\S]*?<\/section>/, () => view);
    return a + body + c;
  });
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: NAME, item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: page.title, item: url }
    ]
  };
  const web = { '@context': 'https://schema.org', '@type': 'WebPage', name: page.title, description: desc, url, inLanguage: 'bn', isPartOf: { '@type': 'WebSite', name: NAME, url: SITE + '/' } };
  const tags = [web, crumbs].map(o => '<script type="application/ld+json">\n' + ld(o) + '\n  </script>').join('\n  ');
  out = out.replace(/<\/head>/, () => '  ' + tags + '\n</head>');
  return out;
}

function sitemap(pub) {
  const urls = [SITE + '/'].concat((pub.pages || []).map(p => pageUrl(p.slug)));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u, i) => '  <url><loc>' + esc(u) + '</loc><changefreq>' + (i ? 'monthly' : 'weekly') + '</changefreq><priority>' + (i ? '0.6' : '1.0') + '</priority></url>').join('\n') +
    '\n</urlset>\n';
}

const notFoundHtml = '<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>পেজ পাওয়া যায়নি | ' + NAME + '</title></head><body style="font-family:sans-serif;background:#070b14;color:#e8eefc;text-align:center;padding:15vh 20px"><h1>৪০৪ – পেজ পাওয়া যায়নি</h1><p><a style="color:#7fb7ff" href="/">← হোম পেজে ফিরুন</a></p></body></html>';

module.exports = { render, esc, schema, renderPage, findPage, sitemap, notFoundHtml };

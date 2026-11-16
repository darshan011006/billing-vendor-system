// Product text -> 256-dimension vector, computed locally with no ML model or API key:
// each word and each 3-letter piece of a word ("diya" -> " di", "diy", "iya", "ya ") is
// hashed into one of 256 slots (the "hashing trick"), then the vector is scaled to length 1.
// Two texts that share words or spellings point the same way, so cosine similarity
// (here a dot product, as both vectors have length 1) finds "Brass Diya" for "diya lamp".
// In production you would swap embed() for a sentence-embedding model; the MongoDB
// side (vector field + similarity pipeline / Atlas $vectorSearch) stays the same.

const DIMS = 256;
const MODEL = 'trigram-hash-256-v1';

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function features(text) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out = [];
  for (const w of words) {
    out.push(['w:' + w, 1.0]);
    const padded = ` ${w} `;
    for (let i = 0; i + 3 <= padded.length; i++) out.push(['t:' + padded.slice(i, i + 3), 0.5]);
  }
  return out;
}

function embed(text) {
  const v = new Array(DIMS).fill(0);
  for (const [feat, weight] of features(text)) {
    const h = fnv1a(feat);
    v[h % DIMS] += (h & 0x80000000 ? -1 : 1) * weight;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => Math.round((x / norm) * 1e6) / 1e6);
}

// Text that describes a product for search
function productText(p) {
  return [p.name, p.category_path || p.category, p.sku, p.hsn_code ? `hsn ${p.hsn_code}` : ''].filter(Boolean).join(' ');
}

// Aggregation pipeline: cosine similarity between every stored vector and the query vector
function similarityPipeline(queryVector, limit = 5) {
  return [
    {
      $project: {
        productId: 1, sku: 1, name: 1, category: 1,
        score: {
          $reduce: {
            input: { $range: [0, DIMS] },
            initialValue: 0,
            in: { $add: ['$$value', { $multiply: [{ $arrayElemAt: ['$embedding', '$$this'] }, { $arrayElemAt: [queryVector, '$$this'] }] }] },
          },
        },
      },
    },
    { $match: { score: { $gt: 0.05 } } },
    { $sort: { score: -1 } },
    { $limit: limit },
  ];
}

module.exports = { DIMS, MODEL, embed, productText, similarityPipeline };

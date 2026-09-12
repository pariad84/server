// fn is a plain <script> page that can be served from anywhere -- including file://, whose Origin
// is the literal "null" -- so the browser preflights fn.data's writes. Three headers cover it;
// no dependency needed. Set CORS_ORIGIN to pin it to one origin in production.
const origin = process.env.CORS_ORIGIN || '*';

const cors = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
};

module.exports = cors;

const https = require('https');

const checkUrl = (url) => {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve({ url, status: res.statusCode });
    }).on('error', () => {
      resolve({ url, status: 'error' });
    });
  });
};

const ids = [
  '1519278470209-c4479623844d',
  '1503944583507-9c58ac01f78c',
  '1551488831-00ddcb6c6bd3',
  '1519457431-7551fe2d861b',
  '1503342217505-b0a15ec3261c',
  '1518831959646-742c3a14ebf7',
  '1521369909029-2afed882baee',
  '1543163521-1bf539c55dd2',
  '1617135671148-99cf40e94757',
  '1621450259223-23305dfc657a',
  '1531746020798-29739070f80a'
];

async function main() {
  const promises = ids.map(id => checkUrl(`https://images.unsplash.com/photo-${id}?q=80&w=400`));
  const results = await Promise.all(promises);
  console.log(results);
}
main();

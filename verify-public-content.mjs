import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const root = await read("./index.html");
const english = await read("./en/index.html");
const robots = await read("./robots.txt");
const sitemap = await read("./sitemap.xml");
const shoppingSitemap = await read("./shoppingscanner/sitemap.xml");
const ads = (await read("./ads.txt")).trim();
const shopping = await read("./shoppingscanner/index.html");
const config = JSON.parse(await read("./shoppingscanner/global-commercial-config.json"));
const catalog = JSON.parse(await read("./shoppingscanner/catalog/index.json"));
const manifest = JSON.parse(await read("./shoppingscanner/manifest.webmanifest"));

assert(root.includes('href="/shoppingscanner/"'), "Korean root does not link ShoppingScanner");
assert(english.includes('href="/shoppingscanner/en/"'), "English root does not link ShoppingScanner");
for (const directive of [
  "User-agent: *",
  "Allow: /",
  "Sitemap: https://hanksleekorea-boop.github.io/sitemap.xml",
  "Sitemap: https://hanksleekorea-boop.github.io/shoppingscanner/sitemap.xml",
]) assert(robots.includes(directive), `robots.txt missing ${directive}`);
for (const url of [
  "https://hanksleekorea-boop.github.io/",
  "https://hanksleekorea-boop.github.io/shoppingscanner/",
]) assert(sitemap.includes(`<loc>${url}</loc>`), `sitemap missing ${url}`);
for (const url of [
  "https://hanksleekorea-boop.github.io/shoppingscanner/",
  "https://hanksleekorea-boop.github.io/shoppingscanner/en/",
  "https://hanksleekorea-boop.github.io/shoppingscanner/privacy/",
  "https://hanksleekorea-boop.github.io/shoppingscanner/terms/",
]) assert(shoppingSitemap.includes(`<loc>${url}</loc>`), `ShoppingScanner sitemap missing ${url}`);
assert(/^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0$/.test(ads), "root ads.txt is not an authorised Google seller row");
assert(!shopping.includes('src="/account.js"'), "static mirror references unavailable root account client");
assert(!shopping.includes('src="/shoppingscanner/account.js"'), "static mirror references unavailable prefixed account client");
assert.equal(config.advertising.enabled, false, "advertising must remain disabled before approval");
assert.equal(config.stage2.killSwitch, true, "stage 2 advertising kill switch must remain on");
assert.equal(config.stage3.killSwitch, true, "stage 3 advertising kill switch must remain on");
assert.equal(catalog.productCount, 3000, "catalog count changed");
assert.equal(manifest.scope, "/shoppingscanner/", "PWA scope changed");

console.log(JSON.stringify({ result: "PASS", unit: "public-pages-contract", catalog: catalog.productCount, ads: "SAFE_OFF", rootDiscovery: true }));

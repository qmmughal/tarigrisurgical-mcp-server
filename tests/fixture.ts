import { CatalogService } from '../src/services/catalogService.js';

export const FIXTURE_SOURCE = `
const SITE = {
  origin: "https://tarigrisurgical.com", name: "Tarigri Surgical Instruments", shortName: "Tarigri Surgical",
  tagline: "Factory-direct", email: "sales@tarigrisurgical.com", phoneText: "+92 330 6669292",
  whatsapp: "923306669292", pkrPerUsd: 280, trustLine: "Factory-direct",
  city: "Sialkot", region: "Punjab", country: "Pakistan", hoursText: "Mon-Sat, 9am - 6pm PKT",
};
const CATEGORIES = [
  { id: "scissors", name: "Surgical Scissors", art: "scissors", blurb: "Metzenbaum, Mayo, Iris and more." },
  { id: "holders", name: "Needle Holders", art: "holder", blurb: "Mayo-Hegar and more." },
];
const PRODUCTS = [
  { id: "sc-101", name: "Metzenbaum Scissors, Curved 18 cm", cat: "scissors", price: 1820, moq: 12, unit: "pc", tiers: [{ qty: 50, price: 1680 }, { qty: 100, price: 1540 }], material: "420 stainless steel", desc: "Fine dissecting scissors.", featured: true },
  { id: "nh-301", name: "Mayo-Hegar Needle Holder, 18 cm", cat: "holders", price: 4340, moq: 10, unit: "pc", tiers: [{ qty: 50, price: 4060 }], desc: "Needle holder." },
];
`;

export function makeService(overrides: { fetcher?: (url: string) => Promise<string>; now?: () => number; ttl?: number } = {}) {
  return new CatalogService({
    origin: 'https://tarigrisurgical.com',
    cacheTtlSeconds: overrides.ttl ?? 900,
    fetcher: overrides.fetcher ?? (async () => FIXTURE_SOURCE),
    now: overrides.now,
  });
}

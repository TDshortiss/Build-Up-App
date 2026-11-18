import { describe, expect, it } from 'vitest';
import { cleanUrl, readArrival, siteName } from './attribution';

const B = '/';
const SITE = 'https://www.builduptraining.com';

describe('readArrival', () => {
  it('reads UTM tags', () => {
    const t = readArrival(`${SITE}/?utm_source=Instagram&utm_medium=social&utm_campaign=story-hamstring`, '', B, 1);
    expect(t).toEqual({ source: 'instagram', medium: 'social', campaign: 'story-hamstring', content: undefined, referrer: undefined, landing: '/', at: 1 });
  });

  it('treats a plain visit as direct', () => {
    expect(readArrival(`${SITE}/`, '', B)).toBeNull();
    expect(readArrival(`${SITE}/`, `${SITE}/somewhere`, B)).toBeNull();
  });

  it('names the referring site when there are no tags', () => {
    const t = readArrival(`${SITE}/`, 'https://l.instagram.com/?u=x', B)!;
    expect(t.source).toBe('instagram');
    expect(t.medium).toBe('referral');
    expect(t.referrer).toBe('l.instagram.com');
  });

  it('handles the /ig and /tt short links, with or without a base path', () => {
    expect(readArrival(`${SITE}/ig`, '', B)).toMatchObject({ source: 'instagram', medium: 'social', campaign: 'bio', landing: '/' });
    expect(readArrival('https://x.github.io/Build-Up-App/tt/', '', '/Build-Up-App/')).toMatchObject({ source: 'tiktok', campaign: 'bio' });
  });

  it('ignores our own email links and webmail referrers', () => {
    expect(readArrival(`${SITE}/?token_hash=abc&type=signup`, 'https://mail.google.com/', B)).toBeNull();
    expect(readArrival(`${SITE}/`, 'https://outlook.live.com/', B)).toBeNull();
  });

  it('caps long values', () => {
    const t = readArrival(`${SITE}/?utm_source=${'a'.repeat(300)}`, '', B)!;
    expect(t.source).toHaveLength(100);
  });
});

describe('cleanUrl', () => {
  it('drops tracking tags and keeps everything else', () => {
    expect(cleanUrl(`${SITE}/?utm_source=ig&utm_campaign=bio`, B)).toBe('/');
    expect(cleanUrl(`${SITE}/?token_hash=t&type=signup&utm_source=ig#x`, B)).toBe('/?token_hash=t&type=signup#x');
    expect(cleanUrl(`${SITE}/ig`, B)).toBe('/');
  });
});

describe('siteName', () => {
  it('groups common sites', () => {
    expect(siteName('www.tiktok.com')).toBe('tiktok');
    expect(siteName('www.google.co.uk')).toBe('google');
    expect(siteName('t.co')).toBe('x');
    expect(siteName('www.example.org')).toBe('example.org');
  });
});

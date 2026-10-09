import { describe, expect, it } from 'vitest';
import { createBotDetector } from '@/modules/bot-detection/bot-detector';
import { DEFAULT_BOT_USER_AGENTS } from '@/shared/config/env';

const isBot = createBotDetector(DEFAULT_BOT_USER_AGENTS);

const BOT_USER_AGENTS: Record<string, string> = {
  'Googlebot desktop':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/130.0.6723.116 Safari/537.36',
  'Googlebot smartphone':
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.116 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bingbot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
  WhatsApp: 'WhatsApp/2.23.20.0',
  'Facebook external hit':
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  Twitterbot: 'Twitterbot/1.0',
  TelegramBot: 'TelegramBot (like TwitterBot)',
  Slackbot: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  LinkedInBot: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  Discordbot: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
};

const HUMAN_USER_AGENTS: Record<string, string> = {
  'Chrome desktop':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Chrome Android':
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  'Safari macOS':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Safari iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Firefox desktop':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  'Firefox Android': 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
};

describe('createBotDetector', () => {
  it.each(Object.entries(BOT_USER_AGENTS))('detects %s as a bot', (_name, userAgent) => {
    expect(isBot(userAgent)).toBe(true);
  });

  it.each(Object.entries(HUMAN_USER_AGENTS))('does not flag %s', (_name, userAgent) => {
    expect(isBot(userAgent)).toBe(false);
  });

  it('treats a missing or blank user agent as a bot', () => {
    expect(isBot(undefined)).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot('   ')).toBe(true);
  });

  it('matches case-insensitively in both directions', () => {
    const detect = createBotDetector(['MyCrawler']);

    expect(detect('Mozilla/5.0 (compatible; mycrawler/1.0)')).toBe(true);
    expect(detect('MYCRAWLER')).toBe(true);
  });

  it('only uses the configured patterns', () => {
    const detect = createBotDetector(['custombot']);

    expect(detect(BOT_USER_AGENTS.Bingbot)).toBe(false);
    expect(detect('CustomBot/3.1')).toBe(true);
  });

  it('supports regular-expression sources from the env list', () => {
    const detect = createBotDetector(['my-crawler\\/\\d+']);

    expect(detect('My-Crawler/42')).toBe(true);
    expect(detect('My-Crawler/beta')).toBe(false);
  });

  it('ignores invalid regular expressions and blank patterns without throwing', () => {
    const detect = createBotDetector(['(unclosed', '', '  ']);

    expect(detect('Mozilla/5.0 (unclosed')).toBe(true);
    expect(detect(HUMAN_USER_AGENTS['Chrome desktop'])).toBe(false);
  });

  it('flags nothing but missing user agents when the pattern list is empty', () => {
    const detect = createBotDetector([]);

    expect(detect(BOT_USER_AGENTS['Googlebot desktop'])).toBe(false);
    expect(detect(undefined)).toBe(true);
  });
});

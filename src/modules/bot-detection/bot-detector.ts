export type BotDetector = (userAgent: string | null | undefined) => boolean;

const REGEX_METACHARACTERS = /[\\^$.*+?()[\]{}|]/;

/**
 * Creates a User-Agent classifier from configured patterns (for example
 * `getServerEnv().BOT_USER_AGENTS`). A user agent is a bot when it contains a
 * pattern (case-insensitive substring) or, for patterns that contain regex
 * metacharacters and compile, when the case-insensitive regex matches.
 * Invalid regexes fall back to substring matching only.
 *
 * A missing or blank user agent is treated as a bot: real browsers always
 * send one, and classifying it as a bot avoids triggering scraper API and
 * copy-mutation calls for anonymous scripted traffic.
 */
export function createBotDetector(patterns: readonly string[]): BotDetector {
  const substrings = patterns
    .map((pattern) => pattern.trim().toLowerCase())
    .filter((pattern) => pattern.length > 0);
  const regexes = substrings.flatMap(compileRegex);

  return (userAgent) => {
    const normalized = userAgent?.trim().toLowerCase() ?? '';
    if (normalized === '') return true;
    return (
      substrings.some((pattern) => normalized.includes(pattern)) ||
      regexes.some((regex) => regex.test(normalized))
    );
  };
}

function compileRegex(pattern: string): RegExp[] {
  if (!REGEX_METACHARACTERS.test(pattern)) return [];
  try {
    return [new RegExp(pattern, 'i')];
  } catch {
    return [];
  }
}

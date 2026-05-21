export const INVITE_START_PARAM_PREFIX = 'invite_';

export type InviteLinkOptions = {
  botUsername?: string | null;
  miniAppName?: string | null;
};

export type InviteLaunchParams = {
  startParam?: string | null;
  search?: string | null;
};

/** Removes @ and whitespace from Telegram bot username. */
export function normalizeBotUsername(username?: string | null) {
  const normalized = username?.trim().replace(/^@+/, '') ?? '';
  return normalized || null;
}

/** Removes extra slashes and whitespace from Telegram Mini App short name. */
export function normalizeMiniAppName(appName?: string | null) {
  const normalized = appName?.trim().replace(/^\/+|\/+$/g, '') ?? '';
  return normalized || null;
}

/** Normalizes invite code received from DB, URL or Telegram launch params. */
export function normalizeInviteCode(code?: string | null) {
  const normalized = code?.trim() ?? '';
  return normalized || null;
}

/** Encodes invite code into Telegram Mini App start parameter. */
export function createInviteStartParam(code: string) {
  const normalizedCode = normalizeInviteCode(code);
  return normalizedCode ? `${INVITE_START_PARAM_PREFIX}${normalizedCode}` : null;
}

/** Extracts invite code from Telegram Mini App start parameter. */
export function extractInviteCodeFromStartParam(startParam?: string | null) {
  const normalizedStartParam = startParam?.trim() ?? '';

  if (!normalizedStartParam) return null;

  if (normalizedStartParam.startsWith(INVITE_START_PARAM_PREFIX)) {
    return normalizeInviteCode(normalizedStartParam.slice(INVITE_START_PARAM_PREFIX.length));
  }

  return null;
}

/**
 * Creates a Telegram Mini App direct link that opens the concrete app, not just the bot chat.
 *
 * Telegram direct Mini App links use the format:
 * https://t.me/{bot_username}/{mini_app_short_name}?startapp={payload}
 */
export function createTelegramInviteLink(code: string, botUsername?: string | null, miniAppName?: string | null) {
  const username = normalizeBotUsername(botUsername);
  const appName = normalizeMiniAppName(miniAppName);
  const startParam = createInviteStartParam(code);

  if (!username || !appName || !startParam) return null;

  return `https://t.me/${username}/${appName}?startapp=${encodeURIComponent(startParam)}`;
}

/** Creates the Telegram Mini App invite link. Returns an empty string when app config is incomplete. */
export function createInviteLink(code: string, options: InviteLinkOptions = {}) {
  return createTelegramInviteLink(code, options.botUsername, options.miniAppName) ?? '';
}

/** Reads invite code from Telegram start_param or browser query. */
export function getInviteCodeFromLaunchParams(params: InviteLaunchParams = {}) {
  const fromStartParam = extractInviteCodeFromStartParam(params.startParam);

  if (fromStartParam) return fromStartParam;

  const search = params.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const query = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);

  return normalizeInviteCode(query.get('invite'));
}

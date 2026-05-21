import { createClient } from 'npm:@supabase/supabase-js@2';

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type AppUser = {
  id: string;
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

type Space = {
  id: string;
  owner_user_id: string;
  title: string;
  type: 'personal' | 'shared';
  created_at: string;
  updated_at: string;
  role?: 'owner' | 'member';
};

type RouteContext = {
  request: Request;
  method: string;
  segments: string[];
  url: URL;
  user: AppUser;
  supabase: ReturnType<typeof createClient>;
};

class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data, x-dev-telegram-user',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

const encoder = new TextEncoder();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createAdminClient();
    const telegramUser = await authenticateTelegramUser(request);
    const user = await ensureAppUser(supabase, telegramUser);
    const url = new URL(request.url);
    const segments = normalizeSegments(url.pathname);

    const result = await route({
      request,
      method: request.method,
      segments,
      url,
      user,
      supabase,
    });

    return json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ message: error.message, details: error.details ?? null }, error.status);
    }

    console.error(error);
    return json({ message: 'Internal server error' }, 500);
  }
});

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = getSupabaseSecretKey();

  if (!supabaseUrl || !secretKey) {
    throw new HttpError(500, 'SUPABASE_URL or service secret is not configured');
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getSupabaseSecretKey(): string | null {
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS');

  if (secretKeysJson) {
    try {
      const parsed = JSON.parse(secretKeysJson) as Record<string, string>;
      return parsed.default ?? Object.values(parsed)[0] ?? null;
    } catch {
      return null;
    }
  }

  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

function normalizeSegments(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean);
  const functionNameIndex = segments.lastIndexOf('api');

  if (functionNameIndex >= 0) {
    return segments.slice(functionNameIndex + 1);
  }

  return segments;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

async function readBody<T extends Record<string, unknown>>(request: Request): Promise<T> {
  if (request.method === 'GET' || request.method === 'DELETE') return {} as T;

  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

async function authenticateTelegramUser(request: Request): Promise<TelegramUser> {
  const initData = request.headers.get('x-telegram-init-data') ?? '';
  const allowDevAuth = Deno.env.get('ALLOW_DEV_AUTH') === 'true';

  if (!initData && allowDevAuth) {
    const devUserHeader = request.headers.get('x-dev-telegram-user');

    if (!devUserHeader) {
      throw new HttpError(401, 'Missing X-Dev-Telegram-User header');
    }

    try {
      const user = JSON.parse(devUserHeader) as TelegramUser;
      if (!user.id) throw new Error('id is required');
      return user;
    } catch {
      throw new HttpError(401, 'Invalid X-Dev-Telegram-User header');
    }
  }

  if (!initData) {
    throw new HttpError(401, 'Missing Telegram initData');
  }

  return validateTelegramInitData(initData);
}

async function validateTelegramInitData(initData: string): Promise<TelegramUser> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

  if (!botToken) {
    throw new HttpError(500, 'TELEGRAM_BOT_TOKEN is not configured');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    throw new HttpError(401, 'Telegram initData hash is missing');
  }

  const authDate = Number(params.get('auth_date'));
  const maxAgeSeconds = Number(Deno.env.get('TELEGRAM_INIT_DATA_MAX_AGE_SECONDS') ?? 86400);

  if (!Number.isFinite(authDate) || authDate <= 0) {
    throw new HttpError(401, 'Telegram initData auth_date is invalid');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (maxAgeSeconds > 0 && nowSeconds - authDate > maxAgeSeconds) {
    throw new HttpError(401, 'Telegram initData is expired');
  }

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await hmac('WebAppData', botToken);
  const expectedHash = toHex(await hmac(secretKey, dataCheckString));

  if (!safeEqual(expectedHash, hash)) {
    throw new HttpError(401, 'Telegram initData signature is invalid');
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new HttpError(401, 'Telegram user is missing');
  }

  try {
    const user = JSON.parse(userRaw) as TelegramUser;
    if (!user.id) throw new Error('id is required');
    return user;
  } catch {
    throw new HttpError(401, 'Telegram user payload is invalid');
  }
}

async function hmac(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

async function ensureAppUser(supabase: ReturnType<typeof createClient>, telegramUser: TelegramUser): Promise<AppUser> {
  const payload = {
    telegram_user_id: telegramUser.id,
    username: telegramUser.username ?? null,
    first_name: telegramUser.first_name ?? null,
    last_name: telegramUser.last_name ?? null,
    photo_url: telegramUser.photo_url ?? null,
  };

  const { data: existingUser, error: selectError } = await supabase
    .from('app_users')
    .select('*')
    .eq('telegram_user_id', telegramUser.id)
    .maybeSingle();

  if (selectError) throw new HttpError(500, selectError.message);

  let user: AppUser;

  if (existingUser) {
    const { data: updatedUser, error: updateError } = await supabase
      .from('app_users')
      .update(payload)
      .eq('id', existingUser.id)
      .select('*')
      .single();

    if (updateError) throw new HttpError(500, updateError.message);
    user = updatedUser as AppUser;
  } else {
    const { data: insertedUser, error: insertError } = await supabase
      .from('app_users')
      .insert(payload)
      .select('*')
      .single();

    if (insertError) throw new HttpError(500, insertError.message);
    user = insertedUser as AppUser;
  }

  await ensurePersonalSpace(supabase, user);
  return user;
}

async function ensurePersonalSpace(supabase: ReturnType<typeof createClient>, user: AppUser) {
  const { data: personalSpace, error } = await supabase
    .from('spaces')
    .select('*')
    .eq('owner_user_id', user.id)
    .eq('type', 'personal')
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);

  if (personalSpace) {
    await ensureSpaceMember(supabase, personalSpace.id, user.id, 'owner');
    return;
  }

  const { data: space, error: insertError } = await supabase
    .from('spaces')
    .insert({ owner_user_id: user.id, title: 'Мои купоны', type: 'personal' })
    .select('*')
    .single();

  if (insertError) throw new HttpError(500, insertError.message);
  await ensureSpaceMember(supabase, space.id, user.id, 'owner');
}

async function ensureSpaceMember(
  supabase: ReturnType<typeof createClient>,
  spaceId: string,
  userId: string,
  role: 'owner' | 'member',
) {
  const { error } = await supabase
    .from('space_members')
    .upsert({ space_id: spaceId, user_id: userId, role }, { onConflict: 'space_id,user_id' });

  if (error) throw new HttpError(500, error.message);
}

async function route(ctx: RouteContext): Promise<unknown> {
  const [first, second, third, fourth] = ctx.segments;

  if (ctx.method === 'GET' && first === 'me') return handleMe(ctx);

  if (first === 'spaces') {
    if (ctx.method === 'GET' && !second) return getSpaces(ctx);
    if (ctx.method === 'POST' && !second) return createSpace(ctx);
    if (ctx.method === 'PATCH' && second && !third) return updateSpace(ctx, second);
    if (ctx.method === 'DELETE' && second && !third) return deleteSpace(ctx, second);
    if (ctx.method === 'GET' && second && third === 'members') return getMembers(ctx, second);
    if (ctx.method === 'POST' && second && third === 'invites') return createInvite(ctx, second);
    if (ctx.method === 'DELETE' && second && third === 'members' && fourth) return removeMember(ctx, second, fourth);
    if (ctx.method === 'GET' && second && third === 'groups') return getGroups(ctx, second);
    if (ctx.method === 'POST' && second && third === 'groups') return createGroup(ctx, second);
    if (ctx.method === 'GET' && second && third === 'coupons') return getCoupons(ctx, second);
    if (ctx.method === 'POST' && second && third === 'coupons') return createCoupon(ctx, second);
  }

  if (first === 'invites' && second === 'accept' && ctx.method === 'POST') return acceptInvite(ctx);

  if (first === 'groups' && second) {
    if (ctx.method === 'PATCH') return updateGroup(ctx, second);
    if (ctx.method === 'DELETE') return deleteGroup(ctx, second);
  }

  if (first === 'coupons' && second) {
    if (ctx.method === 'PATCH') return updateCoupon(ctx, second);
    if (ctx.method === 'DELETE') return deleteCoupon(ctx, second);
  }

  throw new HttpError(404, 'Route not found');
}

async function handleMe(ctx: RouteContext) {
  return {
    user: ctx.user,
    spaces: await getSpaces(ctx),
  };
}

async function getSpaces(ctx: RouteContext): Promise<Space[]> {
  const { data: memberships, error: membersError } = await ctx.supabase
    .from('space_members')
    .select('space_id, role')
    .eq('user_id', ctx.user.id)
    .order('created_at', { ascending: true });

  if (membersError) throw new HttpError(500, membersError.message);

  const spaceIds = memberships.map((membership: { space_id: string }) => membership.space_id);
  if (spaceIds.length === 0) return [];

  const { data: spaces, error: spacesError } = await ctx.supabase
    .from('spaces')
    .select('*')
    .in('id', spaceIds)
    .order('created_at', { ascending: true });

  if (spacesError) throw new HttpError(500, spacesError.message);

  const roles = new Map(memberships.map((membership: { space_id: string; role: 'owner' | 'member' }) => [membership.space_id, membership.role]));

  return (spaces as Space[]).map((space) => ({ ...space, role: roles.get(space.id) ?? 'member' }));
}

async function createSpace(ctx: RouteContext): Promise<Space> {
  const body = await readBody<{ title?: string }>(ctx.request);
  const title = validateTitle(body.title, 'Название пространства');

  const { data: space, error } = await ctx.supabase
    .from('spaces')
    .insert({ owner_user_id: ctx.user.id, title, type: 'shared' })
    .select('*')
    .single();

  if (error) throw new HttpError(500, error.message);
  await ensureSpaceMember(ctx.supabase, space.id, ctx.user.id, 'owner');

  return { ...(space as Space), role: 'owner' };
}

async function updateSpace(ctx: RouteContext, spaceId: string): Promise<Space> {
  await assertOwner(ctx, spaceId);
  const body = await readBody<{ title?: string }>(ctx.request);
  const title = validateTitle(body.title, 'Название пространства');

  const { data, error } = await ctx.supabase.from('spaces').update({ title }).eq('id', spaceId).select('*').single();
  if (error) throw new HttpError(500, error.message);

  return { ...(data as Space), role: 'owner' };
}

async function deleteSpace(ctx: RouteContext, spaceId: string) {
  const space = await assertOwner(ctx, spaceId);

  if (space.type === 'personal') {
    throw new HttpError(400, 'Personal space cannot be deleted');
  }

  const { error } = await ctx.supabase.from('spaces').delete().eq('id', spaceId);
  if (error) throw new HttpError(500, error.message);

  return { ok: true };
}

async function getMembers(ctx: RouteContext, spaceId: string) {
  await assertMember(ctx, spaceId);

  const { data: members, error } = await ctx.supabase
    .from('space_members')
    .select('space_id, user_id, role, created_at')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: true });

  if (error) throw new HttpError(500, error.message);

  const userIds = members.map((member: { user_id: string }) => member.user_id);
  const { data: users, error: usersError } = await ctx.supabase.from('app_users').select('*').in('id', userIds);
  if (usersError) throw new HttpError(500, usersError.message);

  const usersById = new Map((users as AppUser[]).map((user) => [user.id, user]));
  return members.map((member: { user_id: string }) => ({ ...member, user: usersById.get(member.user_id) ?? null }));
}

async function createInvite(ctx: RouteContext, spaceId: string) {
  await assertOwner(ctx, spaceId);

  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const { data, error } = await ctx.supabase
    .from('space_invites')
    .insert({ space_id: spaceId, code, created_by_user_id: ctx.user.id, expires_at: expiresAt })
    .select('*')
    .single();

  if (error) throw new HttpError(500, error.message);
  return data;
}

async function acceptInvite(ctx: RouteContext) {
  const body = await readBody<{ code?: string }>(ctx.request);
  const code = String(body.code ?? '').trim().toUpperCase();

  if (!code) throw new HttpError(400, 'Invite code is required');

  const { data: invite, error } = await ctx.supabase.from('space_invites').select('*').eq('code', code).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!invite) throw new HttpError(404, 'Invite not found');
  if (invite.used_at) throw new HttpError(400, 'Invite has already been used');
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw new HttpError(400, 'Invite is expired');

  await ensureSpaceMember(ctx.supabase, invite.space_id, ctx.user.id, 'member');

  const { error: updateError } = await ctx.supabase
    .from('space_invites')
    .update({ used_by_user_id: ctx.user.id, used_at: new Date().toISOString() })
    .eq('id', invite.id);

  if (updateError) throw new HttpError(500, updateError.message);

  const { data: space, error: spaceError } = await ctx.supabase.from('spaces').select('*').eq('id', invite.space_id).single();
  if (spaceError) throw new HttpError(500, spaceError.message);

  return { space: { ...(space as Space), role: 'member' } };
}

async function removeMember(ctx: RouteContext, spaceId: string, userId: string) {
  const space = await assertOwner(ctx, spaceId);

  if (space.owner_user_id === userId) {
    throw new HttpError(400, 'Owner cannot be removed');
  }

  const { error } = await ctx.supabase.from('space_members').delete().eq('space_id', spaceId).eq('user_id', userId);
  if (error) throw new HttpError(500, error.message);

  return { ok: true };
}

async function getGroups(ctx: RouteContext, spaceId: string) {
  await assertMember(ctx, spaceId);

  const { data: groups, error } = await ctx.supabase
    .from('coupon_groups')
    .select('*')
    .eq('space_id', spaceId)
    .order('title', { ascending: true });

  if (error) throw new HttpError(500, error.message);

  const { data: coupons, error: couponsError } = await ctx.supabase
    .from('coupons')
    .select('group_id')
    .eq('space_id', spaceId)
    .eq('is_archived', false);

  if (couponsError) throw new HttpError(500, couponsError.message);

  const counts = new Map<string | null, number>();
  for (const coupon of coupons as Array<{ group_id: string | null }>) {
    counts.set(coupon.group_id, (counts.get(coupon.group_id) ?? 0) + 1);
  }

  return groups.map((group: { id: string }) => ({ ...group, coupons_count: counts.get(group.id) ?? 0 }));
}

async function createGroup(ctx: RouteContext, spaceId: string) {
  await assertMember(ctx, spaceId);
  const body = await readBody<{ title?: string }>(ctx.request);
  const title = validateTitle(body.title, 'Название группы');

  const { data, error } = await ctx.supabase
    .from('coupon_groups')
    .insert({ space_id: spaceId, title })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Group with this title already exists');
    throw new HttpError(500, error.message);
  }

  return data;
}

async function updateGroup(ctx: RouteContext, groupId: string) {
  const group = await getGroupOrFail(ctx, groupId);
  await assertMember(ctx, group.space_id);
  const body = await readBody<{ title?: string }>(ctx.request);
  const title = validateTitle(body.title, 'Название группы');

  const { data, error } = await ctx.supabase.from('coupon_groups').update({ title }).eq('id', groupId).select('*').single();

  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Group with this title already exists');
    throw new HttpError(500, error.message);
  }

  return data;
}

async function deleteGroup(ctx: RouteContext, groupId: string) {
  const group = await getGroupOrFail(ctx, groupId);
  await assertMember(ctx, group.space_id);

  const { error } = await ctx.supabase.from('coupon_groups').delete().eq('id', groupId);
  if (error) throw new HttpError(500, error.message);

  return { ok: true };
}

async function getCoupons(ctx: RouteContext, spaceId: string) {
  await assertMember(ctx, spaceId);

  const archivedParam = ctx.url.searchParams.get('archived');
  const groupId = ctx.url.searchParams.get('group_id');
  const favorite = ctx.url.searchParams.get('favorite');
  const search = ctx.url.searchParams.get('search');

  let query = ctx.supabase
    .from('coupons')
    .select('*')
    .eq('space_id', spaceId)
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false });

  if (archivedParam === null) {
    query = query.eq('is_archived', false);
  } else {
    query = query.eq('is_archived', archivedParam === 'true');
  }

  if (groupId === 'null') query = query.is('group_id', null);
  if (groupId && groupId !== 'null') query = query.eq('group_id', groupId);
  if (favorite === 'true') query = query.eq('is_favorite', true);
  if (search) query = query.or(`title.ilike.%${escapeLike(search)}%,qr_text.ilike.%${escapeLike(search)}%,note.ilike.%${escapeLike(search)}%`);

  const { data: coupons, error } = await query;
  if (error) throw new HttpError(500, error.message);

  return attachCouponCreators(ctx, coupons);
}

async function createCoupon(ctx: RouteContext, spaceId: string) {
  await assertMember(ctx, spaceId);
  const body = await readBody<Record<string, unknown>>(ctx.request);
  const payload = await validateCouponPayload(ctx, spaceId, body, false);

  const { data: duplicate, error: duplicateError } = await ctx.supabase
    .from('coupons')
    .select('*')
    .eq('space_id', spaceId)
    .eq('qr_text', payload.qr_text)
    .eq('is_archived', false)
    .maybeSingle();

  if (duplicateError) throw new HttpError(500, duplicateError.message);
  if (duplicate) throw new HttpError(409, 'Coupon already exists', { existing_coupon: duplicate });

  const { data, error } = await ctx.supabase
    .from('coupons')
    .insert({ ...payload, space_id: spaceId, created_by_user_id: ctx.user.id })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Coupon already exists');
    throw new HttpError(500, error.message);
  }

  const [coupon] = await attachCouponCreators(ctx, [data]);
  return coupon;
}

async function updateCoupon(ctx: RouteContext, couponId: string) {
  const coupon = await getCouponOrFail(ctx, couponId);
  await assertMember(ctx, coupon.space_id);
  const body = await readBody<Record<string, unknown>>(ctx.request);
  const payload = await validateCouponPayload(ctx, coupon.space_id, body, true);

  const { data, error } = await ctx.supabase.from('coupons').update(payload).eq('id', couponId).select('*').single();

  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Coupon already exists');
    throw new HttpError(500, error.message);
  }

  const [updated] = await attachCouponCreators(ctx, [data]);
  return updated;
}

async function deleteCoupon(ctx: RouteContext, couponId: string) {
  const coupon = await getCouponOrFail(ctx, couponId);
  await assertMember(ctx, coupon.space_id);

  const { error } = await ctx.supabase.from('coupons').delete().eq('id', couponId);
  if (error) throw new HttpError(500, error.message);

  return { ok: true };
}

async function attachCouponCreators(ctx: RouteContext, coupons: any[]) {
  const userIds = Array.from(new Set(coupons.map((coupon) => coupon.created_by_user_id).filter(Boolean)));
  if (userIds.length === 0) return coupons.map((coupon) => ({ ...coupon, created_by: null }));

  const { data: users, error } = await ctx.supabase.from('app_users').select('id, first_name, last_name, username').in('id', userIds);
  if (error) throw new HttpError(500, error.message);

  const usersById = new Map((users ?? []).map((user: { id: string }) => [user.id, user]));
  return coupons.map((coupon) => ({ ...coupon, created_by: usersById.get(coupon.created_by_user_id) ?? null }));
}

async function validateCouponPayload(ctx: RouteContext, spaceId: string, body: Record<string, unknown>, partial: boolean) {
  const payload: Record<string, unknown> = {};

  if (!partial || body.title !== undefined) payload.title = validateTitle(String(body.title ?? ''), 'Название купона');
  if (!partial || body.qr_text !== undefined) {
    const qrText = String(body.qr_text ?? '').trim();
    if (!qrText) throw new HttpError(400, 'QR string is required');
    payload.qr_text = qrText;
  }

  if (!partial || body.type !== undefined) {
    if (body.type !== 'qr' && body.type !== 'text') throw new HttpError(400, 'Coupon type must be qr or text');
    payload.type = body.type;
  }

  if (body.group_id !== undefined) {
    const groupId = body.group_id ? String(body.group_id) : null;

    if (groupId) {
      const group = await getGroupOrFail(ctx, groupId);
      if (group.space_id !== spaceId) throw new HttpError(400, 'Group belongs to another space');
    }

    payload.group_id = groupId;
  }

  if (body.note !== undefined) payload.note = body.note ? String(body.note).trim() : null;

  if (body.expires_at !== undefined) {
    const expiresAt = body.expires_at ? String(body.expires_at) : null;
    if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) throw new HttpError(400, 'expires_at must be YYYY-MM-DD');
    payload.expires_at = expiresAt;
  }

  if (body.is_favorite !== undefined) payload.is_favorite = Boolean(body.is_favorite);
  if (body.is_archived !== undefined) payload.is_archived = Boolean(body.is_archived);

  return payload;
}

async function getGroupOrFail(ctx: RouteContext, groupId: string) {
  const { data, error } = await ctx.supabase.from('coupon_groups').select('*').eq('id', groupId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, 'Group not found');
  return data as { id: string; space_id: string; title: string };
}

async function getCouponOrFail(ctx: RouteContext, couponId: string) {
  const { data, error } = await ctx.supabase.from('coupons').select('*').eq('id', couponId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, 'Coupon not found');
  return data as { id: string; space_id: string };
}

async function assertMember(ctx: RouteContext, spaceId: string): Promise<'owner' | 'member'> {
  const { data, error } = await ctx.supabase
    .from('space_members')
    .select('role')
    .eq('space_id', spaceId)
    .eq('user_id', ctx.user.id)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(403, 'No access to this space');

  return data.role as 'owner' | 'member';
}

async function assertOwner(ctx: RouteContext, spaceId: string): Promise<Space> {
  const role = await assertMember(ctx, spaceId);
  if (role !== 'owner') throw new HttpError(403, 'Owner role is required');

  const { data, error } = await ctx.supabase.from('spaces').select('*').eq('id', spaceId).single();
  if (error) throw new HttpError(500, error.message);

  return data as Space;
}

function validateTitle(value: unknown, fieldName: string): string {
  const title = String(value ?? '').trim();

  if (!title) throw new HttpError(400, `${fieldName} is required`);
  if (title.length > 120) throw new HttpError(400, `${fieldName} is too long`);

  return title;
}

function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((byte) => alphabet[byte % alphabet.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

function escapeLike(value: string): string {
  return value.replace(/[,%_]/g, '');
}

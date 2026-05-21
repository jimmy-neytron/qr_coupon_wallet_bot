export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function displayUserName(user?: { first_name?: string | null; last_name?: string | null; username?: string | null } | null): string {
  if (!user) return 'Неизвестно';
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return fullName || (user.username ? `@${user.username}` : 'Пользователь');
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Не указан';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function isExpired(value: string | null | undefined): boolean {
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(value) < today;
}

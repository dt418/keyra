import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';

dayjs.extend(relativeTime);
dayjs.extend(utc);

export function formatRelativeTime(date: string | Date): string {
  return dayjs(date).fromNow();
}

export function formatDate(date: string | Date, format = 'MMM D, YYYY'): string {
  return dayjs(date).format(format);
}

export function formatDateTime(date: string | Date, format = 'MMM D, YYYY h:mm A'): string {
  return dayjs(date).format(format);
}

export function formatExpiresAt(date: string | Date | null | undefined): string {
  if (!date) return 'Never';
  return dayjs(date).format('MMM D, YYYY');
}

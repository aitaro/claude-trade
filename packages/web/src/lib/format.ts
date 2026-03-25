import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return parseISO(value);
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return "";
  return format(d, "yyyy/MM/dd", { locale: ja });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return "";
  return format(d, "yyyy/MM/dd HH:mm", { locale: ja });
}

export function formatDateTimeFull(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return "";
  return format(d, "yyyy/MM/dd HH:mm:ss", { locale: ja });
}

export function formatTimeJST(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return "";
  return format(d, "HH:mm", { locale: ja });
}

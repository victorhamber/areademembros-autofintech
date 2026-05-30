import { Prisma } from '@prisma/client';

export function isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export function isPrismaUniqueViolation(error: unknown, field?: string): boolean {
  if (!isPrismaKnownError(error) || error.code !== 'P2002') return false;
  if (!field) return true;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.some((t) => String(t).includes(field));
  return String(target || '').includes(field);
}

/** Texto legível para logs/admin (código Prisma + campo). */
export function formatPrismaError(error: unknown): string {
  if (isPrismaKnownError(error)) {
    const target = error.meta?.target;
    const targetStr = Array.isArray(target) ? target.join(', ') : String(target || '');
    return `${error.code}${targetStr ? ` (${targetStr})` : ''}: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

import type { PrismaClient } from '@prisma/client';

export const SUPPORT_CONTACTS = [
  { provider: 'autofintech', url: 'https://go.trajettu.com/af-contato' },
  { provider: 'forexrendimento', url: 'https://go.trajettu.com/fx-contato' },
] as const;

export function normalizeClientIp(raw: string): string {
  let ip = String(raw || '').trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice('::ffff:'.length);
  return ip.slice(0, 45) || 'unknown';
}

export function contactAt(side: number) {
  const index = ((side % SUPPORT_CONTACTS.length) + SUPPORT_CONTACTS.length) % SUPPORT_CONTACTS.length;
  return SUPPORT_CONTACTS[index];
}

export async function assignSupportContact(prisma: PrismaClient, rawIp: string) {
  const ip = normalizeClientIp(rawIp);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT "id" FROM "OraculoSupportCursor" WHERE "id" = 1 FOR UPDATE`;
    const found = await tx.oraculoSupportVisit.findUnique({ where: { ip } });
    if (found) return found;
    const cursor = await tx.oraculoSupportCursor.findUnique({ where: { id: 1 } });
    const side = cursor?.nextSide ?? 0;
    const contact = contactAt(side);
    const created = await tx.oraculoSupportVisit.create({
      data: { ip, provider: contact.provider },
    });
    await tx.oraculoSupportCursor.update({
      where: { id: 1 },
      data: { nextSide: side + 1 },
    });
    return created;
  });
}

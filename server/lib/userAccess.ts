import type { PrismaClient } from '@prisma/client';

export async function userHasMemberAccess(prisma: PrismaClient, userId: string): Promise<boolean> {
  const n = await prisma.purchase.count({ where: { userId } });
  if (n > 0) return true;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  const email = user.email.toLowerCase().trim();
  const now = new Date();
  const lic = await prisma.license.findFirst({
    where: {
      email,
      statusLicenca: 'ativa',
      OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: now } }]
    }
  });
  return !!lic;
}

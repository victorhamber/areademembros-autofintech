import type { PrismaClient } from '@prisma/client';

export const DEV_TEST_EMAIL = 'teste@local.dev';
export const DEV_TEST_PASSWORD = 'TesteLocal123@';

/**
 * Garante usuário + compra mínimos para login local (sem precisar rodar seed manualmente).
 * Só roda fora de NODE_ENV=production.
 */
export async function ensureDevTestAccount(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;

  const cat = await prisma.category.upsert({
    where: { name: '_seed_local' },
    update: {},
    create: { name: '_seed_local' }
  });

  const content = await prisma.content.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {
      title: 'Conteúdo de teste (local)',
      description: 'Conteúdo mínimo para liberar login em desenvolvimento.'
    },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Conteúdo de teste (local)',
      author: 'Seed',
      description: 'Conteúdo mínimo para liberar login em desenvolvimento.',
      coverUrl: 'https://placehold.co/400x600/1a1a2e/3b82f6?text=Teste',
      pdfUrl: null,
      htmlUrl: null,
      salesUrl: 'https://example.com/checkout-teste',
      hotmartOffer: 'seed-local-offer',
      categoryId: cat.id,
      language: 'pt'
    }
  });

  const user = await prisma.user.upsert({
    where: { email: DEV_TEST_EMAIL },
    update: { password: DEV_TEST_PASSWORD, name: 'Usuário Teste' },
    create: {
      email: DEV_TEST_EMAIL,
      password: DEV_TEST_PASSWORD,
      name: 'Usuário Teste',
      country: 'BR'
    }
  });

  await prisma.purchase.upsert({
    where: { userId_contentId: { userId: user.id, contentId: content.id } },
    update: {},
    create: { userId: user.id, contentId: content.id }
  });
}

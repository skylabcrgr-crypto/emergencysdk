/**
 * db/prisma.ts
 * Singleton Prisma client.
 *
 * In serverless environments (Vercel), each function invocation may create a
 * new module scope. The globalThis guard prevents exhausting the connection
 * pool by re-using the same PrismaClient instance across hot reloads in dev
 * and across function invocations that share the same V8 isolate.
 *
 * Production: uses the transaction pooler URL (DATABASE_URL) which is
 * compatible with Vercel's ephemeral compute model.
 */

import { PrismaClient } from '@prisma/client';

// Extend globalThis to hold the prisma singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

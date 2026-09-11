import { PrismaClient } from '@prisma/client';

function configureDatabaseUrl(): void {
  if (process.env.VERCEL) {
    process.env.DATABASE_URL = 'file:/tmp/tax-form-layer.db';
    return;
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./dev.db';
  }
}

configureDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaReady?: Promise<void>;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

async function ensureSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Template" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "slug" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "latest" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Template_slug_key" ON "Template"("slug")`,
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TemplateVersion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "templateId" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "specVersion" TEXT NOT NULL,
      "document" TEXT NOT NULL,
      "message" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TemplateVersion_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "Template" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "TemplateVersion_templateId_version_key"
     ON "TemplateVersion"("templateId", "version")`,
  );
}

function ready(): Promise<void> {
  if (!globalForPrisma.prismaReady) {
    globalForPrisma.prismaReady = ensureSchema();
  }
  return globalForPrisma.prismaReady;
}

export interface StoredVersion {
  version: number;
  specVersion: string;
  message: string | null;
  createdAt: string;
}

export interface StoredTemplate {
  id: string;
  slug: string;
  title: string;
  latest: number;
}

const saveQueues = new Map<string, Promise<unknown>>();

function enqueueSave<T>(slug: string, task: () => Promise<T>): Promise<T> {
  const prev = saveQueues.get(slug) ?? Promise.resolve();
  const next = prev.then(task, task);
  saveQueues.set(
    slug,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

function isUniqueConflict(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}

async function persistVersion(input: {
  slug: string;
  title: string;
  specVersion: string;
  documentText: string;
  message?: string;
}): Promise<{ template: StoredTemplate; version: number }> {
  const existing = await prisma.template.findUnique({ where: { slug: input.slug } });

  if (!existing) {
    const created = await prisma.template.create({
      data: {
        slug: input.slug,
        title: input.title,
        latest: 1,
        versions: {
          create: {
            version: 1,
            specVersion: input.specVersion,
            document: input.documentText,
            message: input.message ?? 'Initial version',
          },
        },
      },
    });
    return {
      template: {
        id: created.id,
        slug: created.slug,
        title: created.title,
        latest: created.latest,
      },
      version: 1,
    };
  }

  const maxRow = await prisma.templateVersion.aggregate({
    where: { templateId: existing.id },
    _max: { version: true },
  });
  const nextVersion = Math.max(existing.latest, maxRow._max.version ?? 0) + 1;

  await prisma.$transaction([
    prisma.templateVersion.create({
      data: {
        templateId: existing.id,
        version: nextVersion,
        specVersion: input.specVersion,
        document: input.documentText,
        message: input.message ?? null,
      },
    }),
    prisma.template.update({
      where: { id: existing.id },
      data: { latest: nextVersion, title: input.title },
    }),
  ]);

  return {
    template: { id: existing.id, slug: existing.slug, title: input.title, latest: nextVersion },
    version: nextVersion,
  };
}

export async function saveTemplateVersion(input: {
  slug: string;
  title: string;
  specVersion: string;
  document: unknown;
  message?: string;
}): Promise<{ template: StoredTemplate; version: number }> {
  await ready();
  const documentText = JSON.stringify(input.document);

  return enqueueSave(input.slug, async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        return await persistVersion({
          slug: input.slug,
          title: input.title,
          specVersion: input.specVersion,
          documentText,
          ...(input.message ? { message: input.message } : {}),
        });
      } catch (err) {
        lastErr = err;
        if (!isUniqueConflict(err) && !(err instanceof Error && /unique/i.test(err.message))) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 15 * (attempt + 1)));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Could not save version');
  });
}

export async function listTemplates(): Promise<StoredTemplate[]> {
  await ready();
  const rows = await prisma.template.findMany({ orderBy: { updatedAt: 'desc' } });
  return rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, latest: r.latest }));
}

export async function listVersions(slug: string): Promise<StoredVersion[]> {
  await ready();
  const template = await prisma.template.findUnique({
    where: { slug },
    include: { versions: { orderBy: { version: 'desc' } } },
  });
  if (!template) return [];
  return template.versions.map((v) => ({
    version: v.version,
    specVersion: v.specVersion,
    message: v.message,
    createdAt: v.createdAt.toISOString(),
  }));
}

export async function getTemplateDocument(slug: string, version?: number): Promise<unknown | null> {
  await ready();
  const template = await prisma.template.findUnique({
    where: { slug },
    include: {
      versions: {
        where: version ? { version } : undefined,
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });
  const row = template?.versions[0];
  return row ? JSON.parse(row.document) : null;
}

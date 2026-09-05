import { PrismaClient } from '@prisma/client';

// Reuse a single PrismaClient across hot reloads in dev to avoid exhausting
// connections. The rest of the app talks to the small repository API below rather
// than to Prisma directly, so the storage engine can be swapped in one place.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

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

export async function saveTemplateVersion(input: {
  slug: string;
  title: string;
  specVersion: string;
  document: unknown;
  message?: string;
}): Promise<{ template: StoredTemplate; version: number }> {
  const documentText = JSON.stringify(input.document);

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
            document: documentText,
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

  const nextVersion = existing.latest + 1;
  await prisma.$transaction([
    prisma.templateVersion.create({
      data: {
        templateId: existing.id,
        version: nextVersion,
        specVersion: input.specVersion,
        document: documentText,
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

export async function listTemplates(): Promise<StoredTemplate[]> {
  const rows = await prisma.template.findMany({ orderBy: { updatedAt: 'desc' } });
  return rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, latest: r.latest }));
}

export async function listVersions(slug: string): Promise<StoredVersion[]> {
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

import { prisma } from '../db/prisma';
import { AppError } from '../utils/AppError';

export class SegmentService {
  public async getSegments() {
    const [segments, tags] = await Promise.all([
      prisma.segment.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.tag.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { contacts: true } } }
      })
    ]);
    return { segments, tags };
  }

  public async setTagContacts(tagId: string, contactIds: string[]) {
    const existingTag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!existingTag) {
      throw new AppError(`Tag avec l'ID ${tagId} non trouvé`, 404);
    }

    const uniqueIds = Array.from(new Set(contactIds || []));

    const tag = await prisma.$transaction(async (tx) => {
      const validContacts = await tx.contact.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true }
      });

      await tx.tagOnContact.deleteMany({ where: { tagId } });

      if (validContacts.length > 0) {
        await tx.tagOnContact.createMany({
          data: validContacts.map(contact => ({ tagId, contactId: contact.id }))
        });
      }

      return tx.tag.findUniqueOrThrow({
        where: { id: tagId },
        include: {
          contacts: { include: { contact: true } },
          _count: { select: { contacts: true } }
        }
      });
    });

    return tag;
  }

  public async createSegment(data: { name: string; description?: string; icon?: string; filters: any; userId?: string }) {
    if (!data.name) {
      throw new AppError('Le nom du segment est requis', 400);
    }
    const segment = await prisma.segment.create({
      data: {
        name: data.name,
        description: data.description || null,
        icon: data.icon || 'Filter',
        filters: data.filters || {},
        userId: data.userId || null
      }
    });
    return segment;
  }

  public async updateSegment(id: string, data: { name?: string; description?: string; icon?: string; filters?: any }) {
    const existing = await prisma.segment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(`Segment avec l'ID ${id} non trouvé`, 404);
    }

    const updated = await prisma.segment.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.icon && { icon: data.icon }),
        ...(data.filters && { filters: data.filters })
      }
    });
    return updated;
  }

  public async deleteSegment(id: string) {
    const existing = await prisma.segment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(`Segment avec l'ID ${id} non trouvé`, 404);
    }
    await prisma.segment.delete({ where: { id } });
    return { success: true };
  }
}

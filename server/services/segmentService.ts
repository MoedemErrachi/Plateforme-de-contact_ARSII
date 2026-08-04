import { prisma } from '../db/prisma';
import { AppError } from '../utils/AppError';

export class SegmentService {
  public async getSegments() {
    const [savedSegments, tags] = await Promise.all([
      prisma.savedSegment.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.tag.findMany({ orderBy: { name: 'asc' } })
    ]);
    return { savedSegments, tags };
  }

  public async createSegment(data: { name: string; description?: string; icon?: string; filters: any; userId?: string }) {
    if (!data.name) {
      throw new AppError('Le nom du segment est requis', 400);
    }
    const segment = await prisma.savedSegment.create({
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
    const existing = await prisma.savedSegment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(`Segment avec l'ID ${id} non trouvé`, 404);
    }

    const updated = await prisma.savedSegment.update({
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
    const existing = await prisma.savedSegment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(`Segment avec l'ID ${id} non trouvé`, 404);
    }
    await prisma.savedSegment.delete({ where: { id } });
    return { success: true };
  }
}

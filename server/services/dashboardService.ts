import { prisma } from '../db/prisma';

export class DashboardService {
  public async getDashboardStats() {
    const [totalContacts, activeProjects, totalExchangeNotes, countryGroup, actorTypeGroup, typeActeurs] = await Promise.all([
      prisma.contact.count(),
      prisma.project.count(),
      prisma.exchangeNote.count(),
      prisma.contact.groupBy({
        by: ['country'],
        _count: { id: true }
      }),
      prisma.contact.groupBy({
        by: ['actorType', 'actorTypeId'],
        _count: { id: true }
      }),
      prisma.typeActeur.findMany()
    ]);

    const totalCountries = countryGroup.length;
    const distributionByCountry = countryGroup.map(item => {
      const count = item._count.id;
      return {
        country: item.country || 'Inconnu',
        count,
        percentage: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0
      };
    });

    const typeActeurMap = new Map(typeActeurs.map(t => [t.id, t.name]));

    const distributionByTypeActeur = actorTypeGroup.map(item => {
      const count = item._count.id;
      const label = (item.actorTypeId && typeActeurMap.get(item.actorTypeId)) || item.actorType || 'Autre';
      return {
        typeActeur: label,
        count,
        percentage: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0
      };
    });

    return {
      kpis: {
        totalContacts,
        totalCountries,
        activeProjects,
        totalExchangeNotes
      },
      distributionByCountry,
      distributionByTypeActeur
    };
  }
}

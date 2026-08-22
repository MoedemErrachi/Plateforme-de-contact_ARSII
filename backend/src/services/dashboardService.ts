import { prisma } from '../config/prisma';

export class DashboardService {
  public async getDashboardStats() {
    const [totalContacts, countryGroup, genderGroup, careerStageGroup, tagGroup, countryGenderGroup] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.groupBy({
        by: ['countryOfOrigin'],
        _count: { id: true }
      }),
      prisma.contact.groupBy({
        by: ['gender'],
        _count: { id: true }
      }),
      prisma.contact.groupBy({
        by: ['researchCareerStage'],
        _count: { id: true }
      }),
      prisma.tagOnContact.groupBy({
        by: ['tagId'],
        _count: { _all: true }
      }),
      prisma.contact.groupBy({
        by: ['countryOfOrigin', 'gender'],
        _count: { id: true }
      })
    ]);

    const countriesCovered = countryGroup.length;

    const affiliationsGroup = await prisma.contact.groupBy({
      by: ['affiliation'],
      _count: { id: true }
    });
    const affiliationsCount = affiliationsGroup.filter(a => a.affiliation).length;

    const seniorStages = new Set(['R3_ESTABLISHED', 'R4_LEADING']);
    const seniorResearchers = careerStageGroup
      .filter(item => seniorStages.has(item.researchCareerStage))
      .reduce((sum, item) => sum + item._count.id, 0);

    const distributionByCountry = countryGroup.map(item => {
      const count = item._count.id;
      return {
        country: item.countryOfOrigin || 'Inconnu',
        count,
        percentage: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0
      };
    });

    const distributionByGender = genderGroup.map(item => {
      const count = item._count.id;
      return {
        gender: item.gender,
        count,
        percentage: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0
      };
    });

    const distributionByCareerStage = careerStageGroup.map(item => {
      const count = item._count.id;
      return {
        careerStage: item.researchCareerStage,
        count,
        percentage: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0
      };
    });

    const tagIds = tagGroup.map(t => t.tagId);
    const tagNameMap = new Map(
      (await prisma.tag.findMany({
        where: { id: { in: tagIds } },
        select: { id: true, name: true, color: true }
      })).map(t => [t.id, t])
    );

    const distributionByTag = tagGroup
      .map(item => {
        const tag = tagNameMap.get(item.tagId);
        return {
          tagId: item.tagId,
          name: tag?.name || 'Inconnu',
          color: tag?.color || '#35B8B2',
          count: item._count._all
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const distributionByCountryGender = countryGenderGroup.map(item => ({
      country: item.countryOfOrigin || 'Inconnu',
      gender: item.gender,
      count: item._count.id
    }));

    return {
      kpis: {
        totalContacts,
        countriesCovered,
        affiliationsCount,
        seniorResearchers: {
          count: seniorResearchers,
          percentage: totalContacts > 0 ? Math.round((seniorResearchers / totalContacts) * 100) : 0
        }
      },
      distributionByCountry,
      distributionByGender,
      distributionByCountryGender,
      distributionByCareerStage,
      distributionByTag
    };
  }
}

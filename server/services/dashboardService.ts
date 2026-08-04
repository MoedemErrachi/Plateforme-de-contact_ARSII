import { DataStore } from '../models/dataStore';

export class DashboardService {
  private db = DataStore.getInstance();

  public async getDashboardStats() {
    const contacts = this.db.contacts;
    const totalContacts = contacts.length;

    // Unique countries count & breakdown
    const countryCounts: Record<string, number> = {};
    contacts.forEach(c => {
      const country = c.country || 'Inconnu';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    const totalCountries = Object.keys(countryCounts).length;
    const distributionByCountry = Object.entries(countryCounts).map(([country, count]) => ({
      country,
      count,
      percentage: Math.round((count / totalContacts) * 100)
    }));

    // TypeActeur breakdown
    const typeActeurCounts: Record<string, number> = {};
    contacts.forEach(c => {
      const typeObj = this.db.typeActeurs.find(t => t.id === c.typeActeurId);
      const label = typeObj ? typeObj.label : 'Autre';
      typeActeurCounts[label] = (typeActeurCounts[label] || 0) + 1;
    });

    const distributionByTypeActeur = Object.entries(typeActeurCounts).map(([type, count]) => ({
      typeActeur: type,
      count,
      percentage: Math.round((count / totalContacts) * 100)
    }));

    const activeProjects = this.db.projects.length;

    return {
      kpis: {
        totalContacts,
        totalCountries,
        activeProjects,
        totalExchangeNotes: this.db.exchangeNotes.length
      },
      distributionByCountry,
      distributionByTypeActeur
    };
  }
}

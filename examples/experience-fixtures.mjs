/** Original synthetic workspaces. No settings or identifiers refer to an actual organization. */
export function makeExperienceFixture(department = 'finance') {
  if (!['finance', 'sales'].includes(department)) throw new Error('Unknown synthetic department.');
  const navigation = [
    { module: 'home', label: 'Home' }, { module: 'reports', label: 'Reports' },
    { module: 'data-explorer', label: 'Data Explorer' }, { module: 'knowledge', label: 'Knowledge' },
    { module: 'ask-iq', label: 'Ask IQ' }, { module: 'my-workspace', label: 'My Workspace' },
  ];
  const finance = department === 'finance';
  return {
    organization: {
      version: 'synthetic-org-v1',
      settings: {
        brandName: 'Aster · Enterprise IQ', helpRoute: '/knowledge/getting-started',
        themeAccent: 'navy', themeDensity: 'comfortable', navigation,
        landingPage: 'home', defaultReport: null, collectionResourceIds: [], contextualDocumentIds: [],
        reportPanels: ['definitions', 'documentation', 'freshness'],
        approvedActions: ['expand', 'save', 'chart', 'ask-iq', 'native-open'],
        savedViewDefault: 'source-default', dataExplorerEnabled: true, favorites: [], layout: 'report-first',
      },
      locks: ['brandName', 'helpRoute', 'approvedActions'],
    },
    team: {
      version: finance ? 'synthetic-finance-v2' : 'synthetic-sales-v3',
      settings: finance ? {
        navigation, landingPage: 'reports', defaultReport: 'finance-report',
        collectionResourceIds: ['finance-report', 'sales-report'],
        contextualDocumentIds: ['revenue-definition', 'close-note'],
        reportPanels: ['definitions', 'documentation', 'freshness', 'ask-iq'],
        savedViewDefault: 'summary', dataExplorerEnabled: true, layout: 'report-first',
      } : {
        navigation: [navigation[0], { module: 'reports', label: 'Sales scorecards' }, navigation[3], navigation[5]],
        landingPage: 'home', defaultReport: 'sales-report', collectionResourceIds: ['sales-report'],
        contextualDocumentIds: ['revenue-definition'], reportPanels: ['definitions', 'freshness'],
        savedViewDefault: 'detail', dataExplorerEnabled: false, layout: 'balanced',
      },
      locks: ['dataExplorerEnabled', 'collectionResourceIds'],
    },
    individual: {
      version: 'synthetic-preferences-v1',
      settings: { favorites: [finance ? 'finance-report' : 'sales-report'], themeDensity: 'compact' },
    },
    // Simulates a server-owned projection. Editing this in real code is not an identity system.
    access: {
      moduleIds: finance ? navigation.map(item => item.module) : ['home', 'reports', 'knowledge', 'my-workspace'],
      actionIds: finance ? ['expand', 'save', 'chart', 'ask-iq', 'native-open'] : ['expand', 'save', 'native-open'],
      reportIds: finance ? ['finance-report', 'sales-report'] : ['sales-report'],
      documentIds: finance ? ['revenue-definition', 'close-note'] : ['revenue-definition'],
    },
  };
}

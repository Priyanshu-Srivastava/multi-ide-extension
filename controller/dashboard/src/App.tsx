/**
 * GovernanceDashboard — Returns structured ROI data for rendering.
 * UI framework (React/Vue/etc.) can be added when the dashboard is built.
 */
export interface DashboardData {
  title: string;
  teams: { id: string; status: 'active' | 'inactive' }[];
}

export function buildDashboardData(teamIds: string[]): DashboardData {
  return {
    title: 'Omni IDE Governance ROI Dashboard',
    teams: teamIds.map((id) => ({ id, status: 'active' })),
  };
}

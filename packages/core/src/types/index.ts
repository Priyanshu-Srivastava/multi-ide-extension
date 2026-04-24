export type EnvironmentId = 'vscode' | 'jetbrains' | 'cursor';

export type TeamId = 'team-a' | 'team-b' | 'team-c' | 'team-d';

export interface OmniResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ToolManifest {
  toolId: string;
  teamId: TeamId;
  version: string;
  environments: EnvironmentId[];
}

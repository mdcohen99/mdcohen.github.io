
export interface CoachStint {
  coach: string;
  college: string;
  title: string;
  team_id: string;
  start_year: number;
  end_year: number | null; // null implies 'Present' or empty
  position_title_standardized: string;
  college_clean: string;
  category: string;
  team_state: string;
  conference: string;
  division: string;
  gender: string;
}

export interface FilterOptions {
  conference: string;
  division: string;
  gender: string;
  search: string;
}

export interface NetworkNode {
  id: string;
  group: number; // 0: Focus, 1: Mentor, 2: Protege, 3: Colleague
  radius: number;
  role: string;
}

export interface NetworkLink {
  source: string;
  target: string;
  value: number; // Strength of connection (years overlapped)
  school: string;
  type: string; // 'Mentor', 'Protege', 'Colleague'
}

export interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

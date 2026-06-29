import type { ReactNode } from 'react';

export type TabBarVariant = 'underline' | 'pill';

export interface TabItem {
  id: string;
  label: ReactNode;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  variant: TabBarVariant;
  className?: string;
}

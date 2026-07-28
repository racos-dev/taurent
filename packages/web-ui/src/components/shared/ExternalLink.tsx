import React, { createContext, useCallback, useContext } from 'react';

export interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

interface ExternalLinkContextValue {
  onNavigate: ((url: string) => void) | null;
}

const ExternalLinkContext = createContext<ExternalLinkContextValue>({ onNavigate: null });

export interface ExternalLinkProviderProps {
  onNavigate: (url: string) => void;
  children: React.ReactNode;
}

export const ExternalLinkProvider = React.memo(({ onNavigate, children }: ExternalLinkProviderProps) => {
  return (
    <ExternalLinkContext.Provider value={{ onNavigate }}>
      {children}
    </ExternalLinkContext.Provider>
  );
});

ExternalLinkProvider.displayName = 'ExternalLinkProvider';

export function useExternalLinkHandler(): ((url: string) => void) | null {
  return useContext(ExternalLinkContext).onNavigate;
}

export const ExternalLink = React.memo(({ href, children, className }: ExternalLinkProps) => {
  const onNavigate = useExternalLinkHandler();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onNavigate) return;
      e.preventDefault();
      onNavigate(href);
    },
    [href, onNavigate],
  );

  if (onNavigate) {
    return (
      <button type="button" onClick={handleClick} className={className}>
        {children}
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
});

ExternalLink.displayName = 'ExternalLink';

import React from 'react';
import { cn } from '@taurent/shared';
import { useContextMenu } from './useContextMenu';
import { SubMenuProvider } from './SubMenuProvider';
import { ContextMenuPanel } from './ContextMenuPanel';
import { ContextMenuItem } from './ContextMenuItem';
import { ContextMenuSeparator } from './ContextMenuSeparator';
import { ContextMenuGroup } from './ContextMenuGroup';
import { ContextMenuSubMenu } from './ContextMenuSubMenu';
import type {
  ContextMenuItem as TContextMenuItem,
  ContextMenuItemType,
  ContextMenuSeparatorType,
  ContextMenuGroupType,
  ContextMenuSubMenuType,
} from './types';

export interface ContextMenuProps {
  x: number;
  y: number;
  items: TContextMenuItem[];
  onClose: () => void;
  className?: string;
  width?: 'w-44' | 'w-48' | 'w-56' | 'w-72';
}

function isSeparator(item: TContextMenuItem): item is ContextMenuSeparatorType {
  return item.kind === 'separator';
}

function isGroup(item: TContextMenuItem): item is ContextMenuGroupType {
  return item.kind === 'group';
}

function isSubMenu(item: TContextMenuItem): item is ContextMenuSubMenuType {
  return item.kind === 'submenu';
}

function isNormalItem(item: TContextMenuItem): item is ContextMenuItemType {
  return item.kind === 'item';
}

function renderSubMenuChild(item: TContextMenuItem, onClose: () => void): React.ReactNode {
  if (isSeparator(item)) {
    return <ContextMenuSeparator key={item.id} label={item.label} />;
  }

  if (isGroup(item)) {
    return (
      <ContextMenuGroup key={item.id} label={item.label}>
        {item.items.map((child) => renderSubMenuChild(child, onClose))}
      </ContextMenuGroup>
    );
  }

  if (isSubMenu(item)) {
    return (
      <ContextMenuSubMenu
        key={item.id}
        label={item.label}
        icon={item.icon}
        disabled={item.disabled}
      >
        {item.children.map((child) => renderSubMenuChild(child, onClose))}
      </ContextMenuSubMenu>
    );
  }

  return (
    <ContextMenuItem
      key={item.id}
      id={item.id}
      active={false}
      icon={item.icon}
      label={item.label}
      shortcut={item.shortcut}
      disabled={item.disabled}
      destructive={item.destructive}
      onClick={() => {
        item.onClick();
        onClose();
      }}
    />
  );
}

/**
 * Top-level composed context menu component.
 * Wires the useContextMenu hook, SubMenuProvider, and ContextMenuPanel together,
 * then maps over the items array to render the appropriate item component.
 */
export function ContextMenu({ x, y, items, onClose, className, width = 'w-48' }: ContextMenuProps) {
  const {
    activeIndex,
    handlePanelBlur,
    panelPosition,
    panelRef,
    registerItemRef,
  } = useContextMenu({
    x,
    y,
    items,
    isItemDisabled: (item: TContextMenuItem) => {
      return item.kind === 'item' || item.kind === 'submenu' ? !!item.disabled : false;
    },
    onSelect: (item: TContextMenuItem) => {
      if (isNormalItem(item)) item.onClick();
    },
    onClose,
  });

  return (
    <SubMenuProvider>
      <ContextMenuPanel
        dataContextMenuType="menu"
        panelRef={panelRef}
        panelPosition={panelPosition}
        isOpen={true}
        onBlur={handlePanelBlur}
        className={cn(width, className)}
      >
        {items.map((item, index) => {
          const itemId = item.id;
          const isActive = index === activeIndex;
          const ref = registerItemRef(index);

          // ── separator ──────────────────────────────────────────────────────
          if (isSeparator(item)) {
            return <ContextMenuSeparator key={itemId} label={item.label} />;
          }

          // ── group ──────────────────────────────────────────────────────────
          if (isGroup(item)) {
            return (
              <ContextMenuGroup key={itemId} label={item.label}>
                {item.items.map((child) => {
                  const childId = child.id;

                  // submenu inside group
                  if (isSubMenu(child)) {
                    return (
                      <ContextMenuSubMenu
                        key={childId}
                        label={child.label}
                        icon={child.icon}
                        disabled={child.disabled}
                      >
                        {child.children.map((subChild) => renderSubMenuChild(subChild, onClose))}
                      </ContextMenuSubMenu>
                    );
                  }

                  // normal item inside group
                  if (isNormalItem(child)) {
                    return (
                      <ContextMenuItem
                        key={childId}
                        id={childId}
                        active={false}
                        icon={child.icon}
                        label={child.label}
                        shortcut={child.shortcut}
                        disabled={child.disabled}
                        destructive={child.destructive}
                        onClick={() => {
                          child.onClick();
                          onClose();
                        }}
                        ref={ref as React.Ref<HTMLButtonElement>}
                      />
                    );
                  }

                  // separator inside group
                  return <ContextMenuSeparator key={childId} label={child.label} />;
                })}
              </ContextMenuGroup>
            );
          }

          // ── submenu (top-level) ───────────────────────────────────────────
          if (isSubMenu(item)) {
            return (
              <ContextMenuSubMenu
                key={itemId}
                label={item.label}
                icon={item.icon}
                disabled={item.disabled}
              >
                {item.children.map((child) => renderSubMenuChild(child, onClose))}
              </ContextMenuSubMenu>
            );
          }

          // ── normal item ────────────────────────────────────────────────────
          return (
            <ContextMenuItem
              key={itemId}
              id={itemId}
              active={isActive}
              icon={item.icon}
              label={item.label}
              shortcut={item.shortcut}
              disabled={item.disabled}
              destructive={item.destructive}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              ref={ref as React.Ref<HTMLButtonElement>}
            />
          );
        })}
      </ContextMenuPanel>
    </SubMenuProvider>
  );
}

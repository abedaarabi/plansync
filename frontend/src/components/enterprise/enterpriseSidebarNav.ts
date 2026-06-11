import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  exact?: boolean;
  badge?: string;
};

export type SidebarNavSection = {
  id: string;
  title?: string;
  description?: string;
  items: SidebarNavItem[];
};

export function sidebarItemState<S extends SidebarNavSection, I extends SidebarNavItem>(
  section: S,
  item: I,
  isActive: (section: S, item: I) => boolean,
) {
  return {
    active: isActive(section, item),
    disabled: "disabled" in item && Boolean(item.disabled),
    sectionHeading: section.title?.trim(),
  };
}

export function sidebarRailLinkProps<S extends SidebarNavSection, I extends SidebarNavItem>(
  section: S,
  item: I,
  isActive: (section: S, item: I) => boolean,
  onNavClick: (e: MouseEvent, disabled: boolean, href: string) => void,
) {
  const { active, disabled, sectionHeading } = sidebarItemState(section, item, isActive);
  return {
    active,
    disabled,
    sectionHeading,
    Icon: item.icon,
    key: `${section.id}-${item.href}`,
    href: disabled ? "#" : item.href,
    onClick: (e: MouseEvent) => onNavClick(e, disabled, item.href),
  };
}

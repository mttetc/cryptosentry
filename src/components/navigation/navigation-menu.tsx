'use client';

import { useState } from 'react';
import { Menu, MenuItem, HoveredLink } from '@/components/ui/navbar-menu';

export function NavigationMenu() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <Menu setActive={setActive}>
      <MenuItem setActive={setActive} active={active} item="Features">
        <div className="flex flex-col space-y-4 text-sm">
          <HoveredLink href="/features/social">Social Monitoring</HoveredLink>
          <HoveredLink href="/features/price">Price Alerts</HoveredLink>
          <HoveredLink href="/features/notifications">Notifications</HoveredLink>
        </div>
      </MenuItem>
      <MenuItem setActive={setActive} active={active} item="Pricing">
        <div className="flex flex-col space-y-4 text-sm">
          <HoveredLink href="/pricing">Plans</HoveredLink>
          <HoveredLink href="/pricing/enterprise">Enterprise</HoveredLink>
        </div>
      </MenuItem>
      <MenuItem setActive={setActive} active={active} item="Resources">
        <div className="flex flex-col space-y-4 text-sm">
          <HoveredLink href="/blog">Blog</HoveredLink>
          <HoveredLink href="/docs">Documentation</HoveredLink>
        </div>
      </MenuItem>
    </Menu>
  );
}

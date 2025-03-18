// @ts-nocheck
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import cn from 'classnames';
import routes from '@/config/routes';
import ActiveLink from '@/components/ui/links/active-link';
import AnchorLink from '@/components/ui/links/anchor-link';
import { RangeIcon } from '@/components/icons/range-icon';
import { ExportIcon } from '@/components/icons/export-icon';
import { useBreakpoint } from '@/lib/hooks/use-breakpoint';
import { useIsMounted } from '@/lib/hooks/use-is-mounted';
import { fadeInBottom } from '@/lib/framer-motion/fade-in-bottom';
// dynamic import
const Listbox = dynamic(() => import('@/components/ui/list-box'));

// Separate admin and user menu items
const adminMenu = [
  { name: 'Initialize', value: routes.initialize },
  { name: 'Create Pool', value: routes.createPool },
  { name: 'Start Slow Withdrawal', value: routes.startSlowWithdraw },
  { name: 'Claim Slow Withdrawal', value: routes.claimSlowWithdraw },
  { name: 'Random Winner', value: routes.randomWinner },
];

const userMenu = [
  { name: 'Get Pools', value: routes.getPool },
  { name: 'Deposit', value: routes.deposit },
  { name: 'Withdraw', value: routes.withdraw },
];

function ActiveNavLink({ href, title, isActive, className }: any) {
  return (
    <ActiveLink
      href={href}
      className={cn(
        'relative z-[1] inline-flex items-center py-1.5 px-3',
        className
      )}
      activeClassName="font-medium text-white"
    >
      <span>{title}</span>
      {isActive && (
        <motion.span
          className="absolute left-0 right-0 bottom-0 -z-[1] h-full w-full rounded-lg bg-brand shadow-large"
          layoutId="activeNavLinkIndicator"
        />
      )}
    </ActiveLink>
  );
}

function TabButton({ title, isActive, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative z-[1] inline-flex items-center py-2 px-4 text-sm font-medium transition-colors',
        isActive
          ? 'text-white'
          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
      )}
    >
      <span>{title}</span>
      {isActive && (
        <motion.span
          className="absolute left-0 right-0 bottom-0 -z-[1] h-full w-full rounded-lg bg-brand shadow-large"
          layoutId="activeTabIndicator"
        />
      )}
    </button>
  );
}

export default function Base({ children }: React.PropsWithChildren<{}>) {
  const router = useRouter();
  const isMounted = useIsMounted();
  const breakpoint = useBreakpoint();
  const [activeView, setActiveView] = useState('user'); // Default to user view

  // Determine which menu to use based on the active view
  const currentMenu = activeView === 'admin' ? adminMenu : userMenu;

  // Find the current path in the active menu
  const currentPathIndex = currentMenu.findIndex(
    (item) => item.value === router.pathname
  );

  let [selectedMenuItem, setSelectedMenuItem] = useState(
    currentPathIndex !== -1 ? currentMenu[currentPathIndex] : currentMenu[0]
  );

  function handleRouteOnSelect(path: string) {
    router.push(path);
  }

  // Auto-detect the correct view based on the current route
  useEffect(() => {
    const isAdminRoute = adminMenu.some(item => item.value === router.pathname);
    const isUserRoute = userMenu.some(item => item.value === router.pathname);

    if (isAdminRoute) {
      setActiveView('admin');
    } else if (isUserRoute) {
      setActiveView('user');
    }

    // Update selected menu item
    const menu = isAdminRoute ? adminMenu : userMenu;
    const index = menu.findIndex(item => item.value === router.pathname);
    if (index !== -1) {
      setSelectedMenuItem(menu[index]);
    } else if (menu.length > 0) {
      setSelectedMenuItem(menu[0]);
    }
  }, [router.pathname]);

  return (
    <div className="pt-8 text-sm xl:pt-10">
      <div className="mx-auto w-full rounded-lg bg-white p-5 pt-4 shadow-card dark:bg-light-dark xs:p-6 xs:pt-5">
        {/* Tab navigation to switch between admin and user views */}
        <div className="mb-5 flex justify-center space-x-2 border-b border-dashed border-gray-200 pb-4 dark:">
          <TabButton
            title="User"
            isActive={activeView === 'user'}
            onClick={() => setActiveView('user')}
          />
          <TabButton
            title="Admin"
            isActive={activeView === 'admin'}
            onClick={() => setActiveView('admin')}
          />
        </div>

        <nav className="mb-5 min-h-[40px] border-b border-dashed border-gray-200 pb-4 uppercase tracking-wider dark: xs:mb-6 xs:pb-5 xs:tracking-wide">
          {isMounted && ['xs'].indexOf(breakpoint) !== -1 && (
            <Listbox
              options={currentMenu}
              selectedOption={selectedMenuItem}
              onChange={setSelectedMenuItem}
              onSelect={(path) => handleRouteOnSelect(path)}
              className="w-full"
            >
              <AnchorLink
                href={routes.charts}
                className="inline-flex items-center justify-between gap-1.5 rounded-md px-3 py-2 text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700/70"
              >
                Charts
                <ExportIcon className="h-auto w-2.5" />
              </AnchorLink>
              <button className="inline-flex items-center justify-between gap-1.5 rounded-md px-3 py-2 uppercase text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700/70">
                Settings
                <RangeIcon className="h-auto w-3" />
              </button>
            </Listbox>
          )}
          <div className="hidden items-center justify-between text-gray-600 dark:text-gray-400 sm:flex">
            {currentMenu.map((item) => (
              <ActiveNavLink
                key={item.name}
                href={item.value}
                title={item.name}
                isActive={item.value === router.pathname}
              />
            ))}
          </div>
        </nav>
        <AnimatePresence exitBeforeEnter>
          <motion.div
            initial="exit"
            animate="enter"
            exit="exit"
            variants={fadeInBottom('easeIn', 0.25)}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import cn from 'classnames';
import Logo from '@/components/ui/logo';
import { WalletMultiButton } from '@demox-labs/aleo-wallet-adapter-reactui';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';

require('@demox-labs/aleo-wallet-adapter-reactui/dist/styles.css');

type ViewType = 'admin' | 'user';

function HeaderTabs() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<ViewType>('user');

  // Auto-detect if we're on an admin or user route
  useEffect(() => {
    // Define admin and user routes
    const adminRoutes = ['/initialize', '/createPool', '/startSlowWithdraw', '/claimSlowWithdraw', '/randomWinner'];
    const userRoutes = ['/getPool', '/deposit', '/withdraw'];

    if (adminRoutes.includes(router.pathname)) {
      setActiveView('admin');
    } else if (userRoutes.includes(router.pathname)) {
      setActiveView('user');
    }
  }, [router.pathname]);

  const handleTabClick = (view: ViewType) => {
    setActiveView(view);
    // Redirect to the first page in that view
    if (view === 'admin') {
      router.push('/initialize');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex overflow-hidden rounded-lg bg-white/10 p-1 backdrop-blur-md ml-12">
      <button
        onClick={() => handleTabClick('user')}
        className={cn(
          'relative px-4 py-1.5 text-sm font-medium transition-colors',
          activeView === 'user'
            ? 'bg-white text-black rounded-md'
            : 'text-white hover:bg-white/10 rounded-md'
        )}
      >
        Users
      </button>
      <button
        onClick={() => handleTabClick('admin')}
        className={cn(
          'relative px-4 py-1.5 text-sm font-medium transition-colors',
          activeView === 'admin'
            ? 'bg-white text-black rounded-md'
            : 'text-white hover:bg-white/10 rounded-md'
        )}
      >
        Admin
      </button>
    </div>
  );
}

// Custom styled wallet button
function StyledWalletButton() {
  const { publicKey, connected } = useWallet();

  return (
    <div className="flex">
      <WalletMultiButton
        className="rounded-md bg-white hover:bg-gray-100 transition-colors font-medium"
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          border: 'none',
          minWidth: 'auto',
          height: 'auto',
          lineHeight: 'normal',
          color: 'black'
        }}
      />
      {/* Add custom styling to overcome any default styling issues */}
      <style jsx global>{`
        .wallet-adapter-button {
          color: black !important;
          background-color: white !important;
        }
        .wallet-adapter-button-trigger {
          background-color: white !important;
        }
        .wallet-adapter-button:not([disabled]):hover {
          background-color: #f3f4f6 !important;
        }
      `}</style>
    </div>
  );
}

export function Header() {
  return (
    <nav className="fixed top-0 z-30 flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-8 xl:px-10 3xl:px-12">
      <div className="flex items-center">
        <Logo />
      </div>

      <HeaderTabs />

      <div className="flex items-center">
        <StyledWalletButton />
      </div>
    </nav>
  );
}

interface DashboardLayoutProps {
  contentClassName?: string;
}

export default function Layout({
  children,
  contentClassName,
}: React.PropsWithChildren<DashboardLayoutProps>) {
  return (
    <div className="flex min-h-screen flex-col bg-[#061326] text-white">
      <Header />
      <main
        className={cn(
          'flex flex-grow flex-col ',
          contentClassName
        )}
      >
        {children}
      </main>
    </div>
  );
}

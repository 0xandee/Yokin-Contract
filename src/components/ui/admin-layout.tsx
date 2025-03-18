import { useRouter } from 'next/router';
import { useState, useEffect, ReactNode, Suspense } from 'react';
import Link from 'next/link';
import cn from 'classnames';
import { WalletMultiButton } from '@demox-labs/aleo-wallet-adapter-reactui';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import Aurora from './Aurora';

require('@demox-labs/aleo-wallet-adapter-reactui/dist/styles.css');

interface AdminLayoutProps {
    children: ReactNode;
    title?: string;
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

export default function AdminLayout({ children, title }: AdminLayoutProps) {
    const router = useRouter();
    const currentPath = router.pathname;

    // Admin navigation items
    const adminNavItems = [
        { name: 'INITIALIZE', path: '/initialize' },
        { name: 'CREATE POOL', path: '/createPool' },
        { name: 'START SLOW WITHDRAWAL', path: '/startSlowWithdraw' },
        { name: 'CLAIM SLOW WITHDRAWAL', path: '/claimSlowWithdraw' },
        { name: 'RANDOM WINNER', path: '/randomWinner' },
    ];

    return (
        <div className="relative min-h-screen">
            {/* Dither container with height set to 1/3 of viewport height */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden bg-gradient-to-b from-[#000000] to-[#131313]">
                <Suspense fallback={null}>
                    <Aurora
                        // colorStops={["#393E46", "#929AAB", "#EEEEEE"]}
                        colorStops={["#CDFEBC", "#FFDF94", "#FFE3FC"]}
                        blend={1}
                        amplitude={0.1}
                        speed={4}
                    />
                </Suspense>
            </div>
            <div className="relative z-10">

                <div className="max-h-screen text-white">
                    {/* Admin navigation */}
                    <div className="container mx-auto px-4 pt-24">
                        {/* Admin function buttons */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 border-gray-800">
                            {adminNavItems.map((item) => (
                                <Link href={item.path} key={item.path}>
                                    <a className={cn(
                                        'text-center py-3 px-4 text-sm font-medium uppercase tracking-wider transition-colors rounded-full',
                                        currentPath === item.path
                                            ? 'bg-white text-black'
                                            : ' text-white hover:bg-[#ffffff19]'
                                    )}>
                                        {item.name}
                                    </a>
                                </Link>
                            ))}
                        </div>

                        {/* Page title */}
                        {/* {title && (
                    <h1 className="text-2xl font-bold mb-6 text-center">{title}</h1>
                )} */}

                        {/* Page content */}
                        <div className="p-8 rounded-lg">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

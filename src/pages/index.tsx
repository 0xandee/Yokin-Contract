import type { NextPageWithLayout } from '@/types';
import { NextSeo } from 'next-seo';
import DashboardLayout from '@/layouts/dashboard/_dashboard';
import routes from '@/config/routes';
import { useRouter } from 'next/router';
import { useState, useEffect, Suspense, useRef } from 'react';
import useSWR from 'swr';
import { getAllPoolDetails, getLatestPoolDetails, parseMicrocreditsToCredits, parseTimestampToDate } from '@/aleo/rpc';
import { NullAddress } from '@/aleo/program';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/modal';
import DepositForm from '@/components/forms/DepositForm';
import WithdrawForm from '@/components/forms/WithdrawForm';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';

// Dynamically import Aurora to prevent SSR issues
const Aurora = dynamic(() => import('@/components/ui/Aurora'), {
  ssr: false,
  loading: () => null,
});

interface Pool {
  pool_id: number;
  total_deposit: number;
  total_paleo: number;
  total_players: number;
  reward: number;
  deposit_deadline_timestamp: number;
  withdrawal_start_timestamp: number;
  deposit_deadline_block: number;
  withdrawal_start_block: number;
  winner: string;
}

const HeroSection = () => {
  const router = useRouter();

  const handleScrollToAvailablePools = () => {
    // Use hash-based navigation
    document.getElementById('available-pools')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(60vh)] px-4 relative">
      <h1 className="text-4xl md:text-5xl lg:text-6xl text-center text-white leading-tight mb-8 pt-24">
        No-loss Raffles
        <br />
        <b>Win up to thousands of ALEO!</b>
      </h1>
      <button
        onClick={handleScrollToAvailablePools}
        className="px-6 py-3 rounded-md bg-white text-black font-medium hover:bg-gray-100 transition-colors"
      >
        Join Raffle
      </button>
    </div>
  );
};

const PoolCard = ({ pool }: { pool: Pool }) => {
  const router = useRouter();
  const { publicKey } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  // Calculate time remaining before deposit deadline
  const now = new Date();
  const deadline = parseTimestampToDate(pool.deposit_deadline_timestamp);

  // Calculate time remaining in milliseconds
  const timeRemaining = Math.max(0, deadline.getTime() - now.getTime());

  // Calculate days, hours, and minutes
  const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  // Check if deadline has passed
  const isActive = timeRemaining > 0;

  // Format time remaining string
  let timeRemainingStr = "Closed";

  if (isActive) {
    if (daysRemaining > 0) {
      timeRemainingStr = `${daysRemaining}d ${hoursRemaining}h`;
    } else if (hoursRemaining > 0) {
      timeRemainingStr = `${hoursRemaining}h ${minutesRemaining}m`;
    } else {
      timeRemainingStr = `${minutesRemaining}m`;
    }
  }

  const handleDepositClick = () => {
    if (!publicKey) {
      return;
    }

    setActiveTab('deposit');
    setModalOpen(true);
  };

  const handleWithdrawClick = () => {
    if (!publicKey) {
      return;
    }

    setActiveTab('withdraw');
    setModalOpen(true);
  };

  return (
    <>
      <div className="bg-black/20 backdrop-blur-sm rounded-lg p-6 hover:bg-black/40 transition-colors h-full shadow-xl border border-white/5">
        <div className="flex justify-between items-start">
          <h3 className="text-2xl font-bold text-white">Pool #{pool.pool_id}</h3>
          <div className={`px-4 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
            {isActive ? 'Active' : 'Closed'}
          </div>
        </div>

        <div className="space-y-4 my-8">
          <div className="flex justify-between">
            <span className="text-gray-300 text-base">Total Deposit</span>
            <span className="text-white font-medium text-base">{parseMicrocreditsToCredits(pool.total_deposit)} ALEO</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300 text-base">Participants</span>
            <span className="text-white font-medium text-base">{pool.total_players}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300 text-base">APY</span>
            <span className="text-white font-medium text-base">~10%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300 text-base">Yield Source</span>
            <span className="text-white font-medium text-base">Pondo</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-300 text-base">Time Remaining</span>
            <span className="text-white font-medium text-base">{timeRemainingStr}</span>
          </div>
        </div>

        {/* Show only deposit button when active, only withdraw button when closed */}
        <div>
          {isActive ? (
            <button
              onClick={handleDepositClick}
              className="w-full py-3 rounded-md text-base font-medium transition-colors bg-white text-black hover:bg-gray-100 cursor-pointer"
            >
              Deposit
            </button>
          ) : (
            <button
              onClick={handleWithdrawClick}
              className="w-full py-3 rounded-md text-base font-medium transition-colors bg-white text-black hover:bg-gray-100"
            >
              Withdraw
            </button>
          )}
        </div>

        {/* Display winner info below the button if there is a winner */}
        {!isActive && pool.winner !== NullAddress && (
          <div className="mt-6 text-center">
            <div className="text-gray-400 text-base mb-2">Winner</div>
            <div className="text-white text-base truncate">{pool.winner}</div>
          </div>
        )}
      </div>

      {/* Modal without tabs - show only the relevant form based on pool status */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
        }}
        title={`Pool #${pool.pool_id}`}
        size="md"
      >
        {isActive ? (
          <DepositForm poolId={pool.pool_id} onClose={() => setModalOpen(false)} />
        ) : (
          <WithdrawForm poolId={pool.pool_id} onClose={() => setModalOpen(false)} />
        )}
      </Modal>
    </>
  );
};

const PoolsSection = () => {
  // Blacklist array of pool IDs that should not be displayed
  const blacklistedPoolIds = [13];

  // First fetch only the latest pool for faster loading
  const { data: latestPoolDetails, error: latestPoolError, isLoading: isLoadingLatest } =
    useSWR('latestPoolDetails', () => getLatestPoolDetails());

  // State for all pools (will be loaded later)
  const [isLoadingAllPools, setIsLoadingAllPools] = useState(false);
  const [allPoolsLoaded, setAllPoolsLoaded] = useState(false);
  const [openPools, setOpenPools] = useState<Pool[]>([]);
  const [closedPools, setClosedPools] = useState<Pool[]>([]);
  const [showClosedPools, setShowClosedPools] = useState(false);

  // Process the latest pool when it's loaded
  useEffect(() => {
    if (latestPoolDetails) {
      const now = new Date();
      const open: Pool[] = [];
      const closed: Pool[] = [];

      latestPoolDetails.forEach((pool: Pool) => {
        // Skip blacklisted pools
        if (blacklistedPoolIds.includes(pool.pool_id)) {
          return;
        }

        const deadline = parseTimestampToDate(pool.deposit_deadline_timestamp);
        const timeRemaining = deadline.getTime() - now.getTime();

        if (timeRemaining > 0) {
          open.push(pool);
        } else {
          closed.push(pool);
        }
      });

      setOpenPools(open);
      setClosedPools(closed);
    }
  }, [latestPoolDetails]);

  // Function to load all pools
  const loadAllPools = async () => {
    if (allPoolsLoaded || isLoadingAllPools) return;

    setIsLoadingAllPools(true);
    try {
      const allPools = await getAllPoolDetails();

      const now = new Date();
      const open: Pool[] = [];
      const closed: Pool[] = [];

      allPools.forEach((pool: Pool) => {
        // Skip blacklisted pools
        if (blacklistedPoolIds.includes(pool.pool_id)) {
          return;
        }

        const deadline = parseTimestampToDate(pool.deposit_deadline_timestamp);
        const timeRemaining = deadline.getTime() - now.getTime();

        if (timeRemaining > 0) {
          open.push(pool);
        } else {
          closed.push(pool);
        }
      });

      setOpenPools(open);
      setClosedPools(closed);
      setAllPoolsLoaded(true);
    } catch (error) {
      console.error("Error loading all pools:", error);
    } finally {
      setIsLoadingAllPools(false);
    }
  };

  // Load all pools when user clicks to show closed pools
  const handleLoadClosedPools = () => {
    if (!allPoolsLoaded) {
      loadAllPools();
    }
    setShowClosedPools(true);
  };

  return (
    <div className="relative container mx-auto px-6 py-12 backdrop-blur-sm bg-black/20 rounded-lg my-12">
      {/* Open Pools Section with scroll-margin-top to add space when scrolled to */}
      <h2
        id="available-pools"
        className="text-3xl font-bold text-white mb-12 text-center scroll-mt-32"
      >
        Available Pools
      </h2>

      {isLoadingLatest && (
        <div className="flex justify-center py-16">
          <div className="animate-pulse text-white text-base">Loading pools...</div>
        </div>
      )}

      {latestPoolError && (
        <div className="text-red-500 text-center mb-12 text-base">
          Error loading pools. Please try again later.
        </div>
      )}

      {!isLoadingLatest && openPools.length === 0 && (
        <div className="text-gray-400 text-center mb-16 py-10 text-base">
          No open pools available at the moment.
        </div>
      )}

      {openPools.length > 0 && (
        <div className="flex flex-wrap justify-center gap-12 mb-16">
          {openPools.map((pool) => (
            <div key={pool.pool_id} className="w-full md:w-[calc(50%-24px)] lg:w-[calc(33.333%-32px)]">
              <PoolCard pool={pool} />
            </div>
          ))}
        </div>
      )}

      {/* Closed Pools Section */}
      <div className="mt-32 border-t border-white/10 pt-12">
        <h2 className="text-3xl font-bold text-white mb-10 text-center">Closed Pools</h2>

        {!showClosedPools && (
          <div className="flex justify-center mb-12">
            <button
              onClick={handleLoadClosedPools}
              className="px-8 py-4 rounded-md bg-white/10 text-white text-md font-medium hover:bg-white/20 transition-colors"
            >
              {isLoadingAllPools ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading Pools...
                </span>
              ) : (
                `Show Closed Pools`
              )}
            </button>
          </div>
        )}

        {showClosedPools && isLoadingAllPools && (
          <div className="flex justify-center py-8">
            <div className="animate-pulse text-white text-base">Loading all pools...</div>
          </div>
        )}

        {showClosedPools && !isLoadingAllPools && closedPools.length === 0 && (
          <div className="text-gray-400 text-center py-8 text-base">
            No closed pools to display.
          </div>
        )}

        {showClosedPools && !isLoadingAllPools && closedPools.length > 0 && (
          <div className="flex flex-wrap justify-center gap-12">
            {closedPools.map((pool) => (
              <div key={pool.pool_id} className="w-full md:w-[calc(50%-24px)] lg:w-[calc(33.333%-32px)]">
                <PoolCard pool={pool} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const IndexPage: NextPageWithLayout = () => {
  return (
    <>
      <NextSeo
        title="Yokin | No-loss Prize Game"
        description="No-loss Raffles Win up to thousands of Aleo!"
      />
      <div className="relative min-h-screen ">
        {/* Dither container with height set to 1/3 of viewport height */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden bg-gradient-to-b from-[#FFE3FC] to-[#b19daf]">
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
          <HeroSection />
          <PoolsSection />
        </div>
      </div>
    </>
  );
};

IndexPage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default IndexPage;
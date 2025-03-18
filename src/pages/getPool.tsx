import { useState, useEffect } from 'react';
import type { NextPageWithLayout } from '@/types';
import { NextSeo } from 'next-seo';
import DashboardLayout from '@/layouts/dashboard/_dashboard';
import Base from '@/components/ui/base';
import { ProgramId, PoolId, NullAddress } from '@/aleo/program';
import useSWR from 'swr';
import { getPoolDetails, getPoolCount, getAllPoolDetails, parseMicrocreditsToCredits, parseTimestampToDate, getHeight } from '@/aleo/rpc';

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

const PoolsPage: NextPageWithLayout = () => {
  const { data: allPoolDetails, error, isLoading } = useSWR('allPoolDetails', () => getAllPoolDetails());
  const [pools, setPools] = useState<Pool[]>([]);

  useEffect(() => {
    if (allPoolDetails) {
      setPools(allPoolDetails);
    }
    console.log(allPoolDetails);
  }, [allPoolDetails]);

  return (
    <>
      <NextSeo title="Pools" description="List of Pools" />
      <Base>
        <h1 className="text-2xl font-bold mb-6">Pools</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pools.map((pool) => (
            <div key={pool.pool_id} className="bg-[#0d1321] shadow-md rounded-lg p-4 cursor-pointer">
              <h2 className="text-xl font-semibold mb-2">Pool ID: {pool.pool_id}</h2>
              <ul className="text-sm space-y-1">
                <li>
                  <strong>Total Deposit:</strong> {parseMicrocreditsToCredits(pool.total_deposit)} ALEO
                </li>
                <li>
                  <strong>Total Players:</strong> {pool.total_players}
                </li>
                <li>
                  <strong>Deposit Deadline Timestamp:</strong> {String(parseTimestampToDate(pool.deposit_deadline_timestamp))}
                </li>
                <li>
                  <strong>Estimated Withdrawal Start Timestamp:</strong> {String(parseTimestampToDate(pool.withdrawal_start_timestamp))}
                </li>
                <li>
                  <strong>APY:</strong> ~10%
                </li>
                <li>
                  <strong>Yield Source:</strong> Pondo
                </li>
                <li>
                  <strong>Winner:</strong> {pool.winner === NullAddress ? 'No winner yet' : pool.winner}
                </li>
              </ul>
            </div>
          ))}
        </div>
      </Base>
    </>
  );
};

PoolsPage.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default PoolsPage;
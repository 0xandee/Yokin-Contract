import { useState, useEffect, ChangeEvent } from 'react';
import type { NextPageWithLayout } from '@/types';
import { NextSeo } from 'next-seo';
import DashboardLayout from '@/layouts/dashboard/_dashboard';
import AdminLayout from '@/components/ui/admin-layout';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter-leo';
import Button from '@/components/ui/button';
import {
  Transaction,
  WalletAdapterNetwork,
  WalletNotConnectedError,
} from '@demox-labs/aleo-wallet-adapter-base';
import { ProgramId } from '@/aleo/program';

function tryParseJSON(input: string): string | object {
  try {
    return JSON.parse(input);
  } catch (error) {
    return input;
  }
}

const CreatePool: NextPageWithLayout = () => {
  const { wallet, publicKey } = useWallet();

  // Function to format date in local timezone for datetime-local input
  const toLocalISOString = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  let [programId, setProgramId] = useState(ProgramId);
  let [functionName, setFunctionName] = useState('create_pool_public');
  let [currentTimestamp, setCurrentTimestamp] = useState<number | undefined>(
    Date.now()
  );
  let [depositDeadlineTimestamp, setDepositDeadlineTimestamp] =
    useState<number | undefined>(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
  let [withdrawDeadlineTimestamp, setWithdrawDeadlineTimestamp] =
    useState<number | undefined>(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
  let [fee, setFee] = useState<number | undefined>(0.1);
  let [transactionId, setTransactionId] = useState<string | undefined>();
  let [status, setStatus] = useState<string | undefined>();

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (transactionId) {
      intervalId = setInterval(() => {
        getTransactionStatus(transactionId!);
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [transactionId]);

  const handleSubmit = async (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publicKey) throw new WalletNotConnectedError();

    const aleoTransaction = Transaction.createTransaction(
      publicKey,
      'mainnet',
      programId,
      functionName,
      [Math.floor(currentTimestamp! / 1000) + "u32", Math.floor(depositDeadlineTimestamp! / 1000) + "u32", Math.floor(withdrawDeadlineTimestamp! / 1000) + "u32"],
      Math.floor(fee! * 1_000_000)!,
      false
    );

    console.log(aleoTransaction);

    const txId =
      (await (wallet?.adapter as LeoWalletAdapter).requestTransaction(
        aleoTransaction
      )) || '';
    setTransactionId(txId);

    console.log("txId", txId);
  };

  const getTransactionStatus = async (txId: string) => {
    const status = await (
      wallet?.adapter as LeoWalletAdapter
    ).transactionStatus(txId);
    setStatus(status);
  };

  return (
    <>
      <NextSeo
        title="Create Pool"
        description="Create a new pool in Yokin"
      />
      <AdminLayout title="Create Pool">
        <form
          noValidate
          role="search"
          onSubmit={handleSubmit}
          className="relative flex w-full flex-col md:w-auto"
        >
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Program ID
                </label>
                <input
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-black/10 py-3 px-4 text-gray-100 outline-none transition-all focus:border-white"
                  placeholder="credits.aleo"
                  onChange={(event) => setProgramId(event.currentTarget.value)}
                  value={programId}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Function Name
                </label>
                <input
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-black/10 py-3 px-4 text-gray-100 outline-none transition-all focus:border-white"
                  placeholder="create_pool_public"
                  onChange={(event) => setFunctionName(event.currentTarget.value)}
                  value={functionName}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Timestamp UTC
                </label>
                <input
                  type="datetime-local"
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-black/10 py-3 px-4 text-gray-100 outline-none transition-all focus:border-white"
                  placeholder="dd/mm/yyyy hh:mm"
                  onChange={(event) =>
                    setCurrentTimestamp(new Date(event.currentTarget.value).getTime())
                  }
                  value={
                    currentTimestamp
                      ? toLocalISOString(new Date(currentTimestamp))
                      : ''
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Deposit Deadline UTC
                </label>
                <input
                  type="datetime-local"
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-black/10 py-3 px-4 text-gray-100 outline-none transition-all focus:border-white"
                  placeholder="dd/mm/yyyy hh:mm"
                  onChange={(event) => {
                    // Create a date in UTC
                    const localDate = new Date(event.currentTarget.value);
                    // Convert to UTC timestamp
                    setDepositDeadlineTimestamp(localDate.getTime());

                    // Automatically set withdrawable time to be 36 hours after deposit deadline
                    setWithdrawDeadlineTimestamp(localDate.getTime() + (36 * 60 * 60 * 1000));
                  }}
                  value={
                    depositDeadlineTimestamp
                      ? toLocalISOString(new Date(depositDeadlineTimestamp))
                      : ''
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Withdrawable Time UTC (36 hours after deposit deadline)
                </label>
                <input
                  type="datetime-local"
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-black/10 py-3 px-4 text-gray-100 outline-none transition-all focus:border-white"
                  placeholder="dd/mm/yyyy hh:mm"
                  onChange={(event) => {
                    // Create a date in UTC
                    const localDate = new Date(event.currentTarget.value);
                    // Convert to UTC timestamp
                    setWithdrawDeadlineTimestamp(localDate.getTime());
                  }}
                  value={
                    withdrawDeadlineTimestamp
                      ? toLocalISOString(new Date(withdrawDeadlineTimestamp))
                      : ''
                  }
                />
                <p className="text-xs text-gray-400 mt-1">
                  This is automatically set to 36 hours after the deposit deadline.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fee (ALEO)
                </label>
                <input
                  type="number"
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-black/10 py-3 px-4 text-gray-100 outline-none transition-all focus:border-white"
                  placeholder="Fee (in credits)"
                  onChange={(event) => {
                    const parsed = parseFloat(event.target.value);
                    setFee(!Number.isNaN(parsed) ? parsed : undefined);
                  }}
                  value={fee ?? ''}
                />
              </div>
            </div>

            {transactionId && (
              <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-lg mt-4">
                <p className="text-sm text-blue-300">Transaction ID: {transactionId}</p>
                <p className="text-sm text-blue-300 mt-2">Status: {status || 'Processing...'}</p>
              </div>
            )}

            <div className="">
              <button
                type="submit"
                className="w-full py-4 rounded-md text-lg font-medium transition-colors bg-white text-black hover:bg-gray-100 disabled:bg-white/30 disabled:text-white/50 disabled:cursor-not-allowed"
                disabled={!publicKey || !programId || !functionName || fee === undefined}
              >
                {!publicKey ? 'Connect Your Wallet' : 'Create Pool'}
              </button>
            </div>
          </div>
        </form>
      </AdminLayout>
    </>
  );
};

CreatePool.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default CreatePool;

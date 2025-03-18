import * as Aleo from '@demox-labs/aleo-sdk';
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
import { PoolId, ProgramAddress, ProgramId } from '@/aleo/program';
import { getWithdrawalState, parseMicrocreditsToCredits, getHeight } from '@/aleo/rpc';

function tryParseJSON(input: string): string | object {
  try {
    return JSON.parse(input);
  } catch (error) {
    return input;
  }
}

const ClaimSlowWithdraw: NextPageWithLayout = () => {
  const { wallet, publicKey } = useWallet();

  let [programId, setProgramId] = useState(ProgramId);
  let [functionName, setFunctionName] = useState('claim_withdraw_public');
  let [poolId, setPoolId] = useState<number | undefined>(PoolId);
  let [withdrawAleoAmount, setWithdrawAleoAmount] = useState<string | undefined>('0');
  let [fee, setFee] = useState<number | undefined>(0.5);
  let [transactionId, setTransactionId] = useState<string | undefined>();
  let [status, setStatus] = useState<string | undefined>();
  let [withdrawalState, setWithdrawalState] = useState<any>(null);
  let [errorMessage, setErrorMessage] = useState<string | null>(null);
  let [currentBlock, setCurrentBlock] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!ProgramAddress) return;

    const fetchWithdrawalState = async () => {
      try {
        setErrorMessage(null);
        const stateString = await getWithdrawalState(ProgramAddress);
        console.log("Withdrawal state string:", stateString);

        // Check if we have a valid string response
        if (typeof stateString === 'string' && stateString.includes('microcredits')) {
          // Parse the string into an object
          // Extract microcredits value using regex
          const microcreditsMatch = stateString.match(/microcredits:\s*(\d+)u64/);
          const claimBlockMatch = stateString.match(/claim_block:\s*(\d+)u32/);

          if (microcreditsMatch && microcreditsMatch[1]) {
            const microcredits = parseInt(microcreditsMatch[1]);
            console.log("Parsed microcredits:", microcredits);
            const creditsAmount = parseMicrocreditsToCredits(microcredits);
            console.log("Converted to credits:", creditsAmount);
            setWithdrawAleoAmount(creditsAmount.toString());

            // Create a structured object from the string
            const parsedState = {
              microcredits: microcreditsMatch[1] + 'u64',
              claim_block: claimBlockMatch ? claimBlockMatch[1] + 'u32' : undefined
            };

            setWithdrawalState(parsedState);
          } else {
            setErrorMessage("Failed to parse microcredits from withdrawal state");
          }
        } else {
          setErrorMessage("No pending withdrawal found!");
          setWithdrawAleoAmount('0');
        }
      } catch (error) {
        console.error("Error fetching withdrawal state:", error);
        setErrorMessage("Error fetching withdrawal state. Please try again.");
        setWithdrawAleoAmount('0');
      }
    };

    fetchWithdrawalState();
  }, [publicKey]);

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

  // Fetch current block height
  useEffect(() => {
    const fetchCurrentBlock = async () => {
      try {
        const height = await getHeight();
        setCurrentBlock(height);
      } catch (error) {
        console.error("Error fetching current block height:", error);
      }
    };

    fetchCurrentBlock();
    // Set up interval to refresh block height every 30 seconds
    const intervalId = setInterval(fetchCurrentBlock, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const handleSubmit = async (event: ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publicKey) throw new WalletNotConnectedError();

    const aleoTransaction = Transaction.createTransaction(
      publicKey,
      'mainnet',
      programId,
      functionName,
      [
        Math.floor(parseFloat(withdrawAleoAmount!) * 1_000_000) + "u64",
      ],
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
        title="Claim Slow Withdrawal"
        description="Claim Slow Withdrawal from Pondo to Yokin Pool"
      />
      <AdminLayout title="Claim Slow Withdrawal">
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
                  placeholder="claim_withdraw_public"
                  onChange={(event) => setFunctionName(event.currentTarget.value)}
                  value={functionName}
                />
              </div>
              {/* 
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Pool ID
                </label>
                <input
                  type="number"
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-black/10 py-3 px-4 text-gray-100 outline-none transition-all focus:border-white"
                  placeholder="Pool ID" min={1}
                  onChange={(event) => {
                    const parsed = parseInt(event.target.value);
                    setPoolId(!Number.isNaN(parsed) ? parsed : undefined);
                  }}
                  value={poolId ?? ''}
                />
              </div> */}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Withdraw ALEO Amount
                </label>
                <input
                  type="number"
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-black/10 py-3 px-4 text-gray-100 outline-none transition-all focus:border-white"
                  placeholder="Amount of Aleo to claim (in credits)"
                  value={(withdrawAleoAmount!)}
                  readOnly
                />
              </div>

              {errorMessage && (
                <div className="bg-red-900/30 border border-red-800 p-4 rounded-lg">
                  <p className="text-sm text-red-300">{errorMessage}</p>
                </div>
              )}

              {withdrawalState && (
                <div className={`${currentBlock && parseInt(withdrawalState.claim_block.replace('u32', '')) <= currentBlock ? 'bg-green-900/30 border-green-800' : 'bg-yellow-900/30 border-yellow-800'} border p-4 rounded-lg`}>
                  {currentBlock && parseInt(withdrawalState.claim_block.replace('u32', '')) <= currentBlock ? (
                    <p className="text-sm text-green-300 font-medium">Withdrawal is ready to claim!</p>
                  ) : (
                    <p className="text-sm text-yellow-300 font-medium">Withdrawal is not yet ready to claim</p>
                  )}

                  {withdrawalState.claim_block && (
                    <>
                      <p className="text-sm text-gray-300 mt-2">
                        Claim block: {withdrawalState.claim_block.replace('u32', '')}
                      </p>
                      <p className="text-sm text-gray-300 mt-2">Current block: {currentBlock || 'Loading...'}</p>

                      {currentBlock && parseInt(withdrawalState.claim_block.replace('u32', '')) > currentBlock && (
                        <p className="text-sm text-gray-300 mt-2">
                          Estimated time until claim: ~{Math.ceil((parseInt(withdrawalState.claim_block.replace('u32', '')) - currentBlock) * 2.67 / 60)} minutes
                          ({Math.ceil((parseInt(withdrawalState.claim_block.replace('u32', '')) - currentBlock) * 2.67 / 3600)} hours)
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fee (ALEO)
                </label>
                <input
                  type="number"
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-black/10 py-3 px-4 text-gray-100 outline-none transition-all focus:border-white"
                  placeholder="Fee (in credits)"
                  step="0.05"
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
                disabled={!publicKey || !programId || !functionName || fee === undefined || poolId === undefined || !withdrawalState}
              >
                {!publicKey ? 'Connect Your Wallet' : 'Claim Withdrawal'}
              </button>
            </div>
          </div>
        </form>
      </AdminLayout>
    </>
  );
};

ClaimSlowWithdraw.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default ClaimSlowWithdraw;

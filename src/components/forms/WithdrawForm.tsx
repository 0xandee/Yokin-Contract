import { useState, useEffect, FormEvent } from 'react';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter-leo';
import {
    Transaction,
    WalletNotConnectedError,
} from '@demox-labs/aleo-wallet-adapter-base';
import { PoolId, ProgramId } from '@/aleo/program';
import { getUserBalanceInPool, getPoolDetails, getPlayerIsWinner, parseMicrocreditsToCredits } from '@/aleo/rpc';
import Button from '@/components/ui/button';

interface WithdrawFormProps {
    poolId: number;
    onClose: () => void;
}

// Fixed transaction fee in ALEO
const TRANSACTION_FEE = 0.6;

export default function WithdrawForm({ poolId, onClose }: WithdrawFormProps) {
    const { wallet, publicKey } = useWallet();

    let [programId, setProgramId] = useState(ProgramId);
    let [functionName, setFunctionName] = useState('redeem_public');
    let [player, setPlayer] = useState<string | undefined>(publicKey ?? '');
    let [isWinner, setIsWinner] = useState<boolean>(false);
    let [reward, setReward] = useState<number>(0);
    let [totalCreditsRedeem, setTotalCreditsRedeem] = useState<number | undefined>(0);
    let [transactionId, setTransactionId] = useState<string | undefined>();
    let [status, setStatus] = useState<string | undefined>();
    let [loading, setLoading] = useState(false);
    let [userBalance, setUserBalance] = useState<number | undefined>(undefined);
    let [isLoadingBalance, setIsLoadingBalance] = useState(false);
    let [balanceError, setBalanceError] = useState<string | null>(null);
    let [hashed, setHashed] = useState<string | null>(null);
    let [hashLoading, setHashLoading] = useState(false);
    let [hashError, setHashError] = useState<string | null>(null);

    useEffect(() => {
        setPlayer(publicKey ?? '');
    }, [publicKey]);

    // Fetch hash using API endpoint
    useEffect(() => {
        async function fetchHash() {
            if (!player) return;

            setHashLoading(true);
            setHashError(null);

            try {
                const response = await fetch('/api/hash', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        player: player,
                        pool_id: poolId ? poolId.toString() : "1"
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    console.log("Hash result:", data.hash);
                    setHashed(data.hash);
                } else {
                    console.error("Hash error:", data.error);
                    setHashError(data.error || "Failed to generate hash");
                }
            } catch (error) {
                console.error("API call error:", error);
                setHashError(error instanceof Error ? error.message : "Unknown error");
            } finally {
                setHashLoading(false);
            }
        }

        // Only call the API if we have a player address
        if (player) {
            fetchHash();
        }
    }, [player, poolId]);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!publicKey || !poolId) return;

            setIsLoadingBalance(true);
            setBalanceError(null);

            try {
                // Fetch user balance in pool
                const balanceInPool = await getUserBalanceInPool(publicKey, poolId);

                // Parse numeric value from any format returned
                let numericBalance = 0;
                try {
                    // If it's already a number
                    if (typeof balanceInPool === 'number') {
                        numericBalance = balanceInPool;
                    }
                    // If it's a string like "100000u64"
                    else if (typeof balanceInPool === 'string') {
                        // Use regex to extract numeric part
                        const numericMatch = String(balanceInPool).match(/\d+/);
                        if (numericMatch) {
                            numericBalance = parseInt(numericMatch[0], 10);
                        }
                    }
                } catch (error) {
                    console.error("Error parsing balance:", error);
                }

                setUserBalance(numericBalance);

                // Fetch pool details to check winner status
                const poolDetails = await getPoolDetails(poolId);

                // Parse reward value in the same way
                let numericReward = 0;
                if (poolDetails && poolDetails.reward) {
                    try {
                        if (typeof poolDetails.reward === 'number') {
                            numericReward = poolDetails.reward;
                        }
                        else if (typeof poolDetails.reward === 'string') {
                            const numericMatch = String(poolDetails.reward).match(/\d+/);
                            if (numericMatch) {
                                numericReward = parseInt(numericMatch[0], 10);
                            }
                        }
                    } catch (error) {
                        console.error("Error parsing reward:", error);
                    }
                }

                if (poolDetails && poolDetails.winner === publicKey) {
                    setIsWinner(true);
                    setReward(numericReward);
                    setTotalCreditsRedeem(numericBalance + numericReward);
                } else {
                    setTotalCreditsRedeem(numericBalance);
                }
            } catch (err) {
                console.error("Error fetching user data:", err);
                setBalanceError("Failed to load your balance. Please try again later.");
            } finally {
                setIsLoadingBalance(false);
            }
        };

        fetchUserData();
    }, [publicKey, poolId]);

    const getTransactionStatus = async (txId: string) => {
        try {
            const status = await (wallet?.adapter as LeoWalletAdapter).transactionStatus(txId);
            setStatus(status);

            if (status === 'Completed') {
                setTimeout(() => {
                    onClose();
                }, 1000);
            }
        } catch (error) {
            console.error("Failed to get transaction status:", error);
        }
    };

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

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        console.log("Withdraw form submitted for pool", poolId);

        if (!publicKey) {
            return;
        }

        setLoading(true);

        try {
            // Ensure we have valid values
            if (poolId === undefined) {
                throw new Error("Invalid pool ID");
            }

            console.log("Creating withdrawal transaction with inputs:", {
                poolId,
                publicKey,
                totalCreditsRedeem
            });

            if (!totalCreditsRedeem) {
                throw new Error("Credits redemption amount not available");
            }

            let inputs = [
                poolId.toString() + 'u64',
                publicKey,
                Math.floor(totalCreditsRedeem).toString() + 'u64'
            ];

            const aleoTransaction = Transaction.createTransaction(
                publicKey,
                'mainnet',
                programId,
                functionName,
                inputs,
                Math.floor(TRANSACTION_FEE * 1_000_000),
                false
            );

            console.log("Requesting withdrawal transaction", aleoTransaction);
            const txId = await (wallet?.adapter as LeoWalletAdapter).requestTransaction(aleoTransaction);
            console.log("Withdrawal transaction submitted with ID:", txId);
            setTransactionId(txId);
        } catch (error) {
            console.error("Failed to send transaction:", error);
            setStatus("Transaction failed: " + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                    <div className="border-b border-gray-800 pb-4">
                        {/* <p className="text-gray-400 mb-2">You are withdrawing from Pool #{poolId}</p> */}

                        {isLoadingBalance && (
                            <div className="py-2">
                                <p className="text-white">Loading your balance...</p>
                            </div>
                        )}

                        {balanceError && (
                            <div className="py-2 text-red-400">
                                <p>{balanceError}</p>
                            </div>
                        )}

                        {!isLoadingBalance && userBalance !== undefined && (
                            <div className="flex justify-between mt-2">
                                <span className="text-gray-400">Your deposit:</span>
                                <span className="text-white font-medium">{parseMicrocreditsToCredits(userBalance)} ALEO</span>
                            </div>
                        )}

                        {!isLoadingBalance && totalCreditsRedeem !== undefined && !isWinner && (
                            <div className="flex justify-between mt-2">
                                <span className="text-gray-400">Total to withdraw:</span>
                                <span className="text-white font-medium">{parseMicrocreditsToCredits(totalCreditsRedeem)} ALEO</span>
                            </div>
                        )}

                        {isWinner && (
                            <div className="mt-3 bg-green-900/30 border border-green-800 p-3 rounded-lg">
                                <p className="text-green-300 font-medium">🎉 Congratulations! You are the winner!</p>
                                <div className="flex justify-between mt-1">
                                    <span className="text-green-300">Prize:</span>
                                    <span className="text-green-300 font-medium">{parseMicrocreditsToCredits(reward)} ALEO</span>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <span className="text-green-300">Total to withdraw:</span>
                                    <span className="text-green-300 font-medium">{parseMicrocreditsToCredits(totalCreditsRedeem ?? 0)} ALEO</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="text-sm text-gray-400 bg-[#21212180] p-4 rounded-lg">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Transaction Fee:</span>
                                <span className="text-white font-medium">{TRANSACTION_FEE} ALEO</span>
                            </div>
                        </div>

                        {transactionId && (
                            <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-lg mt-4">
                                <p className="text-sm text-blue-300">Transaction ID: {transactionId}</p>
                                <p className="text-sm text-blue-300 mt-2">Status: {status || 'Processing...'}</p>
                            </div>
                        )}
                    </div>

                    <div className="">
                        <button
                            type="submit"
                            className="w-full py-3 rounded-md text-base font-medium transition-colors bg-white text-black hover:bg-gray-100 disabled:bg-white/30 disabled:text-white/50 disabled:cursor-not-allowed"
                            disabled={!publicKey || isLoadingBalance || !userBalance || userBalance <= 0 || loading || !!transactionId}
                        >
                            {loading || isLoadingBalance ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </span>
                            ) : transactionId ? 'Processing...' : 'Withdraw'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
} 
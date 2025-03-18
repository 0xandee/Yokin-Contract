import { useState, useEffect, FormEvent } from 'react';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter-leo';
import {
    Transaction,
    WalletAdapterNetwork,
    WalletNotConnectedError,
} from '@demox-labs/aleo-wallet-adapter-base';
import { PoolId, ProgramId } from '@/aleo/program';
import { getAleoPaleoRate } from '@/aleo/rpc';
import Button from '@/components/ui/button';

interface DepositFormProps {
    poolId: number;
    onClose: () => void;
}

// Fixed transaction fee in ALEO
const TRANSACTION_FEE = 0.6;

export default function DepositForm({ poolId, onClose }: DepositFormProps) {
    const { wallet, publicKey } = useWallet();

    let [programId, setProgramId] = useState(ProgramId);
    let [functionName, setFunctionName] = useState('join_pool_public');
    let [depositAmount, setDepositAmount] = useState<number | undefined>(1);
    let [pAleoExchangeRate, setPAleoExchangeRate] = useState<number | undefined>(0);
    let [expectedPAleoMint, setExpectedPAleoMint] = useState<number | undefined>(0);
    let [transactionId, setTransactionId] = useState<string | undefined>();
    let [status, setStatus] = useState<string | undefined>();
    let [loading, setLoading] = useState(false);
    let [isLoadingRate, setIsLoadingRate] = useState(false);
    let [rateError, setRateError] = useState<string | null>(null);

    // Fetch exchange rate only once when component mounts
    useEffect(() => {
        const fetchExchangeRate = async () => {
            setIsLoadingRate(true);
            setRateError(null);

            try {
                const rate = await getAleoPaleoRate();
                setPAleoExchangeRate(rate);
                if (depositAmount) {
                    setExpectedPAleoMint(parseFloat((depositAmount * rate).toFixed(5)));
                }
            } catch (error) {
                console.error("Failed to get exchange rate:", error);
                setRateError("Failed to load exchange rate. Please try again later.");
            } finally {
                setIsLoadingRate(false);
            }
        };

        fetchExchangeRate();
    }, []);

    // Update expected pALEO mint when deposit amount changes
    useEffect(() => {
        if (pAleoExchangeRate && depositAmount) {
            setExpectedPAleoMint(parseFloat((depositAmount * pAleoExchangeRate).toFixed(5)));
        }
    }, [depositAmount, pAleoExchangeRate]);

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

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        console.log("Deposit form submitted for pool", poolId);

        if (!publicKey) {
            return;
        }

        setLoading(true);

        try {
            // Ensure we have valid values
            if (!depositAmount || poolId === undefined) {
                throw new Error("Invalid deposit amount or pool ID");
            }

            console.log("Creating transaction with inputs:", {
                poolId,
                depositAmount: Math.floor(depositAmount * 1_000_000),
                expectedPAleoMint: pAleoExchangeRate ? Math.floor(depositAmount * 1_000_000 * pAleoExchangeRate) : 0
            });

            const aleoTransaction = Transaction.createTransaction(
                publicKey,
                'mainnet',
                programId,
                functionName,
                [
                    poolId.toString() + 'u64',
                    Math.floor(depositAmount * 1_000_000).toString() + 'u64',
                    (pAleoExchangeRate ? Math.floor(depositAmount * 1_000_000 * pAleoExchangeRate) : 0).toString() + 'u64'
                ],
                Math.floor(TRANSACTION_FEE * 1_000_000),
                false
            );

            console.log("Requesting transaction", aleoTransaction);
            const txId = await (wallet?.adapter as LeoWalletAdapter).requestTransaction(aleoTransaction);
            console.log("Transaction submitted with ID:", txId);
            setTransactionId(txId);
        } catch (error) {
            console.error("Failed to send transaction:", error);
            setStatus("Transaction failed: " + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    // Format the exchange rate to display only 4 decimal places
    const formattedExchangeRate = pAleoExchangeRate ? pAleoExchangeRate.toFixed(4) : '-';

    return (
        <div className="w-full">
            <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Deposit Amount (ALEO)
                            </label>
                            <input
                                type="number"
                                className="w-full appearance-none rounded-lg border border-gray-700 bg-black py-3 px-4 text-gray-100 outline-none transition-all focus:border-white"
                                placeholder="Amount to deposit"
                                onChange={(event) => {
                                    const parsed = parseFloat(event.target.value);
                                    setDepositAmount(!Number.isNaN(parsed) ? parsed : undefined);
                                }}
                                value={depositAmount ?? ''}
                                min={0.1}
                                step={0.1}
                                required
                            />
                        </div>

                        <div className="text-sm text-gray-400 bg-[#21212180] p-4 rounded-lg">
                            {isLoadingRate ? (
                                <p>Loading exchange rate...</p>
                            ) : rateError ? (
                                <p className="text-red-400">{rateError}</p>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Expected pALEO:</span>
                                        <span className="text-white font-medium">{expectedPAleoMint || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Exchange Rate:</span>
                                        <span className="text-white font-medium">1 ALEO = {formattedExchangeRate} pALEO</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Transaction Fee:</span>
                                        <span className="text-white font-medium">{TRANSACTION_FEE} ALEO</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {transactionId && (
                            <div className="bg-blue-900/30 p-4 rounded-lg mt-4">
                                <p className="text-sm text-blue-300">Transaction ID: {transactionId}</p>
                                <p className="text-sm text-blue-300 mt-2">Status: {status || 'Processing...'}</p>
                            </div>
                        )}
                    </div>

                    <div className="">
                        <button
                            type="submit"
                            className="w-full py-3 rounded-md text-base font-medium transition-colors bg-white text-black hover:bg-gray-100 disabled:bg-white/30 disabled:text-white/50 disabled:cursor-not-allowed"
                            disabled={!publicKey || !depositAmount || isLoadingRate || loading || !!transactionId}
                        >
                            {loading || isLoadingRate ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </span>
                            ) : transactionId ? 'Processing...' : 'Deposit'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
} 
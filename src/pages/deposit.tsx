import { useState, useEffect, ChangeEvent } from 'react';
import type { NextPageWithLayout } from '@/types';
import { NextSeo } from 'next-seo';
import DashboardLayout from '@/layouts/dashboard/_dashboard';
import Base from '@/components/ui/base';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter-leo';
import Button from '@/components/ui/button';
import {
  Transaction,
  WalletAdapterNetwork,
  WalletNotConnectedError,
} from '@demox-labs/aleo-wallet-adapter-base';
import { PoolId, ProgramId } from '@/aleo/program';
import { getAleoPaleoRate } from '@/aleo/rpc';

const Deposit: NextPageWithLayout = () => {
  const { wallet, publicKey } = useWallet();


  let [programId, setProgramId] = useState(ProgramId);
  let [functionName, setFunctionName] = useState('join_pool_public');
  let [poolId, setPoolId] = useState<number | undefined>(PoolId);
  let [depositAmount, setDepositAmount] = useState<number | undefined>(1);
  let [pAleoExchangeRate, setPAleoExchangeRate] = useState<number | undefined>(0);
  let [expectedPAleoMint, setExpectedPAleoMint] = useState<number | undefined>(depositAmount! * pAleoExchangeRate!);
  let [fee, setFee] = useState<number | undefined>(0.6); // Aleo
  let [transactionId, setTransactionId] = useState<string | undefined>();
  let [status, setStatus] = useState<string | undefined>();

  useEffect(() => {
    getAleoPaleoRate().then((result) => {
      setPAleoExchangeRate(result);
      setExpectedPAleoMint(parseFloat((depositAmount! * result).toFixed(5)));
    });
  }, [pAleoExchangeRate, depositAmount]);

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

    // const aleoTransaction = Transaction.createTransaction(
    //   publicKey,
    //   'mainnet',
    //   programId,
    //   functionName,
    //   [Math.floor(depositAmount! * 1_000_000) + "u64", Math.floor(depositAmount! * 1_000_000 * pAleoExchangeRate!) + "u64"],
    //   Math.floor(fee! * 1_000_000)!,
    //   false
    // );

    const aleoTransaction = Transaction.createTransaction(
      publicKey,
      'mainnet',
      programId,
      functionName,
      [poolId + "u64", Math.floor(depositAmount! * 1_000_000) + "u64", Math.floor(depositAmount! * 1_000_000 * pAleoExchangeRate!) + "u64"],
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
        title="Deposit"
        description="Deposit to Pool"
      />
      <Base>
        <form
          noValidate
          role="search"
          onSubmit={handleSubmit}
          className="relative flex w-full flex-col rounded-full md:w-auto"
        >
          <label className="flex w-full items-center justify-between py-4">
            Program ID:
            <input
              className="h-11 w-10/12 appearance-none rounded-lg border-2 border-gray-200 bg-transparent py-1 text-sm tracking-tighter text-gray-900 outline-none transition-all placeholder:text-gray-600 focus:border-gray-900 ltr:pr-5 ltr:pl-10 rtl:pr-10 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-500"
              placeholder="credits.aleo"
              onChange={(event) => setProgramId(event.currentTarget.value)}
              value={programId}
            />
          </label>

          <label className="flex w-full items-center justify-between py-4">
            Function Name:
            <input
              className="h-11 w-10/12 appearance-none rounded-lg border-2 border-gray-200 bg-transparent py-1 text-sm tracking-tighter text-gray-900 outline-none transition-all placeholder:text-gray-600 focus:border-gray-900 ltr:pr-5 ltr:pl-10 rtl:pr-10 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-500"
              placeholder="join"
              onChange={(event) => setFunctionName(event.currentTarget.value)}
              value={functionName}
            />
          </label>

          <label className="flex w-full items-center justify-between py-4">
            Pool ID:
            <input
              type="number"
              className="w-10/12 appearance-none rounded-lg border-2 border-gray-200 bg-transparent py-1 text-sm tracking-tighter text-gray-900 outline-none transition-all placeholder:text-gray-600 focus:border-gray-900 ltr:pr-5 ltr:pl-10 rtl:pr-10 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-500"
              placeholder="Pool ID" min={1}
              onChange={(event) => { setPoolId(event.currentTarget.value) }}
              value={poolId ?? ''}
            />
          </label>

          <label className="flex w-full items-center justify-between py-4">
            Deposit Amount (Aleo):
            <input
              type="number"
              className="w-10/12 appearance-none rounded-lg border-2 border-gray-200 bg-transparent py-1 text-sm tracking-tighter text-gray-900 outline-none transition-all placeholder:text-gray-600 focus:border-gray-900 ltr:pr-5 ltr:pl-10 rtl:pr-10 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-500"
              placeholder="Amount of Aleo to deposit (in credits)"
              onChange={(event) => {
                const parsed = parseFloat(event.target.value);
                setDepositAmount(!Number.isNaN(parsed) ? parsed : undefined);
                setExpectedPAleoMint(parsed * pAleoExchangeRate!);
              }}
              value={depositAmount ?? ''}
            />
          </label>

          <label className="flex w-full items-center justify-between py-4">
            pAleo/Aleo Exchange Rate:
            <input
              type="number"
              className="h-11 w-10/12 appearance-none rounded-lg border-2 border-gray-200 bg-transparent py-1 text-sm tracking-tighter text-gray-900 outline-none transition-all placeholder:text-gray-600 focus:border-gray-900 ltr:pr-5 ltr:pl-10 rtl:pr-10 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-500"
              placeholder="pAleo/Aleo Exchange Rate"
              onChange={(event) => {
                const parsed = parseFloat(event.target.value);
                setPAleoExchangeRate(!Number.isNaN(parsed) ? parsed : undefined);
              }}
              value={pAleoExchangeRate ?? ''}
              disabled={true}
            />
          </label>

          <label className="flex w-full items-center justify-between py-4">
            Expected pAleo receive:
            <input
              type="number"
              className="h-11 w-10/12 appearance-none rounded-lg border-2 border-gray-200 bg-transparent py-1 text-sm tracking-tighter text-gray-900 outline-none transition-all placeholder:text-gray-600 focus:border-gray-900 ltr:pr-5 ltr:pl-10 rtl:pr-10 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-500"
              placeholder="Expected pAleo mint"
              onChange={(event) => {
                const parsed = parseFloat(event.target.value);
                setExpectedPAleoMint(!Number.isNaN(parsed) ? parsed : undefined);
              }}
              value={expectedPAleoMint ?? ''}
              disabled={true}
            />
          </label>

          <label className="flex w-full items-center justify-between py-4">
            Fee:
            <input
              type="number"
              className="h-11 w-10/12 appearance-none rounded-lg border-2 border-gray-200 bg-transparent py-1 text-sm tracking-tighter text-gray-900 outline-none transition-all placeholder:text-gray-600 focus:border-gray-900 ltr:pr-5 ltr:pl-10 rtl:pr-10 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-500"
              placeholder="Fee (in credits)"
              onChange={(event) => {
                const parsed = parseFloat(event.target.value);
                setFee(!Number.isNaN(parsed) ? parsed : undefined);
              }}
              value={fee ?? ''}
            />
          </label>
          <div className="flex items-center justify-center">
            <Button
              disabled={
                !publicKey || !programId || !functionName || fee === undefined
              }
              type="submit"
              className="shadow-card dark:bg-gray-700 md:h-10 md:px-5 xl:h-12 xl:px-7"
            >
              {!publicKey ? 'Connect Your Wallet' : 'Submit'}
            </Button>
          </div>
        </form>

        {transactionId && (
          <div>
            <div>{`Transaction status: ${status}`}</div>
          </div>
        )}
      </Base>
    </>
  );
};

Deposit.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};

export default Deposit;

import { NextSeo } from 'next-seo';
import type { NextPageWithLayout } from '@/types';
import DashboardLayout from '@/layouts/dashboard/_dashboard';
import Image from '@/components/ui/image';
import AnchorLink from '@/components/ui/links/anchor-link';
import routes from '@/config/routes';
import Button from '@/components/ui/button';
import { useIsMounted } from '@/lib/hooks/use-is-mounted';
import { useIsDarkMode } from '@/lib/hooks/use-is-dark-mode';
import ErrorLightImage from '@/assets/images/404-light.svg';
import ErrorDarkImage from '@/assets/images/404-dark.svg';

const ErrorPage: NextPageWithLayout = () => {
  const isMounted = useIsMounted();
  const { isDarkMode } = useIsDarkMode();
  return (
    <>
      <NextSeo
        title="404 Error! No Result Found"
        description="React Next Web3 NFT Crypto Dashboard Template"
      />

      <div className="flex max-w-full flex-col items-center justify-center text-center">
        <div className="relative w-52 max-w-full sm:w-[400px] xl:w-[450px] 3xl:w-[500px]">
          {isMounted && !isDarkMode && (
            <Image src={ErrorLightImage} alt="404 Error" />
          )}
          {isMounted && isDarkMode && (
            <Image src={ErrorDarkImage} alt="404 Error" />
          )}
        </div>

        <h2 className="mt-5 mb-2 text-base font-medium uppercase tracking-wide text-gray-900 dark:text-white sm:mt-10 sm:mb-4 sm:text-xl 3xl:mt-12 3xl:text-2xl">
          Error! No Result Found
        </h2>
        <p className="mb-4 max-w-full text-xs leading-loose tracking-tight text-gray-600 dark:text-gray-400 sm:mb-6 sm:w-[430px] sm:text-sm sm:leading-loose">
          Sorry, the page you are looking for might be renamed, removed, or
          might never exist.
        </p>
        <AnchorLink href={routes?.deposit}>
          <Button shape="rounded">Back to Deposit</Button>
        </AnchorLink>
      </div>
    </>
  );
};

ErrorPage.getLayout = function getLayout(page) {
  return (
    <DashboardLayout contentClassName="flex items-center justify-center">
      {page}
    </DashboardLayout>
  );
};

export default ErrorPage;

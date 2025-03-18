import AnchorLink from '@/components/ui/links/anchor-link';
import { useRouter } from 'next/router';

const Logo: React.FC<React.SVGAttributes<{}>> = (props) => {
  const router = useRouter();

  return (
    <AnchorLink
      href="/"
      onClick={(e) => {
        e.preventDefault();
        router.push('/');
      }}
      className="flex outline-none"
      {...props}
    >
      <span className="text-2xl font-bold tracking-widest text-white">
        YOKIN
      </span>
    </AnchorLink>
  );
};

export default Logo;

import { clientIp } from '../../../../src/next.ts';

export const getServerSideProps = async ({ req }) => ({ props: { ip: clientIp(req) ?? null } });

export default function Page({ ip }) {
	return <p>{ip}</p>;
}

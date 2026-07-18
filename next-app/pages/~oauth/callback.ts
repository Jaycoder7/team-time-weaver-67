import { GetServerSideProps } from 'next';

export default function Page() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const qs = new URLSearchParams();
  for (const key of Object.keys(query)) {
    const val = query[key];
    if (Array.isArray(val)) qs.append(key, val.join(',')); else if (val !== undefined) qs.append(key, String(val));
  }
  return {
    redirect: {
      destination: `/api/admin/oauth/callback?${qs.toString()}`,
      permanent: false,
    },
  };
};

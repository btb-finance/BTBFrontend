import { ClientApp } from '@/components/ClientOnly';
import { HomePreview } from '@/components/previews/HomePreview';

// Rebuilt hourly so the preview's week number stays current.
export const revalidate = 3600;

export default function Page() {
  return <ClientApp preview={{ screen: 'home', node: <HomePreview/> }}/>;
}

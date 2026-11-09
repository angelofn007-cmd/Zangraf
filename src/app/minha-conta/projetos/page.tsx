import { ProjectList } from '@/components/project-list';
export const metadata = { title: 'Meus projetos' };
export default function Page() {
  return <><div className="customer-section-heading"><h2>Meus projetos</h2><p>Continue de onde parou ou comece uma nova história.</p></div><ProjectList /></>;
}

import { api } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { CategoriesClient, type CategoryRow } from './categories-client';

export const metadata = { title: 'Categories' };

// Server Component — fetches the category tree at request time and hands a serialized
// snapshot to the interactive client component for editing.
export default async function CategoriesPage() {
  const res = await api<{ items: CategoryRow[] }>('/categories');
  const items = res.ok && res.body ? res.body.items : [];
  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        breadcrumbs={[{ label: 'Catalogue' }, { label: 'Categories' }]}
        title="Categories"
        description="Organise the catalogue into a tree. Drag to reorder or reparent."
      />
      <div className="px-5 py-5 md:px-8 md:py-6">
        <CategoriesClient initial={items} />
      </div>
    </div>
  );
}

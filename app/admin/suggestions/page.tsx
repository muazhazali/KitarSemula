import type { Metadata } from 'next';
import { SuggestionsAdmin } from '@/components/admin/suggestions-admin';

export const metadata: Metadata = {
  title: 'Suggestion review',
  robots: { index: false, follow: false },
};

export default function AdminSuggestionsPage() {
  return <SuggestionsAdmin />;
}

import { revalidatePath } from 'next/cache'

/** Invalidate orders-related pages after mutations. */
export function revalidateOrdersPages(lang?: string) {
  if (lang) {
    revalidatePath(`/${lang}/orders`, 'page')
    revalidatePath(`/${lang}/accounting`, 'page')
    revalidatePath(`/${lang}`, 'page')
  }
  revalidatePath('/[lang]/orders', 'page')
  revalidatePath('/[lang]/accounting', 'page')
  revalidatePath('/[lang]', 'page')
}

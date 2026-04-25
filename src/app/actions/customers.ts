'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteCustomerAction(id: string) {
  try {
    const supabase = createAdminClient()
    
    // Attempt to merge orders to another customer with the same phone to prevent foreign key errors
    const { data: cTD } = await supabase.from('customers').select('phone_number').eq('id', id).single()
    if (cTD?.phone_number) {
       const { data: candidates } = await supabase.from('customers').select('id').eq('phone_number', cTD.phone_number)
       if (candidates) {
          const survivor = candidates.find((c: any) => c.id !== id)
          if (survivor) {
             await supabase.from('orders').update({ customer_id: survivor.id }).eq('customer_id', id)
          } else {
             // Nullify carefully if no survivor is found, to allow deletion
             await supabase.from('orders').update({ customer_id: null }).eq('customer_id', id)
          }
       }
    } else {
       await supabase.from('orders').update({ customer_id: null }).eq('customer_id', id)
    }

    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/[lang]/customers', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function deleteMultipleCustomersAction(ids: string[]) {
  try {
    if (!ids || ids.length === 0) return { success: true };
    const supabase = createAdminClient()
    
    const { data: customersToDelete } = await supabase.from('customers').select('id, phone_number').in('id', ids)
    
    if (customersToDelete && customersToDelete.length > 0) {
      for (const cTD of customersToDelete) {
         let survivorId = null;
         if (cTD.phone_number) {
            const { data: candidates } = await supabase.from('customers').select('id').eq('phone_number', cTD.phone_number)
            if (candidates) {
                const survivor = candidates.find((c: any) => !ids.includes(c.id))
                if (survivor) survivorId = survivor.id
            }
         }
         
         if (survivorId) {
             await supabase.from('orders').update({ customer_id: survivorId }).eq('customer_id', cTD.id)
         } else {
             await supabase.from('orders').update({ customer_id: null }).eq('customer_id', cTD.id)
         }
      }
    }
    
    const { error } = await supabase.from('customers').delete().in('id', ids)
    if (error) return { success: false, error: error.message }
    revalidatePath('/[lang]/customers', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

export async function updateCustomerAction(id: string, data: { name: string; phone_number: string; address: string }) {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('customers').update({
      full_name: data.name,
      phone_number: data.phone_number,
      address: data.address
    }).eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/[lang]/customers', 'page')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'حدث خطأ' }
  }
}

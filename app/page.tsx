import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CrmApp from './crm-app'

export default async function Home() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const email = user.email || ''
  const namePart = email.split('@')[0] || 'Nutzer'
  const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1)

  return <CrmApp userEmail={email} currentUser={displayName} />
}

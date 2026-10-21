import { redirect } from 'next/navigation'

// proxy.ts already sends unauthenticated visitors to /login; anyone who
// reaches this page is signed in, so just forward them to the app.
export default function RootPage() {
  redirect('/chat')
}

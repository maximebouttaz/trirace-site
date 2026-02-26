import { Suspense } from 'react'
import NewRaceClient from './NewRaceClient'

export default function AdminNewRacePage() {
  return (
    <Suspense>
      <NewRaceClient />
    </Suspense>
  )
}

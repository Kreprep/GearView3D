import { useEffect } from 'react'

const BASE_TITLE = 'GearView3D'

// Sets the browser tab title to "GearView3D - <section>", or just
// "GearView3D" when no section is given (e.g. a page still loading its own
// label). Called once per top-level page component in App.jsx's routing.
export function usePageTitle(section) {
  useEffect(() => {
    document.title = section ? `${BASE_TITLE} - ${section}` : BASE_TITLE
  }, [section])
}

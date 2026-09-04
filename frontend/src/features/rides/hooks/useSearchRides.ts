import { useQuery } from '@tanstack/react-query'
import { searchRides } from '../api/ridesApi'
import type { SearchRidesParams } from '../api/ridesApi'

export function useSearchRides(params: SearchRidesParams) {
  return useQuery({
    queryKey: ['rides', 'search', params],
    queryFn: () => searchRides(params),
  })
}
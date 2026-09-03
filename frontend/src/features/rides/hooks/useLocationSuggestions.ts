import { useQuery } from '@tanstack/react-query'
import { searchLocations } from '../api/ridesApi'

export function useLocationSuggestions(query: string) {
  return useQuery({
    queryKey: ['rides', 'locations', query.trim().toLowerCase()],
    queryFn: () => searchLocations(query),
    staleTime: 60_000,
    enabled: true,
  })
}
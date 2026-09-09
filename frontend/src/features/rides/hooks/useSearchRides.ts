import { useCallback, useEffect, useState } from 'react'

import type { RideListResponse } from '../types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://127.0.0.1:8000/api/v1'

export interface SearchRidesParams {
  origin?: string
  destination?: string
  date?: string
}

interface UseSearchRidesResult {
  data: RideListResponse | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

function buildSearchParams(
  params: SearchRidesParams,
): string {
  const searchParams = new URLSearchParams()

  if (params.origin) {
    searchParams.set('origin', params.origin)
  }

  if (params.destination) {
    searchParams.set('destination', params.destination)
  }

  if (params.date) {
    searchParams.set(
      'departure_from',
      `${params.date}T00:00:00`,
    )

    searchParams.set(
      'departure_to',
      `${params.date}T23:59:59`,
    )
  }

  searchParams.set('page', '1')
  searchParams.set('page_size', '20')

  return searchParams.toString()
}

export async function searchRides(
  params: SearchRidesParams,
): Promise<RideListResponse> {
  const query = buildSearchParams(params)

  const response = await fetch(
    `${API_BASE_URL}/rides?${query}`,
  )

  if (!response.ok) {
    throw new Error('Unable to load rides right now.')
  }

  return response.json() as Promise<RideListResponse>
}

export function useSearchRides(
  params: SearchRidesParams,
): UseSearchRidesResult {
  const [data, setData] = useState<
    RideListResponse | undefined
  >(undefined)

  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [requestVersion, setRequestVersion] = useState(0)

  const refetch = useCallback(() => {
    setRequestVersion((current) => current + 1)
  }, [])

  const origin = params.origin ?? ''
  const destination = params.destination ?? ''
  const date = params.date ?? ''

  useEffect(() => {
    const controller = new AbortController()

    async function loadRides() {
      setIsLoading(true)
      setIsError(false)

      try {
        const queryParams = buildSearchParams({
          origin: origin || undefined,
          destination: destination || undefined,
          date: date || undefined,
        })

        const response = await fetch(
          `${API_BASE_URL}/rides?${queryParams}`,
          {
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error(
            `Ride search failed with status ${response.status}`,
          )
        }

        const result =
          (await response.json()) as RideListResponse

        if (!controller.signal.aborted) {
          setData(result)
          setIsError(false)
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        if (!controller.signal.aborted) {
          setData(undefined)
          setIsError(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadRides()

    return () => {
      controller.abort()
    }
  }, [origin, destination, date, requestVersion])

  return {
    data,
    isLoading,
    isError,
    refetch,
  }
}
import { useEffect, useState } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../hooks/useAuthSession'
import { getKoreanErrorMessage } from '../lib/api'
import {
  getFavoriteStatus,
  removeFavorite,
  saveFavorite,
} from '../lib/favorites'

type FavoriteToggleButtonProps = {
  auctionGoodsId: number | string
  initialIsFavorite?: boolean
  shouldFetchStatus?: boolean
  isStatusLoading?: boolean
  onChange?: (isFavorite: boolean) => void
  className?: string
}

type FavoriteState = {
  userKey: string
  goodsKey: string
  isFavorite: boolean
}

export default function FavoriteToggleButton({
  auctionGoodsId,
  initialIsFavorite,
  shouldFetchStatus = true,
  isStatusLoading = false,
  onChange,
  className = '',
}: FavoriteToggleButtonProps) {
  const authSession = useAuthSession()
  const sessionUser = authSession?.user as { id?: unknown; login_id?: unknown } | undefined
  const authenticatedUserKey = authSession
    ? typeof sessionUser?.id === 'string'
      ? sessionUser.id
      : typeof sessionUser?.login_id === 'string'
        ? sessionUser.login_id
        : 'authenticated-user'
    : null
  const isSignedIn = authenticatedUserKey !== null
  const navigate = useNavigate()
  const location = useLocation()
  const goodsKey = String(auctionGoodsId)
  const [fetchedStatus, setFetchedStatus] = useState<FavoriteState | null>(null)
  const [localStatus, setLocalStatus] = useState<FavoriteState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isFavorite = isSignedIn && (
    localStatus?.userKey === authenticatedUserKey && localStatus.goodsKey === goodsKey
      ? localStatus.isFavorite
      : shouldFetchStatus
        ? fetchedStatus?.userKey === authenticatedUserKey && fetchedStatus.goodsKey === goodsKey && fetchedStatus.isFavorite
        : initialIsFavorite ?? false
  )

  useEffect(() => {
    if (!authenticatedUserKey || !shouldFetchStatus) {
      return
    }

    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsLoading(true)
        setErrorMessage('')
      }
    })
    getFavoriteStatus(auctionGoodsId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setFetchedStatus({
            userKey: authenticatedUserKey,
            goodsKey,
            isFavorite: response.is_favorite,
          })
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setErrorMessage(getKoreanErrorMessage(error, '관심 상태를 확인하지 못했습니다.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [auctionGoodsId, authenticatedUserKey, goodsKey, shouldFetchStatus])

  const handleClick = async () => {
    setErrorMessage('')
    if (!authenticatedUserKey) {
      navigate('/login', {
        state: {
          returnTo: `${location.pathname}${location.search}${location.hash}`,
          message: '관심물건을 저장하려면 로그인해 주세요.',
        },
      })
      return
    }

    const nextIsFavorite = !isFavorite
    setIsSaving(true)
    try {
      if (nextIsFavorite) {
        await saveFavorite(auctionGoodsId)
      } else {
        await removeFavorite(auctionGoodsId)
      }
      setLocalStatus({
        userKey: authenticatedUserKey,
        goodsKey,
        isFavorite: nextIsFavorite,
      })
      onChange?.(nextIsFavorite)
    } catch (error) {
      setErrorMessage(getKoreanErrorMessage(error, '관심물건 변경에 실패했습니다.'))
    } finally {
      setIsSaving(false)
    }
  }

  const isBusy = isLoading || isSaving || isStatusLoading
  const label = !isSignedIn
    ? '로그인 후 관심 저장'
    : isSaving
      ? '변경 중'
      : isFavorite
        ? '관심 저장됨'
        : '관심 저장'

  return (
    <div className="inline-flex flex-col items-stretch">
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        aria-pressed={isSignedIn ? isFavorite : undefined}
        aria-label={label}
        title={errorMessage || label}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-extrabold transition-colors disabled:cursor-wait disabled:opacity-60 ${
          isFavorite && isSignedIn
            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
            : 'border-gray-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700'
        } ${className}`}
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart className={`h-4 w-4 ${isFavorite && isSignedIn ? 'fill-current' : ''}`} />
        )}
        <span>{label}</span>
      </button>
      {errorMessage && (
        <span className="mt-1 max-w-72 text-xs font-bold leading-5 text-red-600" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  )
}

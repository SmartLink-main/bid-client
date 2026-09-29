// 검색 목록과 상세 갤러리에 사용할 대표사진 및 표시 순서를 정한다.
import { getGoodsPhotoUrl, type GoodsPhoto } from './goods'

// 관련사진 → 전경도 → 위치도. 같은 유형에서는 API 순서를 유지한다.
const REPRESENTATIVE_PHOTO_DIVISIONS = ['000245', '000241', '000244'] as const

export function getRepresentativeGoodsPhoto(photos: readonly GoodsPhoto[], goodsId: number) {
  const ownPhotoPath = new RegExp(`^/api/v1/goods/${goodsId}/photos/\\d+$`)
  const candidates = photos.filter((photo) => (
    photo.content_url && ownPhotoPath.test(photo.content_url) &&
    getGoodsPhotoUrl(photo.content_url, photo.cdn_path)
  ))
  return REPRESENTATIVE_PHOTO_DIVISIONS
    .map((code) => candidates.find((photo) => photo.photo_division_code === code))
    .find(Boolean) ?? candidates[0]
}

// 대표사진 한 장만 맨 앞으로 옮기고 원본 배열과 나머지 사진 순서는 보존한다.
export function orderGoodsPhotos(photos: readonly GoodsPhoto[], goodsId: number): GoodsPhoto[] {
  const representative = getRepresentativeGoodsPhoto(photos, goodsId)
  const index = representative ? photos.indexOf(representative) : -1
  return index > 0
    ? [photos[index], ...photos.slice(0, index), ...photos.slice(index + 1)]
    : [...photos]
}

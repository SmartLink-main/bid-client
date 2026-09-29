import type { AppraisalItem } from './goods'

const PREVIEW_ITEM_COUNT = 3
const PREVIEW_CONTENT_LENGTH = 360

export function appraisalDisplay(items: AppraisalItem[], expanded: boolean) {
  const canExpand = items.length > PREVIEW_ITEM_COUNT
    || items.some(item => (item.content?.trim().length ?? 0) > PREVIEW_CONTENT_LENGTH)
  const visibleItems = expanded ? items : items.slice(0, PREVIEW_ITEM_COUNT)

  return {
    canExpand,
    items: visibleItems.map((item, index) => {
      const groupTitle = item.table_division_name?.trim() || '기타 감정평가'
      const previousGroup = index > 0
        ? visibleItems[index - 1].table_division_name?.trim() || '기타 감정평가'
        : null
      const content = item.content?.trim() || '내용 미확인'
      return {
        groupTitle,
        // 같은 제목이 다시 등장해도 다른 대상일 수 있어 연속된 묶음만 표시한다.
        startsGroup: groupTitle !== previousGroup,
        title: item.item_name?.trim() || '항목명 미확인',
        content: !expanded && content.length > PREVIEW_CONTENT_LENGTH
          ? `${content.slice(0, PREVIEW_CONTENT_LENGTH)}…`
          : content,
      }
    }),
  }
}

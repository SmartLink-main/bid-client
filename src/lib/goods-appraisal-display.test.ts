import { describe, expect, it } from 'vitest'
import { appraisalDisplay } from './goods-appraisal-display'
import type { AppraisalItem } from './goods'

function item(group: string | null, title: string | null, content: string | null): AppraisalItem {
  return { display_order: null, table_division_name: group, item_name: title, content }
}

describe('감정평가 설명 모아 보기', () => {
  it('원문 순서와 같은 이름의 항목을 보존하고 연속된 표 제목만 묶는다', () => {
    const items = [
      item('토지', '공부와의 차이', '첫 번째 토지 설명'),
      item('토지', '공부와의 차이', '두 번째 토지 설명'),
      item('건물', '공부와의 차이', '건물 설명'),
      item('토지', '공부와의 차이', '다른 토지 설명'),
    ]
    const original = structuredClone(items)
    const display = appraisalDisplay(items, true)
    expect(display.items.map(row => row.content)).toEqual(items.map(row => row.content))
    expect(display.items.map(row => row.startsGroup)).toEqual([true, false, true, true])
    expect(display.items.map(row => row.title)).toEqual(Array(4).fill('공부와의 차이'))
    expect(items).toEqual(original)
  })

  it('처음 세 항목만 미리 보고 펼치면 누락 없이 모두 표시한다', () => {
    const items = Array.from({ length: 5 }, (_, index) => item('토지', `${index + 1})항목`, `본문 ${index}`))
    expect(appraisalDisplay(items, false).items).toHaveLength(3)
    expect(appraisalDisplay(items, false).canExpand).toBe(true)
    expect(appraisalDisplay(items, true).items).toHaveLength(5)
  })

  it('한 항목이어도 긴 본문을 펼치면 줄바꿈을 포함한 전체 원문이 돌아온다', () => {
    const content = `첫 문단\n${'가'.repeat(400)}\n마지막 문단`
    const items = [item('건물', '이용상태', content)]
    expect(appraisalDisplay(items, false)).toMatchObject({ canExpand: true, items: [{ content: `${content.slice(0, 360)}…` }] })
    expect(appraisalDisplay(items, true).items[0].content).toBe(content)
  })

  it('짧은 본문과 빈 목록에는 불필요한 펼치기 버튼이 필요 없다', () => {
    expect(appraisalDisplay([item('건물', '설비', '도시가스')], false).canExpand).toBe(false)
    expect(appraisalDisplay([], false)).toEqual({ canExpand: false, items: [] })
  })

  it('누락·공백을 없음으로 단정하지 않고 명시된 없음은 보존한다', () => {
    const display = appraisalDisplay([item(null, null, null), item(' ', ' ', ' '), item(null, '제시외', '해당사항 없음')], true)
    expect(display.items[0]).toMatchObject({ groupTitle: '기타 감정평가', title: '항목명 미확인', content: '내용 미확인', startsGroup: true })
    expect(display.items[1]).toMatchObject({ groupTitle: '기타 감정평가', title: '항목명 미확인', content: '내용 미확인', startsGroup: false })
    expect(display.items[2].content).toBe('해당사항 없음')
  })
})

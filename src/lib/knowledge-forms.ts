export type AuctionFormFileType = 'hwp' | 'doc'

export type AuctionFormDownload = {
  title: string
  files: Record<AuctionFormFileType, string>
}

function form(
  title: string,
  baseFileName: string,
  overrides: Partial<Record<AuctionFormFileType, string>> = {},
): AuctionFormDownload {
  return {
    title,
    files: {
      hwp: overrides.hwp ?? `${baseFileName}.hwp`,
      doc: overrides.doc ?? `${baseFileName}.doc`,
    },
  }
}

export const realEstateForms: AuctionFormDownload[] = [
  form('37. 전세사기피해자 지원 및 주거안정에 관한 특별법에 따른 임차인 우선매수신고서', '전세사기피해자+지원+및+주거안정에+관한+특별법에+따른+임차인+우선매수신고서'),
  form('36. 전세사기피해자 지원 및 주거안정에 관한 특별법에 따른 경매유예등 신청서', '전세사기피해자+지원+및+주거안정에+관한+특별법에+따른+경매유예등+신청서'),
  form('35. 권리신고 및 배당요구신청서(주택임대차)', '권리신고+및+배당요구신청서(주택임대차)'),
  form('34. 권리신고 및 배당요구신청서(상가임대차)', '권리신고+및+배당요구신청서(상가임대차)'),
  form('33. 사법보좌관의 처분에 대한 이의신청서', '사법보좌관의+처분에+대한+이의신청서'),
  form('32. 부동산임의경매신청서', '부동산임의경매신청서'),
  form('31. 부동산강제경매신청서', '부동산강제경매신청서'),
  form('30. 차액지급신고서', '차액지급신고서'),
  form('29. 자동차소유권이전등기 및 말소등록촉탁신청서', '자동차소유권이전및말소신청서'),
  form('28. 기간입찰용 입금증명서', '기간입찰용입금증명서'),
  form('27. 공동입찰신고서 및 공동입찰자목록', '공동입찰신고서및공동입찰자목록'),
  form('26. 임차인 우선매수신고서', '임차인우선매수신고서'),
  form('25. 공유자 우선매수신고서', '공유자우선매수신고서'),
  form('24. 기간입찰표 및 위임장', '기간입찰표'),
  form('23. 기일입찰표 및 위임장', '기일입찰표'),
  form('22. 부동산소유권이전등기 촉탁신청서', '부동산소유권이전등기촉탁신청서', {
    doc: '부동산소유권이전등기촉탁신청서2013.doc',
  }),
  form('21. 매각결정취소 신청서', '매각결정취소신청서'),
  form('20. 부동산인도명령 신청서', '부동산인도명령+신청서'),
  form('19. 명도확인서', '명도확인서'),
  form('18. 부기 및 환부신청서', '부기및환부신청서'),
  form('17. 배당액 영수증', '배당액영수증'),
  form('16. 매각대금완납증명원', '매각대금완납증명원'),
  form('15. 매각대금납입신청서', '매각대금납입신청서'),
  form('14. 채권상계신청서', '채권상계신청서'),
  form('13. 법원보관금 환급신청서', '법원보관금환급신청서'),
  form('12. 항고장', '항고장'),
  form('11. 매각허가에 대한 이의신청서', '매각허가에대한이의신청서'),
  form('10. 부동산경매개시결정에 대한 이의신청', '부동산경매개시결정에대한이의신청'),
  form('9. 강제경매개시결정에 대한 이의신청', '강제경매개시결정에대한이의신청'),
  form('8. 집행관 송달신청서', '집행관송달신청서'),
  form('7. 경매취하동의서', '경매취하동의서'),
  form('6. 경매취하서', '경매취하서'),
  form('5. 입찰(경매)기일 변경(연기) 신청서', '입찰(경매)기일변경(연기)신청서'),
  form('4. 배당요구신청', '배당요구신청'),
  form('3. 채권계산서', '채권계산서'),
  form('2. 보정서', '보정서'),
  form('1. 부동산일괄매각신청', '부동산일괄매각신청'),
]

export const movableForms: AuctionFormDownload[] = [
  form('24. 청구금액계산서', '청구금액계산서'),
  form('23. 동산경매 신청서', '동산경매신청서'),
  form('22. 해임 신청서', '해임신청서'),
  form('21. 포괄계좌입금 해지 신청서', '포괄계좌입금해지신청서'),
  form('20. 포괄계좌입금 신청서', '포괄계좌입금신청서'),
  form('19. 집행조서등본 신청서', '집행조서등본+신청서'),
  form('18. 집행정지 집행취소 신청서', '집행정지집행취소+신청서'),
  form('17. 집행속행 신청서', '집행속행신청서'),
  form('16. 증명원', '증명원'),
  form('15. 입찰표', '입찰표'),
  form('14. 임의변제 신청서', '임의변제신청서'),
  form('13. 이해관계 진술서', '이해관계진술서'),
  form('12. 위임장', '위임장'),
  form('11. 배우자 배당요구 신청서', '배우자배당요구신청서'),
  form('10. 매각촉구 신청서', '매각촉구+신청서'),
  form('9. 공동입찰자목록', '공동입찰자목록'),
  form('8. 공동입찰 신고서', '공동입찰신고서'),
  form('7. 계좌입금 신청서', '계좌입급신청서'),
  form('6. 강제집행 추가 위임장', '강제집행추가+위임장'),
  form('5. 강제집행 진행에 관한 신청서', '강제집행+진행에+관한+신청서'),
  form('4. 강제집행 신청 취하서 등', '강제집행신청+취하서+등'),
  form('3. 강제집행 신청서', '강제집행신청서'),
  form('2. 감축 신청서', '감축신청서'),
  form('1. 감정장소약도', '감정장소약도'),
]

export const auctionForms = [...realEstateForms, ...movableForms]

export function getAuctionFormDownloadHref(
  auctionForm: AuctionFormDownload,
  fileType: AuctionFormFileType,
) {
  return `/forms/${encodeURIComponent(auctionForm.files[fileType])}`
}

export function getAuctionFormDownloadName(
  auctionForm: AuctionFormDownload,
  fileType: AuctionFormFileType,
) {
  return `${auctionForm.title}.${fileType}`
}

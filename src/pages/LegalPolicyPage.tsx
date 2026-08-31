import { ExternalLink, FileCheck2, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import {
  PRIVACY_POLICY,
  PRIVACY_PROCESSING_TABLE,
  PRIVACY_PROCESSORS,
  LEGAL_POLICY_RELEASE_CHECKS,
  SERVICE_OPERATOR,
  SERVICE_TERMS,
  SIGNUP_COLLECTION_SUMMARY,
  type LegalPolicyMeta,
} from '../lib/legal-policies'

type PolicySectionProps = {
  id?: string
  title: string
  children: ReactNode
}

function PolicySection({ id, title, children }: PolicySectionProps) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-slate-100 pt-8">
      <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
        {children}
      </div>
    </section>
  )
}

function PolicyList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-blue-700">{children}</ul>
}

function PolicyHeader({ policy }: { policy: LegalPolicyMeta }) {
  const Icon = policy.kind === 'terms' ? FileCheck2 : ShieldCheck
  const counterpart = policy.kind === 'terms' ? PRIVACY_POLICY : SERVICE_TERMS

  return (
    <header>
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-blue-950 p-3 text-white shadow-sm">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-bold text-blue-800">스마트링크 · {SERVICE_OPERATOR.serviceName}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            {policy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            {policy.description}
          </p>
        </div>
      </div>
      <dl className="mt-7 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-bold text-blue-950">시행일</dt>
          <dd className="mt-1 text-blue-900">{policy.effectiveDate}</dd>
        </div>
        <div>
          <dt className="font-bold text-blue-950">문서 버전</dt>
          <dd className="mt-1 font-mono text-blue-900">{policy.documentVersion}</dd>
        </div>
        <div>
          <dt className="font-bold text-blue-950">카카오 가입 동의 기록 버전</dt>
          <dd className="mt-1 font-mono text-blue-900">{policy.kakaoConsentRecordVersion}</dd>
        </div>
      </dl>
      <aside className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950" aria-label="운영 적용 전 확인사항">
        <p className="font-extrabold">운영 적용 전 확인이 필요한 정책 초안입니다.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {LEGAL_POLICY_RELEASE_CHECKS.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </aside>
      <div className="mt-4 text-right text-sm">
        <Link className="font-bold text-blue-800 underline underline-offset-4" to={counterpart.path}>
          {counterpart.shortTitle} 함께 보기
        </Link>
      </div>
    </header>
  )
}

function PolicyShell({ policy, children }: { policy: LegalPolicyMeta; children: ReactNode }) {
  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
        <article className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <PolicyHeader policy={policy} />
          <div className="mt-10 space-y-8">{children}</div>
        </article>
      </div>
    </Layout>
  )
}

function TermsContent() {
  return (
    <>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <p className="font-extrabold">경매 참여 전 공식 문서를 다시 확인해 주세요.</p>
        <p className="mt-1">
          서비스의 경매정보는 검색 편의를 위한 참고자료입니다. 매각물건명세서, 현황조사서,
          감정평가서와 법원 공고의 최신 원문을 직접 확인한 뒤 입찰 여부를 판단해야 합니다.
        </p>
      </div>

      <PolicySection title="제1조 (목적)">
        <p>
          이 약관은 {SERVICE_OPERATOR.operatorName}(이하 “운영자”)가 제공하는 {SERVICE_OPERATOR.serviceName}
          서비스의 이용조건, 회원과 운영자의 권리·의무 및 책임사항을 정하는 것을 목적으로 합니다.
        </p>
      </PolicySection>

      <PolicySection title="제2조 (용어의 뜻)">
        <PolicyList>
          <li>“서비스”란 웹과 관련 API를 통해 제공하는 법원경매 정보 검색, 일정·공고, 관심물건, 지식정보 및 문의 기능을 말합니다.</li>
          <li>“회원”이란 이 약관과 개인정보 수집·이용 안내에 동의하고 계정을 만든 사람을 말합니다.</li>
          <li>“경매정보”란 법원 또는 공공기관의 공개자료를 바탕으로 정리한 사건, 물건, 일정, 가격, 사진, 위치 및 관련 정보를 말합니다.</li>
          <li>“콘텐츠”란 서비스에 표시되는 문서, 데이터베이스, 검색결과, 화면 구성, 이미지와 프로그램을 말합니다.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="제3조 (약관의 게시, 효력과 변경)">
        <p>운영자는 회원이 쉽게 확인할 수 있도록 이 약관을 서비스 하단에 상시 게시합니다.</p>
        <p>
          관계 법령을 위반하지 않는 범위에서 약관을 변경할 수 있습니다. 변경 내용과 시행일은 원칙적으로
          7일 전, 회원에게 불리하거나 중요한 변경은 30일 전에 서비스 화면으로 알립니다. 법령상 별도
          동의가 필요한 변경은 회원의 동의를 받습니다.
        </p>
      </PolicySection>

      <PolicySection title="제4조 (가입과 계정 관리)">
        <PolicyList>
          <li>회원은 본인이 사용하는 휴대전화 번호의 문자 확인 또는 본인이 관리하는 카카오 계정 인증을 거쳐 가입해야 합니다.</li>
          <li>만 14세 미만은 보호자 동의 확인 절차가 마련되기 전까지 가입할 수 없습니다.</li>
          <li>회원은 인증수단과 비밀번호를 안전하게 관리하고, 도용이나 무단 사용을 알게 되면 즉시 운영자에게 알려야 합니다.</li>
          <li>타인 명의 사용, 허위정보 입력, 이미 이용이 제한된 사람의 재가입 등 합리적인 사유가 있으면 가입이 거절되거나 사후 제한될 수 있습니다.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="제5조 (제공하는 서비스와 유료기능)">
        <PolicyList>
          <li>사건·물건·지역·유형·일정·역세권·특수조건 등을 이용한 경매정보 검색</li>
          <li>경매물건 상세정보, 지도, 일정과 공고 변경정보의 조회</li>
          <li>회원의 관심물건 저장, 계정 관리와 1:1 문의</li>
          <li>경매 지식자료와 자연어 검색 보조기능</li>
        </PolicyList>
        <p>
          현재 공개된 프런트에서는 이용권 판매, 결제, 환불, 입찰대행을 제공하지 않습니다. 이후 유료기능을
          도입할 때에는 가격, 청약철회·환불조건, 사업자 정보와 별도 유료서비스 약관을 결제 전에 명확히
          고지하고 필요한 동의를 받습니다.
        </p>
      </PolicySection>

      <PolicySection title="제6조 (경매정보의 성격과 회원의 확인 의무)">
        <PolicyList>
          <li>경매정보는 원천기관의 수정, 송달·공고 시차, 전산처리 과정에 따라 실제 현황과 다를 수 있습니다.</li>
          <li>운영자는 정보를 합리적으로 최신 상태로 유지하도록 노력하지만, 완전성·정확성·특정 목적 적합성을 보증하지 않습니다.</li>
          <li>서비스는 법률·세무·감정평가·권리분석·투자 자문이나 입찰대행을 제공하지 않습니다.</li>
          <li>회원은 현장조사, 등기·대장 확인, 이해관계 분석과 전문가 상담 등 필요한 검토를 스스로 진행해야 합니다.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="제7조 (회원의 금지행위)">
        <PolicyList>
          <li>타인의 계정·개인정보·인증정보를 사용하거나 계정 확인 절차를 우회하는 행위</li>
          <li>서비스 또는 다른 이용자를 방해하는 공격, 악성코드 배포, 취약점 악용과 과도한 요청</li>
          <li>사전 허용 없는 크롤링·스크래핑·대량수집·재배포, 데이터베이스 복제 또는 영업 목적 전매</li>
          <li>저작권, 개인정보, 명예 등 타인의 권리를 침해하거나 불법행위를 조장하는 행위</li>
          <li>자연어 검색이나 문의에 주민등록번호, 계좌·카드정보, 비밀번호 등 불필요한 민감정보를 입력하는 행위</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="제8조 (콘텐츠와 지식재산권)">
        <p>
          법원·공공기관 등 원천자료의 권리는 해당 권리자에게 있고, 운영자가 제작한 화면 구성, 검색체계,
          설명자료, 소프트웨어와 데이터베이스 편집물의 권리는 운영자 또는 정당한 권리자에게 있습니다.
          개인적·비영리적 이용을 넘어 복제·배포·판매하려면 별도 허락이 필요합니다.
        </p>
        <p>회원이 1:1 문의에 작성한 내용의 권리는 회원에게 있으며, 운영자는 문의 처리와 분쟁 대응에 필요한 범위에서만 이를 이용합니다.</p>
      </PolicySection>

      <PolicySection title="제9조 (서비스의 변경과 중단)">
        <p>
          점검, 장애, 보안사고 대응, 원천기관이나 외부 제공자의 사정, 천재지변 등으로 서비스의 전부 또는
          일부가 변경·중단될 수 있습니다. 예측 가능한 경우 사전에 알리고, 긴급한 경우 사후 지체 없이
          알립니다. 운영자는 중단 시간을 줄이고 데이터를 복구하기 위해 합리적인 노력을 합니다.
        </p>
      </PolicySection>

      <PolicySection title="제10조 (이용제한과 계약 해지)">
        <p>
          회원은 계정 화면에서 언제든 탈퇴할 수 있습니다. 운영자는 금지행위나 법령 위반이 확인되면 위반의
          정도와 반복성에 따라 경고, 일시정지 또는 계약 해지를 할 수 있으며, 가능한 경우 사유와 이의제기
          방법을 알립니다. 탈퇴 후 개인정보는 개인정보처리방침에 따라 삭제합니다.
        </p>
      </PolicySection>

      <PolicySection title="제11조 (책임의 범위)">
        <p>
          운영자는 고의 또는 과실로 회원에게 발생한 손해에 대해 관계 법령에 따라 책임을 집니다. 운영자의
          책임 없는 원천정보 오류, 회원의 공식문서 미확인이나 판단, 회원 귀책의 계정 도용, 불가항력으로
          생긴 손해에는 책임을 지지 않습니다. 이 조항은 운영자의 고의·중과실 책임이나 소비자에게 적용되는
          강행규정을 배제하지 않습니다.
        </p>
      </PolicySection>

      <PolicySection title="제12조 (통지, 문의와 분쟁 해결)">
        <p>운영자는 서비스 화면, 로그인 후 알림 또는 회원이 확인 가능한 방법으로 중요한 사항을 통지할 수 있습니다.</p>
        <p>
          약관과 서비스에 관한 문의는 <Link to={SERVICE_OPERATOR.supportPath} className="font-bold text-blue-800 underline underline-offset-4">1:1 문의</Link>로
          접수할 수 있습니다. 이 약관은 대한민국 법률에 따르며, 분쟁의 관할은 민사소송법 등 관계 법령에서
          정한 절차를 따릅니다.
        </p>
      </PolicySection>

      <PolicySection title="부칙">
        <p>이 약관은 {SERVICE_TERMS.effectiveDate}부터 시행합니다.</p>
      </PolicySection>
    </>
  )
}

function DataTable({
  headers,
  rows,
}: {
  headers: readonly string[]
  rows: ReadonlyArray<readonly string[]>
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-[760px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-slate-900">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-extrabold">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.join('|')} className="align-top">
              {row.map((cell, index) => <td key={`${index}-${cell}`} className="px-4 py-3 leading-6 text-slate-700">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PrivacyContent() {
  return (
    <>
      <section id="collection-consent" className="scroll-mt-24 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-blue-950">회원가입 개인정보 수집·이용 동의 요약</h2>
        <p className="mt-2 text-sm leading-6 text-blue-950">
          필수항목 수집을 거부할 수 있으나, 휴대전화 번호 확인과 계정 생성에 필요한 정보이므로 거부하면 회원가입을
          할 수 없습니다. 이름은 선택항목이며 입력하지 않아도 가입할 수 있습니다.
        </p>
        <div className="mt-4">
          <DataTable
            headers={['구분', '수집항목', '이용목적', '보유기간']}
            rows={SIGNUP_COLLECTION_SUMMARY.map((row) => [row.category, row.items, row.purpose, row.retention])}
          />
        </div>
      </section>

      <PolicySection title="1. 개인정보의 처리 목적">
        <PolicyList>
          <li>휴대폰 또는 카카오 인증을 통한 회원가입, 로그인, 계정 연결과 탈퇴 처리</li>
          <li>관심물건 저장, 회원별 서비스 설정과 1:1 문의 제공</li>
          <li>서비스 장애 분석, 보안 유지, 부정 가입과 비정상 이용 방지</li>
          <li>법령상 의무 이행, 민원·분쟁 처리와 권리 행사에 대한 응답</li>
        </PolicyList>
        <p>현재 공개된 서비스는 카드번호, 계좌번호나 결제내역을 수집하지 않습니다.</p>
      </PolicySection>

      <PolicySection title="2. 처리하는 개인정보와 보유기간">
        <p>서비스는 목적에 필요한 최소한의 정보만 처리하며, 아래 기간이 끝나면 지체 없이 파기합니다.</p>
        <DataTable
          headers={['구분', '처리항목', '처리목적', '보유기간']}
          rows={PRIVACY_PROCESSING_TABLE.map((row) => [row.category, row.items, row.purpose, row.retention])}
        />
        <p>
          SMS 인증번호는 기본 5분, 인증확인용 일회성 정보는 기본 10분 이내에 만료됩니다. 카카오 로그인
          과정의 임시 상태값과 가입 티켓도 기본 10분 이내에 만료되며, 완료되면 재사용할 수 없습니다.
        </p>
        <p>
          문의 내용에 회원이 임의로 개인정보를 적으면 그 내용도 함께 처리될 수 있습니다. 문의 목적에
          불필요한 주민등록번호, 계좌·카드정보, 비밀번호와 건강정보는 입력하지 마세요.
        </p>
      </PolicySection>

      <PolicySection title="2-1. 법원경매 공개자료에 포함된 개인정보">
        <p>
          서비스는 대한민국 법원경매정보 사이트에 공개된 사건·물건 자료를 수집·정리합니다. 이 자료에는
          원천 사이트가 공개하거나 마스킹한 범위의 사건 당사자, 이해관계인, 임차인과 등기 권리자 이름,
          점유·전입·배당요구·임대차·채권 정보 및 물건 주소가 포함될 수 있고, 출처 확인을 위해 법원 공개
          원문 응답을 함께 저장할 수 있습니다.
        </p>
        <p>
          이러한 정보는 공개 당시의 목적과 정보주체가 예상할 수 있는 합리적인 범위, 개인정보 보호법상
          정당한 이익 요건을 충족하는 범위에서만 경매정보 검색·상세조회와 오류 정정에 이용해야 합니다.
          운영자는 정식 공개 전에 처리 근거와 이익형량, 표시·마스킹 기준, 보유·파기주기와 비회원도 이용할
          수 있는 정정·삭제 요청 절차를 확정합니다.
        </p>
      </PolicySection>

      <PolicySection title="3. 개인정보의 제3자 제공">
        <p>
          운영자는 회원 개인정보를 광고사업자나 데이터 판매업체에 제공하지 않습니다. 법원경매 공개자료에
          포함된 정보는 위 2-1항의 공개 범위와 처리 기준 안에서 검색결과로 표시될 수 있습니다. 그 밖에는 정보주체의 별도
          동의가 있거나 법률에 특별한 근거가 있는 경우를 제외하고 제3자에게 제공하지 않으며, 제공이
          필요해지면 제공받는 자, 목적, 항목과 보유기간을 미리 알리고 필요한 동의를 받습니다.
        </p>
      </PolicySection>

      <PolicySection title="4. 개인정보 처리의 위탁">
        <p>서비스 제공을 위해 아래 업무를 외부 전문사업자에게 맡깁니다. 계약과 점검을 통해 목적 외 처리와 재위탁을 관리합니다.</p>
        <DataTable
          headers={['수탁자', '위탁업무', '처리정보', '보유·이용기간']}
          rows={PRIVACY_PROCESSORS.map((row) => [row.company, row.task, row.data, row.retention])}
        />
        <p>운영 인프라 사업자가 확정되거나 수탁자가 변경되면 이 방침을 통해 지체 없이 공개합니다.</p>
      </PolicySection>

      <PolicySection title="5. 외부 인증·지도 서비스와 국외 처리">
        <PolicyList>
          <li>
            회원이 카카오 간편가입을 선택하면 카카오의 인증 화면으로 이동하며, 동의한 범위의 카카오 이용자
            식별값·이름·휴대폰 번호를 전달받습니다. 카카오에서 처리되는 정보에는 카카오의 개인정보처리방침이 적용됩니다.
          </li>
          <li>
            지도 화면을 열면 브라우저가 OpenStreetMap Foundation(OSMF)의 타일 서버에 직접 접속합니다.
            이 과정에서 IP 주소, 브라우저 정보, 서비스 주소와 요청한 지도영역이 영국·네덜란드 또는 글로벌
            캐시 서버에서 처리될 수 있습니다. 지도 기능을 열지 않으면 이 요청은 발생하지 않습니다.
          </li>
        </PolicyList>
        <p className="flex flex-wrap gap-x-4 gap-y-2">
          <a className="inline-flex items-center gap-1 font-bold text-blue-800 underline underline-offset-4" href="https://www.kakao.com/policy/privacy" target="_blank" rel="noreferrer">
            카카오 개인정보처리방침 <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a className="inline-flex items-center gap-1 font-bold text-blue-800 underline underline-offset-4" href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noreferrer">
            OSMF 개인정보처리방침 <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </p>
        <p>
          자연어 검색은 기본 설정에서 서버 내부 규칙과 데이터베이스 검색으로 일시 처리하며 별도 질문 이력을
          저장하지 않습니다. 소스에 포함된 선택적 외부 AI 분석을 활성화하여 해외 제공자에게 이용자 입력을
          전송할 경우에는 이전받는 자·국가·항목·목적·시점·방법·보유기간과 거부 방법을 먼저 공개하고 관계
          법령상 필요한 절차를 거칩니다.
        </p>
      </PolicySection>

      <PolicySection title="6. 개인정보의 파기">
        <p>
          보유기간이 끝나거나 처리 목적이 달성되면 복구하기 어려운 방법으로 지체 없이 파기합니다. 회원 탈퇴
          시 계정과 연결된 카카오 식별정보·관심물건·문의는 데이터베이스에서 삭제됩니다. 이미 발급된 인증
          세션 레코드는 계정 삭제 후 인증에 사용할 수 없으며 최대 유효기간 안에 자동 삭제됩니다. 전자파일은
          안전한 삭제 절차를 사용하고, 출력물이 생긴 경우 분쇄 또는 소각합니다. 관계 법령에 따라 보존해야
          하는 정보는 다른 정보와 분리해 정해진 기간 동안만 보관합니다.
        </p>
      </PolicySection>

      <PolicySection title="7. 정보주체의 권리와 행사 방법">
        <PolicyList>
          <li>본인의 회원정보 및 법원 공개자료에 표시된 본인 정보에 대해 열람, 정정·삭제, 처리정지와 동의 철회를 요구할 수 있습니다.</li>
          <li>계정 정보 확인과 회원 탈퇴는 계정 화면에서 할 수 있고, 그 밖의 요구는 1:1 문의로 접수할 수 있습니다.</li>
          <li>법정대리인이나 위임받은 사람이 행사하는 경우 관계 법령에 따른 위임·본인 확인을 요청할 수 있습니다.</li>
          <li>법령에서 열람 또는 삭제를 제한하는 사유가 있으면 그 사유와 이의제기 방법을 안내합니다.</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="8. 개인정보의 안전성 확보 조치">
        <PolicyList>
          <li>비밀번호의 단방향 암호화 저장과 전송구간 암호화</li>
          <li>인증정보의 짧은 유효기간, 일회성 사용, 로그인 세션 회전과 로그아웃 시 폐기</li>
          <li>개인정보 접근권한 최소화, 관리자 기능 분리와 인증</li>
          <li>요청 횟수 제한, 입력값 검증, 민감 응답의 저장 방지와 보안점검</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="9. 쿠키와 인증정보">
        <p>
          서비스는 로그인 유지와 카카오 인증 보안을 위해 필수 쿠키를 사용합니다. 새로고침 토큰 쿠키는
          HttpOnly·Secure·SameSite 속성으로 보호하고, 카카오 인증 상태 쿠키는 약 10분 안에 만료됩니다.
          접속 토큰은 브라우저 메모리에서만 유지하며 광고·행태정보 수집용 쿠키는 현재 사용하지 않습니다.
        </p>
        <p>
          브라우저 설정에서 쿠키를 차단하거나 삭제할 수 있으나, 필수 쿠키를 차단하면 로그인과 카카오 인증을
          사용할 수 없습니다.
        </p>
      </PolicySection>

      <PolicySection title="10. 만 14세 미만 아동의 개인정보">
        <p>
          약관은 법정대리인 동의 확인 절차를 제공하기 전까지 만 14세 미만의 가입을 허용하지 않습니다.
          현재 생년월일 입력이나 연령 차단 기능은 구현 전이므로 정식 운영 전에 기술적 확인 절차를 마련합니다.
          만 14세 미만의 정보가 잘못 수집된 사실을 알게 되면 확인 후 지체 없이 삭제합니다.
        </p>
      </PolicySection>

      <PolicySection title="11. 개인정보 보호 담당과 권익침해 구제">
        <dl className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <dt className="font-extrabold text-slate-900">개인정보 보호업무 및 고충처리 부서</dt>
            <dd className="mt-1">{SERVICE_OPERATOR.privacyDepartment}</dd>
          </div>
          <div className="mt-3">
            <dt className="font-extrabold text-slate-900">문의 방법</dt>
            <dd className="mt-1"><Link to={SERVICE_OPERATOR.supportPath} className="font-bold text-blue-800 underline underline-offset-4">서비스 내 1:1 문의</Link></dd>
          </div>
        </dl>
        <p>개인정보 침해에 관한 상담이나 분쟁조정이 필요하면 아래 기관에도 도움을 요청할 수 있습니다.</p>
        <PolicyList>
          <li><a href="https://privacy.kisa.or.kr/" target="_blank" rel="noreferrer" className="font-bold text-blue-800 underline underline-offset-4">개인정보침해 신고센터</a>: 국번 없이 118</li>
          <li><a href="https://www.kopico.go.kr/" target="_blank" rel="noreferrer" className="font-bold text-blue-800 underline underline-offset-4">개인정보분쟁조정위원회</a>: 1833-6972</li>
          <li><a href="https://ecrm.police.go.kr/" target="_blank" rel="noreferrer" className="font-bold text-blue-800 underline underline-offset-4">경찰청 사이버범죄 신고시스템</a>: 국번 없이 182</li>
        </PolicyList>
      </PolicySection>

      <PolicySection title="12. 개인정보처리방침의 변경">
        <p>
          내용이 추가·삭제·수정되면 원칙적으로 시행 7일 전에 알리고, 정보주체의 권리에 중대한 변경은 30일
          전에 알립니다. 법령상 별도 동의가 필요한 변경은 필요한 동의를 받습니다.
        </p>
        <p>이 개인정보처리방침은 {PRIVACY_POLICY.effectiveDate}부터 시행합니다.</p>
      </PolicySection>
    </>
  )
}

export function ServiceTermsPage() {
  return <PolicyShell policy={SERVICE_TERMS}><TermsContent /></PolicyShell>
}

export function PrivacyPolicyPage() {
  return <PolicyShell policy={PRIVACY_POLICY}><PrivacyContent /></PolicyShell>
}

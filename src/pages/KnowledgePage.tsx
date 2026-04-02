import { useState } from 'react';
import Layout from '../components/Layout';
import { 
  BookOpen, Search, ChevronRight, Gavel, FileText, Landmark, 
  FileCheck, Coins, Scale, ScrollText, Building, Package, Truck, 
  Archive, FileDown, Globe, ExternalLink, MapPin, Phone, Map, Users
} from 'lucide-react';

type TabType = 'process' | 'terms' | 'forms' | 'reference' | 'courts';
type ProcessType = 'realEstate' | 'movable'; 
type FormType = 'realEstate' | 'movable'; 
type RegionType = '수도권' | '충청권' | '강원권' | '경남권' | '경북권' | '전라권' | '제주권';

// ★ 대표님이 직접 넣은 로고 파일을 불러오고, 없으면 지구본 띄우는 스마트 컴포넌트
const LocalSiteLogo = ({ src, alt }: { src: string, alt: string }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return <Globe className="w-5 h-5 text-indigo-300" />;
  }
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className="w-6 h-6 object-contain"
      onError={() => setHasError(true)} 
    />
  );
};

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<TabType>('process');
  const [processType, setProcessType] = useState<ProcessType>('realEstate'); 
  const [formType, setFormType] = useState<FormType>('realEstate'); 
  const [activeRegion, setActiveRegion] = useState<RegionType>('수도권');
  const [searchTerm, setSearchTerm] = useState('');

  // ==========================================
  // 1. 경매절차 데이터
  // ==========================================
  const realEstateProcess = [
    { icon: <FileText />, title: "01 경매신청 및 경매개시일정", desc: "채권자가 경매신청을 하면 법원은 경매개시결정을 하여 매각할 부동산을 압류하고 관할등기소에 경매개시결정의 기입등기를 촉탁하여 경매개시결정 사실을 등기기록에 기입하도록 합니다. 법원은 경매개시결정 정본을 채무자에게 송달합니다." },
    { icon: <Users />, title: "02 배당요구의 종기 결정 및 공고", desc: "경매개시결정에 따른 압류의 효력이 생긴 때부터 1주일 내에 집행법원은 채권자들이 배당요구를 할 수 있는 종기를 첫 매각기일 이전으로 정합니다. 법원은 배당요구의 종기가 정하여진 때에는 경매개시결정을 한 취지 및 배당요구의 종기를 공고하고, 아울러 법원에 알려진 채권자에게 이를 고지합니다." },
    { icon: <Landmark />, title: "03 매각의 준비", desc: "법원은 집행관에게 매각할 부동산의 현상, 점유관계, 차임 또는 보증금의 액수, 그 밖의 현황에 관하여 조사하도록 명하고, 감정인에게 매각할 부동산을 평가하게 합니다. 법원은 감정인의 평가액을 참작하여 최저매각가격을 정합니다." },
    { icon: <ScrollText />, title: "04 매각방법 등의 지정·공고·통지", desc: "법원은 매각기일에 호가경매, 기일입찰, 기간입찰 중 어느 하나의 방법으로 매각을 실시합니다. 법원은 매각기일과 매각결정기일을 정하여 대법원규칙이 정하는 방법으로 공고하고 이해관계인에게 통지합니다." },
    { icon: <Gavel />, title: "05 매각의 실시", desc: "매각기일에는 집행관이 집행법원이 정한 매각장소에서 매각을 실시합니다. 입찰자는 대법원규칙이 정하는 금액(통상 최저매각가격의 10분의 1)을 보증으로 제공하여야 합니다. 집행관은 입찰자 중에서 가장 높은 가격을 적어낸 사람을 최고가매수신고인으로, 그 다음으로 높은 가격을 적어낸 사람을 차순위매수신고인으로 정합니다." },
    { icon: <FileCheck />, title: "06 매각결정절차", desc: "법원은 매각결정기일에 이해관계인의 의견을 듣고 매각의 허가 또는 불허가를 결정합니다. 매각허가여부의 결정에 대하여 이해관계인은 즉시항고를 할 수 있습니다." },
    { icon: <Coins />, title: "07 매각대금의 납부", desc: "매각허가결정이 확정되면 법원은 대금지급기한을 정하여 매수인에게 매각대금의 납부를 명합니다. 매수인은 대금지급기한까지 매각대금을 납부하여야 하며, 대금을 완납하면 매각목적물의 소유권을 취득합니다." },
    { icon: <Building />, title: "08 소유권이전등기 등의 촉탁, 부동산 인도명령", desc: "매수인이 대금을 완납하면 법원은 매수인 명의의 소유권이전등기, 매수인이 인수하지 아니하는 부동산 위의 부담의 말소등기를 등기관에게 촉탁합니다. 매수인은 대금을 완납한 후 6월 이내에 법원에 부동산의 인도명령을 신청할 수 있습니다." },
    { icon: <Scale />, title: "09 배당절차", desc: "매수인이 매각대금을 완납하면 법원은 배당기일을 정하여 이해관계인과 배당을 요구한 채권자에게 통지합니다. 법원은 배당기일에 출석한 채권자들의 합의에 의하여 배당표를 확정하고, 이에 따라 배당을 실시합니다." },
  ];

  const movableProcess = [
    { icon: <FileText />, title: "01 집행관에게 집행위임", desc: "유체동산의 집행은 채권자가 집행기관인 집행관에게 서면으로 집행신청을 함으로써 개시됩니다.(민사집행법 제4조) 강제집행신청서에는 채권자 채무자와 그 대리인의 표시, 집행권원의 표시, 강제집행 목적물인 유체동산이 있는 장소 등을 적고 집행력 있는 정본을 붙여야 합니다." },
    { icon: <Package />, title: "02 압류", desc: "집행관은 채무자의 점유에 속하는 유체동산을 압류합니다. 압류는 집행관이 목적물을 점유하거나 압류물에 봉인 그 밖의 방법으로 압류의 표시를 함으로써 합니다. 부부공유 유체동산도 압류할 수 있으며 이 경우 배우자는 우선매수권을 행사할 수 있습니다." },
    { icon: <Gavel />, title: "03 매각 (호가경매)", desc: "압류물이 금전인 때에는 집행관이 이를 채권자에게 인도하고 금전 이외의 물건인 때에는 매각기일에 이를 현금화합니다. 집행관이 매각기일을 정하여 매각의 일시, 장소, 매각할 동산을 공고하며, 매각기일에는 원칙적으로 압류물이 있는 장소에서 호가경매의 방법으로 입찰을 실시하여 최고가매수신고인을 정합니다." },
    { icon: <Truck />, title: "04 대금지급 및 목적물 인도", desc: "최고가매수신고인은 원칙적으로 매각기일에 현금으로 매각대금을 지급하여야 합니다. 매수인이 매각대금을 지급한 때에는 집행관은 매수인에게 매각물을 인도합니다. 매수인이 매각대금을 지급하지 아니하면 집행관은 그 매각을 취소하고 다시 매각을 실시합니다." },
    { icon: <Users />, title: "05 배당요구", desc: "민사집행법에 따른 압류채권자, 가압류채권자, 우선변제청구권이 있는 채권자 등은 집행관이 매각대금을 영수할 때까지 배당요구를 할 수 있습니다. 배당요구가 있으면 집행관은 채권자 간에 배당협의를 실시합니다." },
    { icon: <Coins />, title: "06-1 배당", desc: "- 배당의 실시에 관한 채권자의 의견표시는 반드시 매각기일에 출석하여 말로 할 필요는 없고 서면으로 제출하여도 무방합니다.\n- 협의가 성립되기 위하여는 가압류채권자 또는 집행정지사류가 제출된 채권자를 포함하여 모든 채권자의 찬성이 필요합니다.\n- 배당협의기일까지 채권자간의 배당협의가 이루어진 경우에는 당초의 배당계산서에 따라, 배당협의기일에 채권자전원의 협의로 배당계산서와 다른 내용의 협의가 이루어진 경우에는 그 협의에 따라 배당계산서를 다시 작성하여, 각각 배당을 실시합니다.\n- 배당협의가 이루어지지 아니한 때에는 바로 매각대금을 공탁하고 사유신고를 합니다." },
    { icon: <Archive />, title: "06-2 공탁 및 사유신고", desc: "- 집행관은 ① 매각대금 등으로 채권자 전부를 만족하게 할 수 없고 배당협의도 이루어지지 아니한 경우, ② 매각대금 등으로 채권자의 채권과 집행비용의 전부를 변제할 수 있거나 채권자 사이에 배당협의가 이루어졌더라도 배당 등을 받을 채권자의 채권의 일부 또는 전부가 불확정채권인 경우에는 그 채권에 대하여는 집행관이 직접 교부할 수 없고, 그 배당액에 상당하는 금액을 공탁하고 집행관계서류를 첨부하여 집행법원에 사유를 신고하여야 합니다.\n- 불확정채권이라 함은 정지조건 또는 불확정기한이 붙어 있는 채권, 가압류채권, 그 채권에 관한 우선변제권 또는 질권의 실행을 일시금지하는 재판의 정본이 제출되어 있는 경우 등입니다." },
    { icon: <Scale />, title: "07 집행법원의 배당절차", desc: "집행법원은 사유신고의 내용에 따라 민사집행법 제252조 이하의 규정에 따른 배당을 실시하거나 정지조건이 있는 채권에 대하여는 그 조건의 성취여부에 따라서, 불확정기한이 있는 채권에 대하여는 그 기한의 도래에 따라서, 가압류채권에 대하여는 본안소송의 결과에 따라서, 배당이의의 소가 제기된 경우에는 그 결과에 따라, 각각 채권자 또는 채무자에게 지급합니다." }
  ];

  // ==========================================
  // 2. 경매용어 데이터 (86개)
  // ==========================================
  const auctionTerms = [
    { term: "가압류", desc: "금전채권이나 금전으로 환산할 수 있는 채권의 집행을 보전할 목적으로 미리 채무자의 재산을 동결시키는 집행보전제도입니다." },
    { term: "가처분", desc: "금전채권 이외의 특정물의 급여·인도를 목적으로 하는 청구권에 대한 집행을 보전하거나 임시의 지위를 정하기 위한 법원의 명령입니다." },
    { term: "감정평가액", desc: "법원이 지정한 감정평가사가 경매 목적물의 경제적 가치를 평가하여 산정한 금액입니다." },
    { term: "강제경매", desc: "채권자가 집행권원(판결문 등)을 가지고 채무자의 재산을 압류하여 매각한 다음 그 매각대금에서 채권을 변제받는 절차입니다." },
    { term: "강제관리", desc: "채무자의 부동산을 관리하여 그 수익으로 채권자의 채권을 변제하는 강제집행 방법입니다." },
    { term: "강제집행", desc: "국가의 강제권력을 행사하여 사법상의 청구권을 실현하는 절차입니다." },
    { term: "개별매각", desc: "여러 개의 부동산을 매각할 때 원칙적으로 각 부동산별로 최저매각가격을 정하여 개별적으로 매각하는 방법입니다." },
    { term: "경매개시결정", desc: "법원이 채권자의 신청에 따라 경매절차를 시작하겠다는 결정을 내리고 동시에 목적물을 압류하는 결정입니다." },
    { term: "경매비용", desc: "경매신청 시 채권자가 예납하는 비용으로 송달료, 감정평가수수료, 현황조사수수료, 신문공고료 등이 포함됩니다." },
    { term: "공공용지", desc: "도로, 하천, 구거, 제방 등 공공의 목적에 사용되는 토지를 말합니다." },
    { term: "공동경매", desc: "여러 채권자가 동시에 경매를 신청하거나, 이미 경매개시결정이 내려진 부동산에 다른 채권자가 또 경매를 신청하는 경우입니다." },
    { term: "공유물분할을 위한 경매", desc: "공유자 간에 공유물 분할 협의가 이루어지지 않아 법원의 판결에 의해 공유물을 경매하여 대금을 분할하는 절차입니다." },
    { term: "공유자우선매수권", desc: "공유물 지분 경매 시, 다른 공유자가 매각기일까지 최고매수신고가격과 동일한 가격으로 우선 매수하겠다고 신고할 수 있는 권리입니다." },
    { term: "공탁", desc: "금전, 유가증권 기타의 물건을 법원의 공탁소에 맡겨 두는 것을 말합니다." },
    { term: "공탁금", desc: "법령의 규정에 따라 법원의 공탁소에 맡겨두는 금전입니다." },
    { term: "과잉경매금지 (과잉매각)", desc: "여러 개의 재산을 매각하는 경우에 그 중 일부의 매각대금으로 모든 채권자의 채권과 비용을 변제하기에 충분한 경우 나머지 재산의 매각을 허가하지 않는 것입니다." },
    { term: "관할법원", desc: "특정한 사건에 대하여 재판권을 행사할 수 있는 법원을 말합니다." },
    { term: "광업권", desc: "등록을 한 일정한 토지의 구역(광구)에서 미채굴의 광물을 채굴하여 취득하는 권리입니다." },
    { term: "구분건물", desc: "1동의 건물 중 구조상 구분된 수개의 부분이 독립한 건물로서 사용될 수 있을 때 그 각 부분을 말합니다." },
    { term: "권리신고", desc: "경매 목적물에 대하여 권리를 가진 자가 법원에 자신의 권리를 증명하여 신고하는 절차입니다." },
    { term: "기각", desc: "법원이 소송이나 신청이 이유 없다고 판단하여 물리치는 재판입니다." },
    { term: "기간입찰", desc: "법원이 정한 1주일~1개월의 기간 내에 입찰표를 우편이나 직접 제출하는 방식의 입찰입니다." },
    { term: "기일입찰", desc: "지정된 매각기일에 입찰자들이 법원에 출석하여 입찰표를 제출하고 개찰하여 최고가매수신고인을 정하는 방식입니다." },
    { term: "기일입찰표", desc: "기일입찰 방식에서 입찰자가 입찰가격 등 필요한 사항을 적어 제출하는 양식입니다." },
    { term: "농지취득자격증명", desc: "농지를 취득하려는 자가 농지법에 따라 농업경영 능력이 있음을 증명하기 위해 발급받는 서류입니다." },
    { term: "담보권실행 등을 위한 경매(임의경매)", desc: "저당권, 질권, 전세권 등 담보물권을 가진 자가 그 권리를 실행하여 경매를 진행하는 절차입니다." },
    { term: "담보물권", desc: "일정한 채권을 담보할 목적으로 목적물의 교환가치를 지배하는 제한물권(유치권, 질권, 저당권 등)입니다." },
    { term: "대리입찰", desc: "본인이 직접 입찰에 참여하지 못할 경우 위임장과 인감증명서를 첨부하여 대리인을 통해 입찰에 참여하는 것입니다." },
    { term: "대위변제", desc: "제3자나 공동채무자가 채무자를 대신하여 빚을 갚고 채권자의 권리를 넘겨받는 것을 말합니다." },
    { term: "대항력", desc: "임차인이 주택의 인도와 주민등록을 마친 경우 제3자(낙찰자 등)에게 임대차 관계의 존속을 주장할 수 있는 권리입니다." },
    { term: "등기부등본", desc: "부동산에 관한 권리관계 또는 부동산의 상황을 기재하는 공적 장부의 등본입니다." },
    { term: "말소기준권리", desc: "부동산 경매 시 낙찰로 인해 부동산에 설정된 권리들이 소멸하는지 인수하는지를 가르는 기준이 되는 최선순위 권리입니다." },
    { term: "매각결정기일", desc: "법원이 매각절차의 적법성을 심사하고 이해관계인의 의견을 들어 최종적으로 매각 허가 또는 불허가를 결정하는 기일입니다." },
    { term: "매각기일", desc: "법원이 지정한 장소에서 실제로 입찰 또는 경매가 실시되는 날짜입니다." },
    { term: "매각물건명세서", desc: "법원이 매각할 부동산의 현황, 점유관계, 권리관계 등 입찰에 필요한 주요 정보를 기재하여 비치하는 공적 문서입니다." },
    { term: "매각불허가결정", desc: "최고가매수신고인이 결정되었으나 절차상 흠결이나 농지취득자격증명 미제출 등으로 법원이 매각을 허가하지 않는 결정입니다." },
    { term: "매각조건", desc: "경매 목적물을 매각함에 있어 지켜야 할 법률상, 사실상의 조건입니다." },
    { term: "매각허가결정", desc: "매각결정기일에 법원이 절차에 하자가 없음을 확인하고 최고가매수신고인에게 매각을 허가하는 결정입니다." },
    { term: "매수보증금", desc: "입찰에 참여하기 위해 제공하는 보증금으로 통상 최저매각가격의 10%입니다." },
    { term: "명도(인도)", desc: "매수인이 대금을 완납하여 소유권을 취득한 후 점유자로부터 부동산을 온전히 넘겨받는 과정입니다." },
    { term: "물상보증인", desc: "타인의 채무를 위해 자신의 재산을 담보로 제공한 사람입니다." },
    { term: "미등기건물", desc: "건축물대장에는 등재되어 있으나 소유권보존등기가 되어 있지 않은 건물입니다." },
    { term: "배당", desc: "매각대금으로 채권자들에게 채권의 우선순위에 따라 나누어 주는 절차입니다." },
    { term: "배당기일", desc: "법원이 매각대금을 채권자들에게 배당하기 위해 이해관계인을 소환하는 날짜입니다." },
    { term: "배당요구", desc: "압류채권자 이외의 채권자가 매각대금으로부터 배당을 받기 위해 법원에 요구하는 절차입니다." },
    { term: "배당요구종기", desc: "채권자들이 배당요구를 할 수 있는 마지막 날짜로 통상 첫 매각기일 이전으로 정해집니다." },
    { term: "배당이의", desc: "배당기일에 작성된 배당표의 내용에 불복하여 이의를 제기하는 것입니다." },
    { term: "배당표", desc: "법원이 배당기일에 매각대금을 채권자들에게 나누어 주기 위해 우선순위와 배당액을 확정하여 작성한 문서입니다." },
    { term: "법정매각조건", desc: "법률에 의하여 정해진 매각조건으로 모든 경매절차에 공통적으로 적용됩니다." },
    { term: "법정지상권", desc: "토지와 건물의 소유자가 다를 때 건물을 철거하지 않고 토지를 사용할 수 있도록 법률상 인정되는 권리입니다." },
    { term: "보전처분", desc: "권리나 목적물의 현상이 변경되어 장래 강제집행이 불가능해지는 것을 막기 위해 임시로 취하는 조치입니다." },
    { term: "본안소송", desc: "가압류, 가처분 등의 보전처분이나 강제집행의 기초가 되는 권리의 존부를 확정하기 위한 본래의 소송입니다." },
    { term: "부동산인도명령", desc: "매수인이 대금 완납 후 정당한 이유 없이 부동산을 비워주지 않는 점유자를 상대로 법원에 신청하여 강제로 퇴거시키는 제도입니다." },
    { term: "분할매각", desc: "동일인 소유의 여러 개 부동산을 경매할 때 이를 개별로 나누어 매각하는 방식입니다." },
    { term: "사건번호", desc: "법원에 접수된 사건에 부여되는 고유 번호(예: 2023타경1234)입니다." },
    { term: "새매각", desc: "매각기일에 낙찰자가 없거나 매각불허가결정이 난 경우 새로운 매각기일을 정하여 실시하는 경매입니다." },
    { term: "선순위", desc: "권리 설정의 순서가 다른 권리보다 앞서는 것을 말합니다." },
    { term: "소명", desc: "법관이 확실하다고 믿게 할 정도는 아니지만 그럴듯하다고 추측할 수 있을 정도로 증거를 제출하는 것입니다." },
    { term: "소멸주의", desc: "경매의 매각으로 인하여 부동산에 설정된 저당권 등의 담보물권이 소멸하는 원칙입니다." },
    { term: "소유권이전등기", desc: "매수인이 매각대금을 완납하여 소유권을 취득한 사실을 등기부에 기입하는 절차입니다." },
    { term: "소액임차인", desc: "보증금액이 일정 기준 이하인 임차인으로서 일정액을 최우선으로 변제받을 수 있는 사람입니다." },
    { term: "송달", desc: "법원이 재판서나 기타 서류를 당사자나 소송관계인에게 법정 방식에 따라 보내는 행위입니다." },
    { term: "송달료", desc: "법원이 서류를 송달하는 데 필요한 우편요금 등의 비용입니다." },
    { term: "압류", desc: "강제집행의 첫 단계로 채무자의 재산 처분권을 법률상 제한하는 조치입니다." },
    { term: "압류의 경합", desc: "하나의 재산에 대하여 두 개 이상의 강제경매 또는 체납처분에 의한 압류가 겹치는 경우입니다." },
    { term: "어음", desc: "일정한 금액의 지급을 목적으로 하는 유가증권입니다." },
    { term: "우선변제권", desc: "대항력을 갖춘 임차인이 확정일자를 받으면 후순위권리자보다 우선하여 보증금을 변제받을 수 있는 권리입니다." },
    { term: "우편송달", desc: "법원이 우편으로 서류를 송달하는 방식입니다." },
    { term: "유찰", desc: "매각기일에 입찰자가 없어 매각이 성립되지 않은 상태를 말합니다." },
    { term: "유치권", desc: "타인의 물건을 점유한 자가 그 물건에 관하여 생긴 채권(공사대금 등)을 변제받을 때까지 인도를 거절할 수 있는 권리입니다." },
    { term: "이중경매", desc: "이미 경매절차가 진행 중인 부동산에 대하여 다른 채권자가 다시 경매를 신청하는 경우입니다." },
    { term: "이의신청", desc: "법원의 결정이나 명령에 대하여 불복하여 취소나 변경을 구하는 신청입니다." },
    { term: "인도", desc: "물건에 대한 사실상의 지배(점유)를 타인에게 이전하는 것을 말합니다." },
    { term: "인수주의", desc: "부동산의 매각으로 인하여 소멸하지 않고 매수인이 그 부담을 떠안게 되는 원칙입니다." },
    { term: "일괄매각", desc: "여러 개의 재산을 하나로 묶어서 동시에 매각하는 것이 타당하다고 법원이 판단하여 진행하는 방식입니다." },
    { term: "임금채권", desc: "근로자가 사용자에게 근로의 대가로 청구할 수 있는 권리로, 경매 배당 시 최우선변제권이 인정되는 경우가 있습니다." },
    { term: "임의경매", desc: "담보물권을 가진 채권자가 채무 불이행 시 담보권을 실행하여 진행하는 경매 절차입니다." },
    { term: "입찰", desc: "경매 목적물을 매수하고자 하는 사람이 희망 가격을 서면으로 제출하는 행위입니다." },
    { term: "입찰보증금", desc: "입찰에 참여하기 위해 제공하는 보증금입니다." },
    { term: "이해관계인", desc: "경매절차에 법률상 이해관계를 가진 자로, 권리신고를 한 사람 등을 말합니다." },
    { term: "재매각", desc: "낙찰자가 대금지급기한까지 대금을 납부하지 않은 경우 법원이 다시 실시하는 경매입니다." },
    { term: "저당권", desc: "채무 불이행 시 담보로 제공된 부동산에서 다른 채권자보다 우선하여 변제받을 수 있는 권리입니다." },
    { term: "전세권", desc: "전세금을 지급하고 타인의 부동산을 사용, 수익하며 그 부동산 전부에서 전세금의 우선변제를 받을 수 있는 권리입니다." },
    { term: "전세권설정등기", desc: "전세권을 취득하기 위해 등기부에 그 내용을 기록하는 것입니다." },
    { term: "제시외건물", desc: "경매신청서나 등기부에는 기재되어 있지 않으나 실제 목적물 토지 위에 존재하는 건물이나 종물입니다." },
    { term: "조세채권", desc: "국가나 지방자치단체가 세금을 징수할 권리로, 법정기일에 따라 배당 순위가 달라집니다." },
    { term: "주택임대차보호법", desc: "주거용 건물의 임대차에 관하여 민법에 대한 특례를 규정하여 국민 주거생활의 안정을 보장하는 법률입니다." },
    { term: "즉시항고", desc: "재판의 성질상 신속하게 확정지어야 할 필요가 있는 결정 등에 대하여 일정 기간 내에 불복하여 제기하는 항고입니다." },
    { term: "지상권", desc: "타인의 토지에 건물 기타 공작물이나 수목을 소유하기 위하여 그 토지를 사용하는 권리입니다." },
    { term: "집행관", desc: "법원의 명령에 따라 강제집행, 서류의 송달 등을 수행하는 독립된 단독기관입니다." },
    { term: "집행권원", desc: "국가의 강제력을 빌려 채권자가 채무자의 재산에 강제집행을 할 수 있도록 하는 공적인 문서(판결문 등)입니다." },
    { term: "차순위매수신고", desc: "최고가매수신고인이 대금을 납부하지 않을 경우 자신이 낙찰을 받겠다고 신고하는 제도입니다." },
    { term: "채권", desc: "특정인이 다른 특정인에게 일정한 행위를 요구할 수 있는 권리입니다." },
    { term: "채권자", desc: "채무자에게 일정한 행위(채무 이행)를 청구할 권리를 가진 사람입니다." },
    { term: "채무자", desc: "채권자에게 일정한 행위(채무 이행)를 해야 할 의무를 가진 사람입니다." },
    { term: "체납처분", desc: "세금을 내지 않은 사람의 재산을 압류하고 공매 등에 붙여 조세를 징수하는 행정절차입니다." },
    { term: "최고가매수신고인", desc: "매각기일의 입찰 절차에서 가장 높은 가격을 적어낸 사람입니다." },
    { term: "최우선변제권", desc: "소액임차인이 대항요건을 갖추면 보증금 중 일정액을 선순위 담보물권자보다 먼저 변제받을 수 있는 권리입니다." },
    { term: "최저매각가격", desc: "법원이 감정평가액을 참작하여 입찰자가 이 가격 이상으로 응찰해야 한다고 정한 매각의 하한선 가격입니다." },
    { term: "취하", desc: "경매를 신청한 채권자가 그 신청을 철회하는 것을 말합니다." },
    { term: "특별매각조건", desc: "법정매각조건과 달리 개별 사건에서 법원이 이해관계인의 합의나 직권으로 변경하여 정한 조건입니다." },
    { term: "항고", desc: "법원의 결정이나 명령에 대하여 불복하여 상급법원에 심판을 구하는 절차입니다." },
    { term: "호가경매", desc: "입찰자들이 말로써 계속 높은 가격을 불러 가장 높은 가격을 부른 사람을 매수인으로 정하는 방식입니다." },
    { term: "확정일자", desc: "증서가 작성된 날짜에 완전한 증거력이 있다고 법률상 인정되는 일자입니다." },
    { term: "환가", desc: "압류된 재산을 금전으로 바꾸는 절차를 말합니다." },
    { term: "환지", desc: "토지구획정리사업 등에 의해 기존의 토지 대신 새로이 배정받는 토지입니다." }
  ];

  const filteredTerms = auctionTerms.filter(item => 
    item.term.includes(searchTerm) || item.desc.includes(searchTerm)
  );

  // ==========================================
  // 3. 경매서식 다운로드
  // ==========================================
  const realEstateForms = [
    { title: "37. 전세사기피해자 지원 및 주거안정에 관한 특별법에 따른 임차인 우선매수신고서" },
    { title: "36. 전세사기피해자 지원 및 주거안정에 관한 특별법에 따른 경매유예등 신청서" },
    { title: "35. 권리신고 및 배당요구신청서(주택임대차)" },
    { title: "34. 권리신고 및 배당요구신청서(상가임대차)" },
    { title: "33. 사법보좌관의 처분에 대한 이의신청서" },
    { title: "32. 부동산임의경매신청서" },
    { title: "31. 부동산강제경매신청서" },
    { title: "30. 차액지급신고서" },
    { title: "29. 자동차소유권이전등기 및 말소등록촉탁신청서" },
    { title: "28. 기간입찰용 입금증명서" },
    { title: "27. 공동입찰신고서 및 공동입찰자목록" },
    { title: "26. 임차인 우선매수신고서" },
    { title: "25. 공유자 우선매수신고서" },
    { title: "24. 기간입찰표 및 위임장" },
    { title: "23. 기일입찰표 및 위임장" },
    { title: "22. 부동산소유권이전등기 촉탁신청서" },
    { title: "21. 매각결정취소 신청서" },
    { title: "20. 부동산인도명령 신청서" },
    { title: "19. 명도확인서" },
    { title: "18. 부기 및 환부신청서" },
    { title: "17. 배당액 영수증" },
    { title: "16. 매각대금완납증명원" },
    { title: "15. 매각대금납입신청서" },
    { title: "14. 채권상계신청서" },
    { title: "13. 법원보관금 환급신청서" },
    { title: "12. 항고장" },
    { title: "11. 매각허가에 대한 이의신청서" },
    { title: "10. 부동산경매개시결정에 대한 이의신청" },
    { title: "9. 강제경매개시결정에 대한 이의신청" },
    { title: "8. 집행관 송달신청서" },
    { title: "7. 경매취하동의서" },
    { title: "6. 경매취하서" },
    { title: "5. 입찰(경매)기일 변경(연기) 신청서" },
    { title: "4. 배당요구신청" },
    { title: "3. 채권계산서" },
    { title: "2. 보정서" },
    { title: "1. 부동산일괄매각신청" }
  ];

  const movableForms = [
    { title: "24. 청구금액계산서" },
    { title: "23. 동산경매 신청서" },
    { title: "22. 해임 신청서" },
    { title: "21. 포괄계좌입금 해지 신청서" },
    { title: "20. 포괄계좌입금 신청서" },
    { title: "19. 집행조서등본 신청서" },
    { title: "18. 집행정지 집행취소 신청서" },
    { title: "17. 집행속행 신청서" },
    { title: "16. 증명원" },
    { title: "15. 입찰표" },
    { title: "14. 임의변제 신청서" },
    { title: "13. 이해관계 진술서" },
    { title: "12. 위임장" },
    { title: "11. 배우자 배당요구 신청서" },
    { title: "10. 매각촉구 신청서" },
    { title: "9. 공동입찰자목록" },
    { title: "8. 공동입찰 신고서" },
    { title: "7. 계좌입금 신청서" },
    { title: "6. 강제집행 추가 위임장" },
    { title: "5. 강제집행 진행에 관한 신청서" },
    { title: "4. 강제집행 신청 취하서 등" },
    { title: "3. 강제집행 신청서" },
    { title: "2. 감축 신청서" },
    { title: "1. 감정장소약도" }
  ];

  // ==========================================
  // 4. 유용한 참고 사이트 데이터 (직접 다운받은 로고 파일 연결)
  // ==========================================
  const referenceSites = [
    { name: "온비드 (ONBID)", desc: "공매 물건 검색 및 입찰", url: "https://www.onbid.co.kr/", logo: "/logos/onbid.png" },
    { name: "대법원 법원경매정보", desc: "법원 경매 물건 확인 및 공고 검색", url: "https://www.courtauction.go.kr/", logo: "/logos/court.png" },
    { name: "인터넷등기소", desc: "등기사항전부증명서(등기부등본) 등 등기사항 확인 및 발급", url: "http://www.iros.go.kr/", logo: "/logos/iros.png" },
    { name: "정부24 (구 민원24)", desc: "토지대장, 건축물대장, 주민등록표 등 기타 민원 서류 발급", url: "https://www.gov.kr/", logo: "/logos/gov.png" },
    { name: "토지이음", desc: "토지이용계획, 도시계획, 지적도, 지도 및 기타 규제 정보 확인", url: "https://www.eum.go.kr/", logo: "/logos/eum.png" },
    { name: "씨리얼 (SEE:REAL)", desc: "토지정보, 종합 부동산 정보, 지도 및 통계 서비스", url: "https://seereal.lh.or.kr/", logo: "/logos/seereal.png" },
    { name: "카카오맵", desc: "위성지도, 로드뷰, 지적편집도 및 기타 현장 임장 주변 환경 파악", url: "https://map.kakao.com/", logo: "/logos/kakao.png" },
    { name: "학구도안내서비스 (스쿨존)", desc: "주소지별 배정 초/중/고등학교 학구도 안내 및 지도 서비스", url: "https://schoolzone.emac.kr/", logo: "/logos/schoolzone.png" },
    { name: "네이버 부동산", desc: "주변 부동산 매물 등 시세 파악 및 기타 지역 부동산 정보", url: "https://land.naver.com/", logo: "/logos/naver.png" },
    { name: "유암코 (UAMCO)", desc: "연합자산관리. NPL(부실채권) 및 유동화 보유물건 검색", url: "https://www.uamco.co.kr/", logo: "/logos/uamco.png" }
  ];

  // ==========================================
  // 5. 전국 법원 안내 데이터 (URL 링크 완벽 제거됨!)
  // ==========================================
  const courtData: Record<RegionType, { name: string, address: string, phone: string, jurisdiction: string }[]> = {
    '수도권': [
      { name: "서울중앙지방법원", address: "서울특별시 서초구 서초중앙로 157 (서초동)", phone: "02)530-1114", jurisdiction: "종로구, 중구, 강남구, 서초구, 관악구, 동작구" },
      { name: "서울동부지방법원", address: "서울특별시 송파구 법원로 101 (문정동)", phone: "02)2204-2114", jurisdiction: "성동구, 광진구, 강동구, 송파구" },
      { name: "서울서부지방법원", address: "서울특별시 마포구 마포대로 174 (공덕동)", phone: "02)3271-1114", jurisdiction: "용산구, 서대문구, 마포구, 은평구" },
      { name: "서울남부지방법원", address: "서울특별시 양천구 신월로 386(신정동)", phone: "02)2192-1114", jurisdiction: "영등포구, 강서구, 양천구, 구로구, 금천구" },
      { name: "서울북부지방법원", address: "서울특별시 도봉구 마들로749 (도봉2동 626)", phone: "02)910-3114", jurisdiction: "강북구, 노원구, 도봉구, 동대문구, 성북구, 중랑구" },
      { name: "의정부지방법원", address: "경기도 의정부시 녹양로34번길 23 (가능동)", phone: "031)828-0114", jurisdiction: "의정부시, 양주시, 남양주시, 구리시, 연천군, 포천시, 가평군, 동두천시, 철원군" },
      { name: "고양지원", address: "경기도 고양시 일산동구 장백로 209", phone: "031)920-6114", jurisdiction: "고양시, 파주시" },
      { name: "남양주지원", address: "경기도 남양주시 다산중앙로82번안길 161(다산동)", phone: "031)869-4114", jurisdiction: "가평군, 구리시, 남양주시" },
      { name: "인천지방법원", address: "인천광역시 미추홀구 소성로 163번길 17(학익동)", phone: "032)860-1113", jurisdiction: "중구, 동구, 남구, 연수구, 남동구, 부평구, 계양구, 서구, 옹진군, 강화군" },
      { name: "부천지원", address: "경기도 부천시 원미구 상일로 129(상동)", phone: "032)320-1114", jurisdiction: "부천시, 김포시" },
      { name: "수원지방법원", address: "경기도 수원시 영통구 법조로 105, 하동, 수원법원종합청사", phone: "031)210-1114", jurisdiction: "수원시, 오산시, 화성시, 용인시" },
      { name: "성남지원", address: "경기도 성남시 수정구 산성대로 451 (단대동)", phone: "031)737-1558", jurisdiction: "성남시, 광주시, 하남시" },
      { name: "여주지원", address: "경기도 여주시 현암동 640-10 (현암로 21-12)", phone: "031)880-7500", jurisdiction: "여주시, 이천시, 양평군" },
      { name: "평택지원", address: "경기도 평택시 평남로 1036 (동삭동)", phone: "031)650-3114", jurisdiction: "평택시, 안성시" },
      { name: "안산지원", address: "경기도 안산시 단원구 광덕서로 75 (고잔동)", phone: "031)481-1114", jurisdiction: "안산시, 광명시, 시흥시" },
      { name: "안양지원", address: "경기도 안양시 동안구 관평로 212번길 70 (관양동)", phone: "031)8086-1114", jurisdiction: "안양시, 군포시, 의왕시, 과천시" }
    ],
    '충청권': [
      { name: "청주지방법원", address: "충청북도 청주시 서원구 산남로 62번길 51 (산남동)", phone: "043)249-7114", jurisdiction: "청주시, 보은군, 괴산군, 증평군, 진천군" },
      { name: "충주지원", address: "충청북도 충주시 계명대로 103 (교현2동 720-2)", phone: "043)841-9119", jurisdiction: "음성군, 충주시" },
      { name: "제천지원", address: "충청북도 제천시 칠성로 53 (중앙로2가 16-2)", phone: "043)640-2070", jurisdiction: "제천시, 단양군" },
      { name: "영동지원", address: "충청북도 영동군 영동읍 영동황간로 99 (매천리 306)", phone: "043)740-4000", jurisdiction: "영동군, 옥천군" },
      { name: "대전지방법원", address: "대전광역시 서구 둔산중로 78번길 45 (둔산동)", phone: "042)470-1114", jurisdiction: "서구, 유성구, 대덕구, 중구, 동구, 세종특별자치시, 금산군" },
      { name: "홍성지원", address: "충청남도 홍성군 홍성읍 법원로 38 (월산리 848)", phone: "041)640-3100", jurisdiction: "서천군, 보령시, 홍성군, 예산군" },
      { name: "논산지원", address: "충청남도 논산시 강경읍 계백로 99 (대흥리 46-1)", phone: "041)746-2700", jurisdiction: "논산시, 계룡시, 부여군" },
      { name: "천안지원", address: "충청남도 천안시 동남구 청수14로 77 (청당동 476)", phone: "041)620-3000", jurisdiction: "천안시, 아산시" },
      { name: "공주지원", address: "충청남도 공주시 한적2길 34-15 (금흥동 610-1)", phone: "041)840-5700", jurisdiction: "공주시, 청양군" },
      { name: "서산지원", address: "충청남도 서산시 공림4로 24 (예천동 600)", phone: "041)660-0600", jurisdiction: "서산시, 당진시, 태안군" }
    ],
    '강원권': [
      { name: "춘천지방법원", address: "강원도 춘천시 공지로 284 (효자2동)", phone: "033)259-9000", jurisdiction: "춘천시, 인제군, 홍천군, 양구군, 화천군" },
      { name: "강릉지원", address: "강원도 강릉시 동해대로 3288-18 (난곡동)", phone: "033)640-1000", jurisdiction: "강릉시, 동해시, 삼척시" },
      { name: "원주지원", address: "강원도 원주시 시청로149 (무실동)", phone: "033)738-1000", jurisdiction: "원주시, 횡성군" },
      { name: "속초지원", address: "강원도 속초시 법대로 15 (동명동)", phone: "033)639-7600", jurisdiction: "속초시, 고성군, 양양군" },
      { name: "영월지원", address: "강원도 영월읍 영월향교1길 53 (영흥리)", phone: "033)371-1114", jurisdiction: "영월군, 정선군, 태백시, 평창군" }
    ],
    '경남권': [
      { name: "부산지방법원", address: "부산광역시 연제구 법원로 31(거제동 1500)", phone: "051)590-1114", jurisdiction: "중구, 서구(등기만), 동구, 영도구, 부산진구, 동래구, 연제구, 금정구" },
      { name: "동부지원", address: "부산광역시 해운대구 재반로 112번길 20번 (재송동1133)", phone: "051)780-1114", jurisdiction: "해운대구, 남구, 수영구, 기장군" },
      { name: "서부지원", address: "부산광역시 강서구 명지국제7로 77 (명지동)", phone: "051)812-1114", jurisdiction: "서구, 북구, 사상구, 사하구, 강서구" },
      { name: "울산지방법원", address: "울산광역시 남구 법대로 55(옥동 1415)", phone: "052)216-8000", jurisdiction: "울산광역시, 양산시" },
      { name: "창원지방법원", address: "경상남도 창원시 성산구 창이대로 681", phone: "055)266-2200", jurisdiction: "창원시 성산구, 창원시 의창구, 진해구, 김해시" },
      { name: "진주지원", address: "경상남도 진주시 진양호로 303", phone: "055)760-3300", jurisdiction: "진주시, 사천시, 하동군, 남해군, 산청군" },
      { name: "통영지원", address: "경상남도 통영시 용남면 동달안길 67", phone: "055)640-8500", jurisdiction: "통영시, 거제시, 고성군" },
      { name: "밀양지원", address: "경상남도 밀양시 밀양대로 1993-20 (내이동)", phone: "055)350-2500", jurisdiction: "밀양시, 창녕군" },
      { name: "거창지원", address: "경상남도 거창군 거창읍 죽전1길 31", phone: "055)940-7170", jurisdiction: "거창군, 합천군, 함양군" },
      { name: "마산지원", address: "경상남도 창원시 마산합포구 완월동 7길 16", phone: "055)240-9300", jurisdiction: "마산시 합포구, 마산시 회원구, 의령군, 함안군" }
    ],
    '경북권': [
      { name: "대구지방법원", address: "대구광역시 수성구 동대구로 364 (범어동 176-1)", phone: "053)757-6600", jurisdiction: "대구광역시, 영천시, 경산시, 청도군, 칠곡군" },
      { name: "서부지원", address: "대구광역시 달서구 장산남로 30 (용산동 230)", phone: "053)570-2114", jurisdiction: "서구, 달서구, 달성군, 성주군, 고령군" },
      { name: "안동지원", address: "경상북도 안동시 강남로 304 (정하동 235-1)", phone: "054)850-5090", jurisdiction: "안동시, 영주시, 봉화군" },
      { name: "경주지원", address: "경상북도 경주시 화랑로 89 (동부동 203)", phone: "054)770-4300", jurisdiction: "경주시" },
      { name: "김천지원", address: "경상북도 김천시 물망골길 39 (삼락동 1225)", phone: "054)420-2114", jurisdiction: "김천시, 구미시" },
      { name: "상주지원", address: "경상북도 상주시 북천로 17-9 (만산동 652-2)", phone: "054)530-5500", jurisdiction: "상주시, 문경시, 예천군" },
      { name: "의성지원", address: "경상북도 의성군 의성읍 군청길 67 (중리리 748-7)", phone: "054)830-8030", jurisdiction: "의성군, 군위군, 청송군" },
      { name: "영덕지원", address: "경상북도 영덕군 영덕읍 경동로 8337 (화개리 226-1)", phone: "054)730-3000", jurisdiction: "영덕군, 울진군, 영양군" },
      { name: "포항지원", address: "경상북도 포항시 북구 법원로 181 (양덕동 768)", phone: "054)250-3050", jurisdiction: "포항시, 울릉군" }
    ],
    '전라권': [
      { name: "광주지방법원", address: "광주광역시 동구 준법로 7-12(지산2동)", phone: "062)239-1114", jurisdiction: "광주광역시, 나주시, 화순군, 장성군, 담양군, 곡성군, 영광군" },
      { name: "목포지원", address: "전라남도 목포시 정의로 29 (옥암동)", phone: "061)270-6600", jurisdiction: "목포시, 무안군, 신안군, 함평군, 영암군" },
      { name: "장흥지원", address: "전라남도 장흥군 장흥읍 읍성로 121-1 (남동리)", phone: "061)860-1500", jurisdiction: "장흥군, 강진군" },
      { name: "순천지원", address: "전라남도 순천시 왕지로 21 (왕지동)", phone: "061)729-5114", jurisdiction: "순천시, 여수시, 광양시, 고흥군, 보성군, 구례군" },
      { name: "해남지원", address: "전라남도 해남군 해남읍 중앙1로 330 (구교리)", phone: "061)534-9151", jurisdiction: "해남군, 완도군, 진도군" },
      { name: "전주지방법원", address: "전라북도 전주시 덕진구 가인로 33(만성동)", phone: "063)259-5437", jurisdiction: "김제시, 무주군, 완주군, 임실군, 전주시 덕진구, 전주시 완산구, 진안군" },
      { name: "군산지원", address: "전라북도 군산시 법원로 68", phone: "063)450-5000", jurisdiction: "군산시, 익산시" },
      { name: "정읍지원", address: "전라북도 정읍시 수성6로 29", phone: "063)570-1000", jurisdiction: "정읍시, 부안군, 고창군" },
      { name: "남원지원", address: "전라북도 남원시 용성로 59 (동충동 141)", phone: "063)620-2700", jurisdiction: "남원시, 순창군, 장수군" }
    ],
    '제주권': [
      { name: "제주지방법원", address: "제주특별자치도 제주시 남광북5길 3 (이도2동)", phone: "064)729-2000", jurisdiction: "제주시, 서귀포시" }
    ]
  };

  return (
    <Layout>
      <div className="w-full flex-grow flex justify-center bg-slate-50 py-8 md:py-12 px-4">
        <div className="w-full max-w-7xl flex flex-col md:flex-row gap-8">
          
          {/* 좌측 사이드바 메뉴 */}
          <aside className="w-full md:w-64 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24">
              <h2 className="text-lg font-extrabold text-gray-800 mb-4 pl-2 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" /> 경매지식창고
              </h2>
              <nav className="flex flex-col gap-1.5">
                {[
                  { id: 'process', icon: <Landmark className="w-4 h-4" />, label: '경매절차 안내' },
                  { id: 'terms', icon: <BookOpen className="w-4 h-4" />, label: '경매용어' },
                  { id: 'forms', icon: <ScrollText className="w-4 h-4" />, label: '경매서식 다운로드' },
                  { id: 'reference', icon: <Globe className="w-4 h-4" />, label: '유용한 참고 사이트' },
                  { id: 'courts', icon: <MapPin className="w-4 h-4" />, label: '전국 법원 안내' },
                ].map((menu) => (
                  <button
                    key={menu.id}
                    onClick={() => setActiveTab(menu.id as TabType)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                      activeTab === menu.id 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                    }`}
                  >
                    {menu.icon} {menu.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* 우측 메인 콘텐츠 영역 */}
          <section className="flex-grow min-w-0">
            
            {/* 1. 경매절차 탭 */}
            {activeTab === 'process' && (
              <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">대법원 경매 절차</h3>
                    <p className="text-gray-500 text-sm">대한민국 법원에서 규정하는 경매 진행 순서입니다.</p>
                  </div>
                  
                  <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-center">
                    <button 
                      onClick={() => setProcessType('realEstate')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${processType === 'realEstate' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      부동산 경매
                    </button>
                    <button 
                      onClick={() => setProcessType('movable')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${processType === 'movable' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      동산 경매
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-6 relative">
                  <div className="hidden md:block absolute left-[31px] top-6 bottom-6 w-0.5 bg-indigo-100 z-0"></div>
                  
                  {(processType === 'realEstate' ? realEstateProcess : movableProcess).map((step, index) => (
                    <div key={index} className="flex items-start gap-5 z-10">
                      <div className="shrink-0 w-16 h-16 bg-white border-2 border-indigo-100 text-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                        {step.icon}
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl flex-grow border border-slate-100 hover:border-indigo-200 transition-colors shadow-sm">
                        <h4 className="text-lg font-extrabold text-indigo-900 mb-3">{step.title}</h4>
                        <p className="text-gray-700 text-[15px] leading-loose break-keep whitespace-pre-wrap">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. 경매용어 탭 */}
            {activeTab === 'terms' && (
              <div className="flex flex-col items-center">
                <div className="w-full relative mb-6">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-gray-400" />
                  </div>
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-all bg-white shadow-sm placeholder-gray-400 text-sm" 
                    placeholder="총 86개의 법원 경매 용어를 검색해 보세요"
                  />
                </div>

                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {filteredTerms.length > 0 ? (
                    filteredTerms.map((item, index) => (
                      <div key={index} className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col h-full hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-indigo-100 transition-all">
                        <h3 className="text-xl font-extrabold text-indigo-900 mb-3 flex items-center gap-2">
                          <ChevronRight className="w-5 h-5 text-indigo-400" /> {item.term}
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed pl-7 break-keep">{item.desc}</p>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-1 md:col-span-2 text-center py-16 bg-white rounded-3xl border border-gray-100 text-gray-500">
                      <Search className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                      검색 결과가 없습니다. 다른 단어로 검색해 보세요.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. 경매서식 다운로드 탭 */}
            {activeTab === 'forms' && (
              <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">경매서식 다운로드</h3>
                    <p className="text-gray-500 text-sm">대법원 법원경매에 등록된 총 61개의 공식 서식을 다운로드하실 수 있습니다.</p>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-center">
                    <button 
                      onClick={() => setFormType('realEstate')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${formType === 'realEstate' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      부동산 경매 서식
                    </button>
                    <button 
                      onClick={() => setFormType('movable')}
                      className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${formType === 'movable' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      동산 경매 서식
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {(formType === 'realEstate' ? realEstateForms : movableForms).map((form, index) => (
                    <div key={index} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-200 transition-colors shadow-sm">
                      <div className="flex items-center gap-4 mb-3 md:mb-0">
                        <div className="p-2 bg-white border border-gray-200 rounded-lg text-indigo-400 shadow-sm shrink-0">
                          <FileDown className="w-5 h-5" />
                        </div>
                        <h4 className="text-[15px] font-bold text-gray-700 break-keep">{form.title}</h4>
                      </div>
                      
                      <div className="flex gap-2 shrink-0 ml-[52px] md:ml-0">
                        <a 
                          href={`/forms/${form.title}.hwp`} 
                          download={`${form.title}.hwp`}
                          className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-white hover:bg-blue-50 border border-blue-100 rounded-md transition-colors shadow-sm"
                        >
                          HWP
                        </a>
                        <a 
                          href={`/forms/${form.title}.doc`} 
                          download={`${form.title}.doc`}
                          className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-white hover:bg-indigo-50 border border-indigo-100 rounded-md transition-colors shadow-sm"
                        >
                          WORD
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. 유용한 참고 사이트 탭 (대표님이 직접 준비한 로고 파일을 연결하는 컴포넌트 복구 완료!) */}
            {activeTab === 'reference' && (
              <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-gray-100">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">유용한 참고 사이트</h3>
                  <p className="text-gray-500 text-sm">경매 정보 검색 및 공적 장부 열람에 필수적인 공식 웹사이트 모음입니다.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {referenceSites.map((site, index) => (
                    <a key={index} href={site.url} target="_blank" rel="noopener noreferrer" className="flex flex-col p-6 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm shrink-0 overflow-hidden">
                            {/* 다운로드하신 로고 파일 경로를 바라보도록 설정되었습니다. */}
                            <LocalSiteLogo src={site.logo} alt={`${site.name} 로고`} />
                          </div>
                          <h4 className="text-lg font-bold text-gray-800 group-hover:text-indigo-700 transition-colors">{site.name}</h4>
                        </div>
                        <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed break-keep">{site.desc}</p>
                    </a>
                  ))}
                </div>

            
              </div>
            )}

            {/* 5. 전국 법원 안내 탭 (법원 이름 링크 완벽 제거됨!) */}
            {activeTab === 'courts' && (
              <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-gray-100">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">전국 법원 안내</h3>
                  <p className="text-gray-500 text-sm">실전 경매 입찰을 위한 전국 법원 및 지원의 연락처와 관할 구역 정보입니다.</p>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-8 bg-slate-50 p-2 rounded-xl border border-gray-100">
                  {(Object.keys(courtData) as RegionType[]).map((region) => (
                    <button
                      key={region}
                      onClick={() => setActiveRegion(region)}
                      className={`px-5 py-2.5 rounded-lg text-[15px] font-bold transition-all ${
                        activeRegion === region 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-gray-600 hover:bg-white hover:shadow-sm'
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {courtData[activeRegion].map((court, index) => (
                    <div key={index} className="p-6 bg-white border border-gray-200 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:border-indigo-300 hover:shadow-md transition-all">
                      
                      {/* 링크를 빼고 깔끔하게 텍스트로만 보여주도록 변경되었습니다! */}
                      <div className="flex items-center gap-1.5 mb-4">
                        <h4 className="text-[17px] font-extrabold text-indigo-900">
                          {court.name}
                        </h4>
                      </div>
                      
                      <div className="flex flex-col gap-3 text-[14px]">
                        <div className="flex items-start gap-2.5">
                          <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                          <span className="text-gray-700 leading-relaxed">{court.address}</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <Phone className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                          <span className="text-gray-700 font-medium">{court.phone}</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <Map className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                          <span className="text-gray-600 leading-relaxed break-keep">
                            <strong className="font-semibold text-gray-700">관할구역:</strong> {court.jurisdiction}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
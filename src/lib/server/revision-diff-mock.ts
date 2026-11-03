const unchanged = Array.from(
	{ length: 60 },
	(_, index) => `현행 제도 ${index + 1}항은 지역별 수요와 지원 실적을 반영하여 운영하도록 함.\n`
).join('');

export const REVISION_DIFF_MOCK = {
	noticeNum: 2210004,
	before: `${unchanged}지원 대상을 중소기업으로 정함.\n${unchanged}공포 후 6개월이 경과한 날부터 시행함.\n${unchanged}`,
	after: `${unchanged}지원 대상을 중소기업 및 소상공인으로 정함.\n${unchanged}공포 후 1년이 경과한 날부터 시행함.\n${unchanged}`
};

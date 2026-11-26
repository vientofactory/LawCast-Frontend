export type LegalNoticeInline =
	| { text: string; href?: string; source?: undefined }
	| { source: number; text?: undefined; href?: undefined };

export interface LegalNotice {
	id: string;
	recordedOn: string;
	reviewedOn: string;
	changeSummary: string;
	title: string;
	intro: string;
	sections: {
		id: string;
		title: string;
		paragraphs: LegalNoticeInline[][];
		emailTemplate?: { to: string; subject: string; body: string };
	}[];
	sources: { title: string; href: string; note: string }[];
}

export interface LegalNoticePageData {
	notice: LegalNotice;
	versions: Pick<LegalNotice, 'id' | 'recordedOn' | 'changeSummary'>[];
	isCurrent: boolean;
	canonicalPath: string;
}

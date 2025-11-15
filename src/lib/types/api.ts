export interface Notice {
	num: number;
	subject: string;
	proposerCategory: string;
	committee: string;
	numComments: number;
	link: string;
}

export interface WebhookStats {
	total: number;
	active: number;
	inactive: number;
	efficiency?: number;
}

export interface CacheInfo {
	size: number;
	lastUpdated: string | null;
	maxSize: number;
	isInitialized?: boolean;
}

export interface SystemStats {
	webhooks: WebhookStats;
	cache: CacheInfo;
}

export interface SystemHealthStats {
	total: number;
	active: number;
	inactive: number;
	oldInactive: number;
	recentInactive: number;
	efficiency: number;
}

export interface SystemHealth {
	efficiency: number;
	stats: SystemHealthStats;
	status: 'healthy' | 'needs_optimization';
}

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
	errors?: string[];
}

export interface WebhookRegistrationRequest {
	url: string;
	recaptchaToken: string;
}

export interface WebhookValidationResult {
	isValid: boolean;
	message?: string;
}

export interface ApiError extends Error {
	status?: number;
	response?: {
		status: number;
		data?: {
			message?: string;
			errors?: string[];
		};
	};
}

import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
export function load() {
	if (env.E2E_NOTIFICATIONS !== '1') error(404, '페이지를 찾을 수 없습니다.');
	return {};
}

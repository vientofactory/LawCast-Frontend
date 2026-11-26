import { loadLegalNotice } from '#lib/server/legal-notices.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => loadLegalNotice();

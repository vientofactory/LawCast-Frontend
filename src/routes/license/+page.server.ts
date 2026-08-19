import type { ServerLoad } from '@sveltejs/kit';
// Statically imported so Vite inlines the data at build time; Cloudflare
// Pages' Workers runtime has no filesystem access for readFileSync at request time.
import pkg from '../../../package.json';
import lock from '../../../package-lock.json';

export interface PackageEntry {
	name: string;
	version: string;
	license: string;
	note?: string;
}

const NOTES: Record<string, string> = {
	'@fortawesome/free-brands-svg-icons': '아이콘: CC-BY-4.0, 코드: MIT',
	'@fortawesome/free-solid-svg-icons': '아이콘: CC-BY-4.0, 코드: MIT',
	'@fontsource/pretendard': '폰트 라이선스'
};

function normalizeLicense(raw: string | undefined): string {
	if (!raw) return 'Unknown';
	return raw.replace(/^\(|\)$/g, '');
}

type LockfilePackages = Record<string, { version?: string; license?: string }>;

function loadPackagesFromLockfile(
	pkg: { dependencies?: Record<string, string> },
	lock: { packages?: LockfilePackages }
): PackageEntry[] {
	const lockPkgs = lock.packages ?? {};

	return Object.keys(pkg.dependencies ?? {}).map((name) => {
		const entry = lockPkgs[`node_modules/${name}`];
		const license = normalizeLicense(entry?.license);
		const note = NOTES[name];
		return {
			name,
			version: entry?.version ?? pkg.dependencies?.[name] ?? '',
			license,
			...(note ? { note } : {})
		};
	});
}

const FRONTEND_PACKAGES: PackageEntry[] = loadPackagesFromLockfile(pkg, lock);

export const load: ServerLoad = async ({ fetch }) => {
	let backendPackages: PackageEntry[] = [];

	try {
		const res = await fetch('/api/packages');
		if (res.ok) {
			const json = (await res.json()) as {
				data?: { name: string; version: string; license: string }[];
			};
			backendPackages = (json.data ?? []).map(({ name, version, license }) => ({
				name,
				version,
				license,
				...(NOTES[name] ? { note: NOTES[name] } : {})
			}));
		}
	} catch {
		backendPackages = [];
	}

	return {
		backendPackages,
		frontendPackages: FRONTEND_PACKAGES
	};
};

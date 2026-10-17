/** Render only validated container IDs into executable head markup. */
export function buildGtmHeadHtml(containerId: string): string {
	if (!/^GTM-[A-Za-z0-9]+$/.test(containerId)) return '';

	// Google commands must use an Arguments object. Apply denied defaults
	// before GTM, then restore analytics consent through an explicit update.
	// Advertising remains denied because the banner asks only about analytics.
	return `<!-- Google Tag Manager -->
<script>(function(w,d){w.dataLayer=w.dataLayer||[];function gtag(){w.dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});try{if(w.localStorage.getItem('lawcast-cookie-consent')==='accepted'){gtag('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});}}catch(e){}w.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName('script')[0],j=d.createElement('script');j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id=${containerId}';f.parentNode.insertBefore(j,f);})(window,document);</script>
<!-- End Google Tag Manager -->`;
}

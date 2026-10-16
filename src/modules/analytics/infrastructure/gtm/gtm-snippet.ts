const GTM_ORIGIN = 'https://www.googletagmanager.com';

/**
 * The standard GTM container snippet: creates `window.dataLayer`, records
 * `gtm.start` and loads `gtm.js` asynchronously. `containerId` must be a
 * validated `GTM-…` id (see `GTM_ID` in the server env): it is inlined.
 */
export function buildGtmLoaderScript(containerId: string): string {
  return (
    "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});" +
    "var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';" +
    `j.async=true;j.src='${GTM_ORIGIN}/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);` +
    `})(window,document,'script','dataLayer','${containerId}');`
  );
}

/** The `<noscript>` iframe url for browsers without JavaScript. */
export function buildGtmNoscriptUrl(containerId: string): string {
  return `${GTM_ORIGIN}/ns.html?id=${encodeURIComponent(containerId)}`;
}

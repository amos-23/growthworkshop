// Optional backoffice configuration.
//
// Leave analyticsEndpoint empty ('') and the dashboard reads the visits and
// events that main.js records in this browser's localStorage (see the
// "Backoffice" section of README.md).
//
// If you later put a server-side collector in front of the site, point this at
// a JSON endpoint returning:
//
//   {
//     "visits": [{ "t": <epoch ms>, "source": "", "medium": "", "campaign": "", "vid": "", "sid": "" }],
//     "events": [{ "t": <epoch ms>, "name": "", "props": {} }]
//   }
window.GAW_ADMIN_CONFIG = {
  analyticsEndpoint: ''
};

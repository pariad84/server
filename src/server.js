require('dotenv').config();
const app = require('./app');
const { watchResources } = require('./services/resource.service');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  // Watching is a process concern, not an app one: requiring the app (in a test, say) should not
  // leave a filesystem watcher behind.
  watchResources();
});

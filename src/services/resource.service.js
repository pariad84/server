const fs = require('fs');
const path = require('path');

// Configurable so tests can point at a fixture directory, and so a deployment can keep its
// definitions outside the bundle.
const DIR = process.env.RESOURCES_DIR
  ? path.resolve(process.env.RESOURCES_DIR)
  : path.join(__dirname, '..', 'resources');

// One save can fire several filesystem events, and an editor may write through a temp file, so a
// burst is left to settle before it is read.
const SETTLE_MS = 50;

// A resource definition is pure data -- the same JSON drives fn's list columns and form fields in
// the browser and this server's write validation, so the two cannot drift.
const read = () =>
  fs
    .readdirSync(DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const definition = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
      const expectedKey = path.basename(file, '.json');
      if (definition.key !== expectedKey) {
        throw new Error(`${file}: key must be "${expectedKey}", got "${definition.key}"`);
      }
      if (!Array.isArray(definition.fields) || !definition.fields.length) {
        throw new Error(`${file}: fields must be a non-empty array`);
      }
      definition.fields.forEach((field) => {
        if (!field.name || !field.form || !field.form.type) {
          throw new Error(`${file}: every field needs a name and a form.type`);
        }
        if (['select', 'radio'].includes(field.form.type) && !Array.isArray(field.form.datas)) {
          throw new Error(`${file}: field "${field.name}" is a ${field.form.type} and needs form.datas`);
        }
      });
      return definition;
    });

const index = () => new Map(read().map((definition) => [definition.key, definition]));

// At boot a malformed definition fails the boot rather than the first request that reaches it.
let definitions = index();

// A reload is not a boot. A file caught half-written, or a definition saved with a typo in it,
// must not take a running server down -- so a failed reload logs and leaves the definitions that
// are already serving in place. Replacing the map is synchronous, so a request in flight sees
// either the old set or the new one, never half of each.
const reload = () => {
  try {
    definitions = index();
    console.log(`Resource definitions reloaded: ${[...definitions.keys()].join(', ') || '(none)'}`);
  } catch (error) {
    console.error(`Resource definitions left unchanged -- reload failed: ${error.message}`);
  }
};

// Adding, editing or removing a resource takes effect without a restart. Set RESOURCES_WATCH to
// false to turn it off, and note that some filesystems cannot watch at all -- that is logged and
// the server runs on with whatever it read at boot.
// Returns the watcher so a caller that owns the process lifecycle -- a test, mainly -- can close
// it. It is unref'd either way: watching should never be the reason a process stays alive.
const watchResources = () => {
  if (process.env.RESOURCES_WATCH === 'false') {
    return null;
  }
  let settle;
  try {
    const watcher = fs.watch(DIR, () => {
      clearTimeout(settle);
      settle = setTimeout(reload, SETTLE_MS);
      settle.unref();
    });
    watcher.unref();
    console.log(`Watching ${DIR} for resource definitions`);
    return watcher;
  } catch (error) {
    console.error(`Resource definitions are not being watched: ${error.message}`);
    return null;
  }
};

const listResources = () => [...definitions.values()];

const getResource = (key) => definitions.get(key);

module.exports = { listResources, getResource, watchResources };

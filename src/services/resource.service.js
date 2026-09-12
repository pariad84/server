const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'resources');

// A resource definition is pure data -- the same JSON drives fn's list columns and form fields in
// the browser and this server's write validation, so the two cannot drift. Definitions are read
// once at startup; a malformed one fails the boot rather than the first request that hits it.
const load = () =>
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

const definitions = new Map(load().map((definition) => [definition.key, definition]));

const listResources = () => [...definitions.values()];

const getResource = (key) => definitions.get(key);

module.exports = { listResources, getResource };

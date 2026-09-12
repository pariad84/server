// Validates a write against the resource definition the browser rendered its form from, so the
// rule lives in one place instead of once in the form and again here. Returns the value to store:
// browsers submit every field as a string, so `number` and `checkbox` are coerced, and a field
// left blank is dropped rather than stored as "" (fn's form renders a missing value as empty).

const isBlank = (value) => value === undefined || value === null || value === '';

const options = (field) => field.form.datas.map((option) => option.value);

const coerce = (field, value) => {
  switch (field.form.type) {
    case 'number':
    case 'range': {
      const number = Number(value);
      return Number.isFinite(number) ? { value: number } : { error: 'must be a number' };
    }
    case 'checkbox':
      return { value: value === true || value === 'true' || value === 'on' };
    case 'select':
    case 'radio':
      return options(field).includes(value)
        ? { value }
        : { error: `must be one of: ${options(field).join(', ')}` };
    case 'date':
    case 'datetime-local':
      return Number.isNaN(Date.parse(value)) ? { error: 'must be a date' } : { value };
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { value } : { error: 'must be an email address' };
    default:
      return typeof value === 'string' ? { value } : { error: 'must be text' };
  }
};

const validateData = (fields, data) => {
  const errors = [];
  const names = fields.map((field) => field.name);

  Object.keys(data)
    .filter((name) => !names.includes(name))
    .forEach((name) => errors.push(`Unknown field: ${name}`));

  const validated = {};

  fields.forEach((field) => {
    const label = field.label || field.name;
    const raw = data[field.name];

    if (isBlank(raw)) {
      if (field.required) {
        errors.push(`${label} is required`);
      }
      return;
    }
    if (typeof raw === 'object') {
      errors.push(`${label} must be a single value`);
      return;
    }

    const { value, error } = coerce(field, raw);
    if (error) {
      errors.push(`${label} ${error}`);
      return;
    }
    validated[field.name] = value;
  });

  return { errors, data: validated };
};

module.exports = validateData;

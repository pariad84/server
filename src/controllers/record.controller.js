const recordService = require('../services/record.service');
const resourceService = require('../services/resource.service');
const validateData = require('../utils/validateData');

// fn.data rows are { id, data } -- the resource lives in the URL, and the storage columns
// (resource/createdAt/updatedAt) stay out of the body the client round-trips.
const toRow = (record) => ({ id: record.id, data: record.data });

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Every route resolves the resource definition first: it is what makes a resource exist at all,
// and on a write it is what the body is checked against.
const resourceOf = (req) => {
  const resource = resourceService.getResource(req.params.resource);
  if (!resource) {
    throw httpError(404, `Unknown resource: ${req.params.resource}`);
  }
  return resource;
};

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id)) {
    throw httpError(400, `Invalid id: ${value}`);
  }
  return id;
};

const parseData = (resource, body) => {
  const data = body ? body.data : undefined;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw httpError(400, 'Body must be { "data": { ... } }');
  }
  const validated = validateData(resource.fields, data);
  if (validated.errors.length) {
    throw Object.assign(httpError(400, validated.errors.join('; ')), { errors: validated.errors });
  }
  return validated.data;
};

const getRecords = async (req, res) => {
  const records = await recordService.listRecords(resourceOf(req).key);
  res.json(records.map(toRow));
};

const getRecord = async (req, res) => {
  const record = await recordService.getRecord(resourceOf(req).key, parseId(req.params.id));
  if (!record) {
    return res.status(404).json({ message: 'Record not found' });
  }
  res.json(toRow(record));
};

const postRecord = async (req, res) => {
  const resource = resourceOf(req);
  const record = await recordService.createRecord(resource.key, parseData(resource, req.body));
  res.status(201).json(toRow(record));
};

const putRecord = async (req, res) => {
  const resource = resourceOf(req);
  const record = await recordService.updateRecord(
    resource.key,
    parseId(req.params.id),
    parseData(resource, req.body),
  );
  if (!record) {
    return res.status(404).json({ message: 'Record not found' });
  }
  res.json(toRow(record));
};

const deleteRecord = async (req, res) => {
  const record = await recordService.deleteRecord(resourceOf(req).key, parseId(req.params.id));
  if (!record) {
    return res.status(404).json({ message: 'Record not found' });
  }
  res.json(toRow(record));
};

module.exports = { getRecords, getRecord, postRecord, putRecord, deleteRecord };

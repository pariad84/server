const recordService = require('../services/record.service');

// fn.data rows are { id, data } -- the resource lives in the URL, and the storage columns
// (resource/createdAt/updatedAt) stay out of the body the client round-trips.
const toRow = (record) => ({ id: record.id, data: record.data });

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id)) {
    throw badRequest(`Invalid id: ${value}`);
  }
  return id;
};

const parseData = (body) => {
  const data = body ? body.data : undefined;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw badRequest('Body must be { "data": { ... } }');
  }
  return data;
};

const getRecords = async (req, res) => {
  const records = await recordService.listRecords(req.params.resource);
  res.json(records.map(toRow));
};

const getRecord = async (req, res) => {
  const record = await recordService.getRecord(req.params.resource, parseId(req.params.id));
  if (!record) {
    return res.status(404).json({ message: 'Record not found' });
  }
  res.json(toRow(record));
};

const postRecord = async (req, res) => {
  const record = await recordService.createRecord(req.params.resource, parseData(req.body));
  res.status(201).json(toRow(record));
};

const putRecord = async (req, res) => {
  const record = await recordService.updateRecord(
    req.params.resource,
    parseId(req.params.id),
    parseData(req.body),
  );
  if (!record) {
    return res.status(404).json({ message: 'Record not found' });
  }
  res.json(toRow(record));
};

const deleteRecord = async (req, res) => {
  const record = await recordService.deleteRecord(req.params.resource, parseId(req.params.id));
  if (!record) {
    return res.status(404).json({ message: 'Record not found' });
  }
  res.json(toRow(record));
};

module.exports = { getRecords, getRecord, postRecord, putRecord, deleteRecord };

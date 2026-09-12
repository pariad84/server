const prisma = require('../config/db');

// Every lookup is scoped by `resource` as well as `id`, so an id belonging to one resource can
// never be read or written through another resource's URL.
const listRecords = (resource) =>
  prisma.record.findMany({ where: { resource }, orderBy: { id: 'asc' } });

const getRecord = (resource, id) => prisma.record.findFirst({ where: { id, resource } });

const createRecord = (resource, data) => prisma.record.create({ data: { resource, data } });

const updateRecord = async (resource, id, data) => {
  const { count } = await prisma.record.updateMany({ where: { id, resource }, data: { data } });
  return count ? prisma.record.findUnique({ where: { id } }) : null;
};

const deleteRecord = async (resource, id) => {
  const record = await getRecord(resource, id);
  if (!record) {
    return null;
  }
  await prisma.record.delete({ where: { id } });
  return record;
};

module.exports = { listRecords, getRecord, createRecord, updateRecord, deleteRecord };

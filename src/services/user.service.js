const prisma = require('../config/db');

const listUsers = () => prisma.user.findMany();

const getUserById = (id) => prisma.user.findUnique({ where: { id } });

const createUser = ({ email, name }) => prisma.user.create({ data: { email, name } });

module.exports = { listUsers, getUserById, createUser };

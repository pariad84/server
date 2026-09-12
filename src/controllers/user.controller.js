const userService = require('../services/user.service');

const getUsers = async (req, res) => {
  const users = await userService.listUsers();
  res.json(users);
};

const getUser = async (req, res) => {
  const user = await userService.getUserById(Number(req.params.id));
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json(user);
};

const postUser = async (req, res) => {
  const { email, name } = req.body;
  const user = await userService.createUser({ email, name });
  res.status(201).json(user);
};

module.exports = { getUsers, getUser, postUser };

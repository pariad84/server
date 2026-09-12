const resourceService = require('../services/resource.service');

const getResources = async (req, res) => {
  res.json(resourceService.listResources());
};

const getResource = async (req, res) => {
  const resource = resourceService.getResource(req.params.resource);
  if (!resource) {
    return res.status(404).json({ message: `Unknown resource: ${req.params.resource}` });
  }
  res.json(resource);
};

module.exports = { getResources, getResource };

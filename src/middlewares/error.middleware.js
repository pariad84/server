const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  // A 4xx is a client being told a rule -- an unknown resource, a failed validation -- and is worth
  // one line. Only a 5xx means the server itself was wrong, which is what a stack trace is for.
  if (status >= 500) {
    console.error(err);
  } else {
    console.warn(`${status} ${req.method} ${req.originalUrl}: ${err.message}`);
  }
  res.status(status).json({ message: err.message || 'Internal server error' });
};

module.exports = errorHandler;

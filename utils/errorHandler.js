const handleError = (res, error) => {
  console.error(error);
  const message = error.response ? error.response.data : error.message;
  res.status(500).send({ error: message });
};

module.exports = { handleError };

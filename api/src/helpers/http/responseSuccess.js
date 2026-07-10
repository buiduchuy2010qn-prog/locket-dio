const responseSuccess = (res, data = null, message = "OK") => {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
};

module.exports = { responseSuccess };

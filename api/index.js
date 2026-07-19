const server = require("../server");

module.exports = (request, response) => {
  try {
    server.emit("request", request, response);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ ok: false, error: error.message || "PulmCrit IQ backend failed." }));
  }
};

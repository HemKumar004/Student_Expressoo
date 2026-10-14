const { badRequest } = require("../utils/httpError");

function formatIssues(issues) {
  const details = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    if (!details[key]) details[key] = issue.message;
  }
  return details;
}

/**
 * Validate request parts with zod schemas. Parsed (coerced, stripped) values are exposed on
 * `req.valid.body | query | params`; `req.body` is also replaced with the parsed body.
 */
const validate =
  ({ body, query, params }) =>
  (req, _res, next) => {
    req.valid = req.valid || {};
    const parts = { params, query, body };
    for (const [part, schema] of Object.entries(parts)) {
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        throw badRequest("Please correct the highlighted fields.", formatIssues(result.error.issues));
      }
      req.valid[part] = result.data;
      if (part === "body") req.body = result.data;
    }
    next();
  };

module.exports = { validate, formatIssues };

const { z } = require("zod");

const MAX_PAGE_SIZE = 100;

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

function pageArgs({ page, pageSize }) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

function paged(items, total, { page, pageSize }) {
  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

module.exports = { paginationSchema, pageArgs, paged, MAX_PAGE_SIZE };

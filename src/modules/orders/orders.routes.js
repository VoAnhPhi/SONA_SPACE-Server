"use strict";

const router = require("express").Router();

// Mounted at /api/orders. Fixed paths such as /count and /admin are registered before "/:id" inside
// each file, and the files keep that relative order.
router.use(require("./orders-read.routes"));
router.use(require("../payments/momo-ipn.routes"));
router.use(require("./orders-create.routes"));
router.use(require("./orders-manage.routes"));
router.use(require("./order-returns.routes"));

module.exports = router;

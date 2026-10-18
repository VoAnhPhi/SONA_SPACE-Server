"use strict";

// contact_form_design.status is a smallint; the API speaks in labels.
const STATUS_CODE_TO_LABEL = {
  0: "NEW",
  1: "PENDING",
  2: "IN_PROGRESS",
  3: "DEPOSIT",
  4: "RESOLVED",
  5: "REJECTED",
};

const STATUS_LABEL_TO_CODE = Object.entries(STATUS_CODE_TO_LABEL).reduce((acc, [code, label]) => {
  acc[label] = Number(code);
  return acc;
}, {});

// Allowed moves of a form through its life cycle; RESOLVED and REJECTED are final.
const VALID_STATUS_TRANSITIONS = {
  NEW: ["PENDING", "IN_PROGRESS", "REJECTED"],
  PENDING: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["DEPOSIT", "REJECTED"],
  DEPOSIT: ["RESOLVED", "REJECTED"],
};

module.exports = { STATUS_CODE_TO_LABEL, STATUS_LABEL_TO_CODE, VALID_STATUS_TRANSITIONS };

#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const SCAN_TARGETS = [
  "app.js",
  "config",
  "db",
  "middleware",
  "migrations",
  "models",
  "routes",
  "services",
  "chatbotSocket.js",
  "chatbotSocket-gemini.js",
  "chatbotSocket-gemini-25-pro.js",
];

const ALLOWED_EXT = new Set([".js", ".cjs", ".mjs", ".ts", ".sql"]);

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  ".yarn",
  "public",
  "views",
  "template",
  "tmp",
  "docs",
]);

const IGNORE_MARKER = "mysql-scan-ignore";

const RULES = [
  {
    id: "mysql-driver-api",
    message: "MySQL driver API detected",
    regex: /\bdb\.(execute|getConnection)\s*\(/g,
  },
  {
    id: "mysql-transaction-api",
    message: "MySQL transaction API detected",
    regex: /\b(beginTransaction|commit|rollback)\s*\(/g,
  },
  {
    id: "mysql-result-shape",
    message: "MySQL result contract detected",
    regex: /\b(insertId|affectedRows)\b/g,
  },
  {
    id: "mysql-sql-functions",
    message: "MySQL-specific SQL function/syntax detected",
    regex: /\b(DATE_FORMAT|IFNULL|DATE_SUB|CURDATE|DATABASE)\s*\(|ON\s+DUPLICATE\s+KEY|SHOW\s+TABLES|SHOW\s+COLUMNS/gi,
  },
  {
    id: "mysql-json-funcs",
    message: "MySQL JSON function detected",
    regex: /\bJSON_ARRAYAGG\s*\(|\bJSON_OBJECT\s*\(/gi,
  },
  {
    id: "mysql-order-table-quoted",
    message: "Backtick quoted MySQL table name detected",
    regex: /`(?:order|orders|user)`/g,
  },
  {
    id: "mysql-limit-offset-style",
    message: "MySQL LIMIT offset, limit style detected",
    regex: /\bLIMIT\s+\d+\s*,\s*\d+|\bLIMIT\s+\?\s*,\s*\?/gi,
  },
  {
    id: "mysql-array-destructure-query",
    message: "mysql2-style array destructuring on db.query detected",
    regex: /\[[^\]]+\]\s*=\s*await\s+(?:db|connection)\.query\s*\(/g,
  },
];

function toPosix(filePath) {
  return filePath.replace(/\\/g, "/");
}

function isExcludedDir(absPath) {
  const parts = toPosix(path.relative(ROOT, absPath)).split("/");
  return parts.some((p) => EXCLUDE_DIRS.has(p));
}

function walkFiles(targetPath, out = []) {
  if (!fs.existsSync(targetPath)) return out;
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    if (isExcludedDir(targetPath)) return out;
    for (const entry of fs.readdirSync(targetPath)) {
      walkFiles(path.join(targetPath, entry), out);
    }
    return out;
  }
  if (!ALLOWED_EXT.has(path.extname(targetPath))) return out;
  out.push(targetPath);
  return out;
}

function getLineCol(text, index) {
  const lines = text.slice(0, index).split(/\r?\n/);
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  return { line, col };
}

function findQueryCallsWithQuestionMark(text) {
  // Detect SQL strings passed directly into db.query/db.execute with "?" placeholder.
  const regex =
    /\b(?:db|connection)\.(?:query|execute)\s*\(\s*([`'"])([\s\S]*?)(?<!\\)\1/gm;
  const matches = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    const sql = m[2];
    const startIndex = m.index;
    if (sql.includes("?")) {
      matches.push({
        startIndex,
        excerpt: "SQL string uses '?' placeholder in db.query/db.execute",
      });
    }
  }
  return matches;
}

function scanFile(absPath) {
  const text = fs.readFileSync(absPath, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    let m;
    while ((m = rule.regex.exec(text)) !== null) {
      const { line, col } = getLineCol(text, m.index);
      const lineText = lines[line - 1] || "";
      if (lineText.includes(IGNORE_MARKER)) continue;
      findings.push({
        rule: rule.id,
        message: rule.message,
        line,
        col,
        snippet: m[0],
      });
    }
  }

  const qMarkFindings = findQueryCallsWithQuestionMark(text);
  for (const hit of qMarkFindings) {
    const { line, col } = getLineCol(text, hit.startIndex);
    const lineText = lines[line - 1] || "";
    if (lineText.includes(IGNORE_MARKER)) continue;
    findings.push({
      rule: "mysql-question-placeholder",
      message: hit.excerpt,
      line,
      col,
      snippet: "?",
    });
  }

  return findings;
}

function main() {
  const files = [];
  for (const target of SCAN_TARGETS) {
    walkFiles(path.join(ROOT, target), files);
  }

  const allFindings = [];
  for (const file of files) {
    const findings = scanFile(file);
    if (findings.length > 0) {
      allFindings.push({ file, findings });
    }
  }

  if (allFindings.length === 0) {
    console.log("OK: no MySQL patterns found.");
    process.exit(0);
  }

  console.error("FAIL: MySQL patterns found. Please migrate these usages:");
  let count = 0;
  for (const item of allFindings) {
    const rel = toPosix(path.relative(ROOT, item.file));
    for (const f of item.findings) {
      count += 1;
      console.error(
        `- ${rel}:${f.line}:${f.col} [${f.rule}] ${f.message} -> ${f.snippet}`
      );
    }
  }
  console.error(`Total findings: ${count}`);
  console.error(
    `Tip: add '${IGNORE_MARKER}' on a line only when exception is truly intentional.`
  );
  process.exit(1);
}

main();
